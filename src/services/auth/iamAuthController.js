import { IamCapabilityError, IamSessionError } from './iamSession.js'

const initialState = Object.freeze({ status: 'bootstrapping', user: null,
  error: null, logoutResult: null, hasBootstrapped: false, contextId: null })

export const createIamAuthController = ({ manager, transport, deviceStore, inviteTokenStore,
  clearLegacy }) => {
  if (!manager?.restore || !transport?.getCurrentUser) {
    throw new TypeError('Se requieren gestor y transporte IAM.')
  }

  const listeners = new Set()
  let state = initialState
  let epoch = 0
  let bootstrapPromise = null
  let hasBootstrapped = false
  let validatedContext = null
  let otpIntent = null
  let otpCancelPromise = null
  let forbiddenOperation = null
  let pendingTenantId = null
  let logoutIntent = null

  const getState = () => state
  const isBusinessReady = (context) => state.status === 'authenticated'
    && Boolean(state.user) && Boolean(validatedContext)
    && manager.isSameContext(validatedContext)
    && (!context || manager.isSameContext(context))
  const subscribe = (listener) => {
    listeners.add(listener)
    return () => listeners.delete(listener)
  }
  const publish = (status, user = null, error = null, logoutResult = null) => {
    state = { status, user, error, logoutResult, hasBootstrapped,
      contextId: status === 'authenticated' && user ? validatedContext?.contextId ?? null : null }
    listeners.forEach((listener) => listener())
    return state
  }
  const ensureCurrent = (started, context) => {
    if (started !== epoch || (context && !manager.isSameContext(context))) {
      throw new IamSessionError('context_changed')
    }
  }
  const checkReady = async () => {
    await manager.checkCapabilities()
    manager.startSync()
  }

  const fail = (error, started) => {
    if (started !== epoch) return state
    const managerStatus = manager.getState().status
    if (error instanceof IamCapabilityError) return publish('unsupported', null, error)
    if (error?.code === 'local_cleanup_uncertain') return publish('recovery_required', null, error)
    if (managerStatus === 'recovery_required') return publish('recovery_required', null, error)
    if (managerStatus === 'absent' || error?.status === 401) {
      return publish('anonymous', null, error)
    }
    return publish('unavailable', null, error)
  }

  const loadCurrentUser = async (started, expectedTenantId = pendingTenantId) => {
    const before = manager.getContextSnapshot()
    let accessToken = manager.getAccessToken()
    if (!accessToken) accessToken = await manager.refresh()
    ensureCurrent(started, before)
    const context = manager.getContextSnapshot()
    let user
    try {
      user = await transport.getCurrentUser(accessToken)
    } catch (error) {
      ensureCurrent(started, context)
      if (error?.status !== 401) throw error
      try {
        accessToken = await manager.refresh()
        ensureCurrent(started, context)
        user = await transport.getCurrentUser(accessToken)
      } catch (retryError) {
        if (retryError?.status === 401 && manager.isSameContext(context)) {
          const cleanup = await manager.invalidateLocal()
          if (!cleanup.localCleared) throw new IamSessionError('local_cleanup_uncertain')
        }
        throw retryError
      }
    }
    ensureCurrent(started, context)
    if (expectedTenantId && user.tenant_id !== expectedTenantId) {
      throw new IamSessionError('switch_tenant_mismatch')
    }
    if (expectedTenantId) pendingTenantId = null
    validatedContext = context
    publish('authenticated', user)
    return user
  }

  const restoreAndValidate = async (started) => {
    const restored = await manager.restore()
    ensureCurrent(started)
    if (restored.status === 'absent') return publish('anonymous')
    if (restored.status === 'recovery_required') {
      return publish('recovery_required', null,
        new IamSessionError('refresh_state_uncertain'))
    }
    await loadCurrentUser(started)
    return state
  }

  const bootstrap = () => {
    if (logoutIntent) return Promise.resolve(state)
    if (bootstrapPromise) return bootstrapPromise
    const started = ++epoch
    validatedContext = null
    publish('bootstrapping')
    clearLegacy?.()
    bootstrapPromise = (async () => {
      try {
        await checkReady()
        ensureCurrent(started)
        return await restoreAndValidate(started)
      } catch (error) {
        return fail(error, started)
      } finally {
        if (started === epoch) {
          hasBootstrapped = true
          publish(state.status, state.user, state.error, state.logoutResult)
        }
      }
    })()
    return bootstrapPromise
  }

  const suspend = () => {
    ++epoch
    validatedContext = null
    otpIntent = null
    pendingTenantId = null
    bootstrapPromise = null
    hasBootstrapped = false
    publish('bootstrapping')
  }

  const retry = async () => {
    if (logoutIntent) return state
    const started = ++epoch
    validatedContext = null
    publish('bootstrapping')
    try {
      await checkReady()
      ensureCurrent(started)
      const managerStatus = manager.getState().status
      if (managerStatus === 'tokens_available' || managerStatus === 'pending_restore') {
        await loadCurrentUser(started)
        return state
      }
      if (managerStatus === 'recovery_required') {
        return publish('recovery_required', null,
          new IamSessionError('refresh_state_uncertain'))
      }
      return await restoreAndValidate(started)
    } catch (error) {
      return fail(error, started)
    }
  }

  const acceptAndValidate = async (result, { email, rememberSession, rememberDevice }, started) => {
    await manager.acceptTokens(result, { rememberSession })
    ensureCurrent(started)
    const user = await loadCurrentUser(started)
    if (rememberDevice && result.deviceToken) deviceStore?.save(email, result.deviceToken)
    return { status: 'authenticated', user }
  }

  const beginLogin = async ({ email, password, rememberSession = false }) => {
    logoutIntent = null
    const started = ++epoch
    validatedContext = null
    otpIntent = null
    pendingTenantId = null
    publish('bootstrapping')
    clearLegacy?.()
    try {
      if (otpCancelPromise) {
        const cleanup = await otpCancelPromise
        ensureCurrent(started)
        if (!cleanup.localCleared) throw new IamSessionError('local_cleanup_uncertain')
      }
      await checkReady()
      ensureCurrent(started)
      if (manager.getContextSnapshot().contextId) {
        const cleanup = await manager.invalidateLocal()
        ensureCurrent(started)
        if (!cleanup.localCleared) throw new IamSessionError('local_cleanup_uncertain')
      }
      const normalizedEmail = email.trim().toLowerCase()
      const deviceToken = deviceStore?.get(normalizedEmail) ?? null
      const result = await transport.login({ email: normalizedEmail, password, deviceToken })
      ensureCurrent(started)
      if (result.status === 'otp_required') {
        if (deviceToken) deviceStore?.remove(normalizedEmail)
        otpIntent = { challengeId: result.challengeId, email: normalizedEmail }
        publish('anonymous')
        return result
      }
      return await acceptAndValidate(result,
        { email: normalizedEmail, rememberSession, rememberDevice: false }, started)
    } catch (error) {
      fail(error, started)
      throw error
    }
  }

  const acceptInvitation = async ({ token, password, fullName, rememberSession = false }) => {
    logoutIntent = null
    const started = ++epoch
    validatedContext = null
    otpIntent = null
    pendingTenantId = null
    publish('bootstrapping')
    clearLegacy?.()
    try {
      if (otpCancelPromise) {
        const cleanup = await otpCancelPromise
        ensureCurrent(started)
        if (!cleanup.localCleared) throw new IamSessionError('local_cleanup_uncertain')
      }
      await checkReady()
      ensureCurrent(started)
      if (manager.getContextSnapshot().contextId) {
        const cleanup = await manager.invalidateLocal()
        ensureCurrent(started)
        if (!cleanup.localCleared) throw new IamSessionError('local_cleanup_uncertain')
      }
      const result = await transport.acceptInvitation({ token, password, fullName })
      ensureCurrent(started)
      return await acceptAndValidate(result,
        { email: null, rememberSession, rememberDevice: false }, started)
    } catch (error) {
      fail(error, started)
      throw error
    }
  }

  const cancelOtp = () => {
    // La navegación por un login ya validado desmonta el formulario OTP.
    if (state.status === 'authenticated') return Promise.resolve({ localCleared: true })
    if (!otpIntent) return Promise.resolve({ localCleared: true })
    otpIntent = null
    const started = ++epoch
    validatedContext = null
    publish('anonymous')
    const work = manager.invalidateLocal().then((cleanup) => {
      if (!cleanup.localCleared && started === epoch) {
        publish('recovery_required', null, new IamSessionError('local_cleanup_uncertain'))
      }
      return cleanup
    }, () => {
      const error = new IamSessionError('local_cleanup_uncertain')
      if (started === epoch) publish('recovery_required', null, error)
      throw error
    })
    otpCancelPromise = work
    const clearCancel = () => {
      if (otpCancelPromise === work) otpCancelPromise = null
    }
    void work.then(clearCancel, clearCancel)
    return work
  }

  const completeOtp = async ({ email, challengeId, code,
    rememberSession = false, rememberDevice = false }) => {
    const normalizedEmail = email.trim().toLowerCase()
    const intent = otpIntent
    if (!intent || intent.challengeId !== challengeId || intent.email !== normalizedEmail) {
      throw new IamSessionError('otp_cancelled')
    }
    const started = ++epoch
    publish('bootstrapping')
    try {
      const result = await transport.verifyOtp({ challengeId, code, rememberDevice })
      ensureCurrent(started)
      if (otpIntent !== intent) throw new IamSessionError('otp_cancelled')
      const accepted = await acceptAndValidate(result,
        { email: normalizedEmail, rememberSession, rememberDevice }, started)
      if (otpIntent === intent) otpIntent = null
      return accepted
    } catch (error) {
      fail(error, started)
      throw error
    }
  }

  const resendOtp = async (challengeId) => {
    const intent = otpIntent
    if (!intent || intent.challengeId !== challengeId) {
      throw new IamSessionError('otp_cancelled')
    }
    const result = await transport.resendOtp(challengeId)
    if (otpIntent !== intent) throw new IamSessionError('otp_cancelled')
    otpIntent = { ...intent, challengeId: result.challengeId }
    return result
  }

  const revalidateAfterForbidden = (context) => {
    if (state.status !== 'authenticated' || !validatedContext
      || !manager.isSameContext(context) || !manager.isSameContext(validatedContext)) {
      return Promise.resolve(state)
    }
    if (forbiddenOperation && manager.isSameContext(forbiddenOperation.context)) {
      return forbiddenOperation.promise
    }
    const started = epoch
    const work = (async () => {
      try {
        await loadCurrentUser(started)
        return state
      } catch (error) {
        return fail(error, started)
      }
    })()
    forbiddenOperation = { context, promise: work }
    void work.finally(() => {
      if (forbiddenOperation?.promise === work) forbiddenOperation = null
    })
    return work
  }

  const reloadUser = async () => {
    const started = ++epoch
    try {
      await loadCurrentUser(started)
      return state
    } catch (error) {
      return fail(error, started)
    }
  }

  const switchTenant = async (tenantId) => {
    if (state.status === 'switching') throw new IamSessionError('switch_in_progress')
    if (state.status !== 'authenticated' || !state.user) {
      throw new IamSessionError('no_validated_session')
    }
    if (typeof tenantId !== 'string' || !tenantId.trim()) {
      throw new IamSessionError('invalid_tenant_id')
    }
    const previous = manager.getContextSnapshot()
    const started = ++epoch
    validatedContext = null
    pendingTenantId = tenantId
    publish('switching')
    try {
      await manager.switchTenant(tenantId)
      ensureCurrent(started)
      const user = await loadCurrentUser(started, tenantId)
      return { status: 'authenticated', user }
    } catch (error) {
      if (started !== epoch) throw error
      if ([403, 422].includes(error?.status) && manager.isSameContext(previous)) {
        pendingTenantId = null
        try {
          const user = await loadCurrentUser(started)
          publish('authenticated', user, error)
        } catch (revalidationError) {
          fail(revalidationError, started)
        }
      } else fail(error, started)
      throw error
    }
  }

  const logout = async () => {
    const intent = {}
    logoutIntent = intent
    const started = ++epoch
    validatedContext = null
    otpIntent = null
    pendingTenantId = null
    publish('anonymous')
    clearLegacy?.()
    inviteTokenStore?.clear()
    try {
      const result = await manager.logout()
      if (started !== epoch) return result
      if (!result.localCleared) {
        publish('recovery_required', null, new IamSessionError('local_cleanup_uncertain'))
      } else publish('anonymous', null, null, result)
      return result
    } catch (error) {
      if (started === epoch) publish('recovery_required', null, error)
      throw error
    } finally {
      if (logoutIntent === intent) logoutIntent = null
    }
  }

  const invalidateAfterPasswordReset = async (email) => {
    const started = ++epoch
    validatedContext = null
    pendingTenantId = null
    publish('anonymous')
    deviceStore?.remove(email)
    clearLegacy?.()
    const result = await manager.invalidateLocal()
    if (!result.localCleared && started === epoch) {
      publish('recovery_required', null, new IamSessionError('local_cleanup_uncertain'))
    }
    return result
  }

  const stopManagerSubscription = manager.subscribe(() => {
    const managerStatus = manager.getState().status
    if (managerStatus === 'remote_switch') {
      if (logoutIntent) return
      validatedContext = null
      pendingTenantId = null
      ++epoch
      publish('switching')
      void retry()
      return
    }
    if (validatedContext && !manager.isSameContext(validatedContext)) {
      validatedContext = null
      ++epoch
      const status = managerStatus === 'recovery_required'
        ? 'recovery_required' : managerStatus === 'switching' ? 'switching' : 'anonymous'
      publish(status)
    }
  })

  return { getState, isBusinessReady, subscribe, bootstrap, suspend, retry,
    beginLogin, completeOtp, acceptInvitation,
    resendOtp, cancelOtp, revalidateAfterForbidden, reloadUser, switchTenant,
    logout, invalidateAfterPasswordReset,
    dispose: () => { stopManagerSubscription(); listeners.clear() } }
}
