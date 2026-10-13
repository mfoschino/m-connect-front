import { IamContractError } from './iamContracts.js'
import { IamCoordinationError, createWebLockCoordinator } from './iamCoordinator.js'
import { IamStorageError } from './iamStorage.js'

export class IamSessionError extends Error {
  constructor(code) {
    super(code)
    this.name = 'IamSessionError'
    this.code = code
  }
}

export class IamCapabilityError extends IamSessionError {
  constructor(code) {
    super(code)
    this.name = 'IamCapabilityError'
  }
}

const empty = (status = 'absent') => ({
  status, contextId: null, revision: null, accessToken: null,
  refreshToken: null, expiresAt: null, mode: null, lineageId: null,
})

const validPair = (pair) => pair
  && typeof pair.accessToken === 'string' && pair.accessToken.length > 0
  && typeof pair.refreshToken === 'string' && pair.refreshToken.length > 0
  && typeof pair.tokenType === 'string' && pair.tokenType.toLowerCase() === 'bearer'
  && Number.isInteger(pair.expiresIn) && pair.expiresIn > 0

const makeId = () => {
  if (typeof globalThis.crypto?.randomUUID !== 'function') {
    throw new IamSessionError('secure_id_unavailable')
  }
  return globalThis.crypto.randomUUID()
}

export const createIamSession = ({
  transport, storage, coordinator = createWebLockCoordinator(),
  clock = Date.now, idFactory = makeId,
  secureContext = () => globalThis.isSecureContext !== false,
  secureIdsAvailable = () => typeof globalThis.crypto?.randomUUID === 'function',
}) => {
  if (!transport?.refresh || !transport?.logout || !storage?.readCredentials) {
    throw new TypeError('Se requieren transporte y almacenamiento IAM.')
  }

  let current = empty('uninitialized')
  let generation = 0
  let mutationEpoch = 0
  let refreshPromise = null
  let switchIntent = null
  let logoutContext = null
  let logoutOperation = null
  let stopMarkerSync = null
  const listeners = new Set()
  const lockName = `mconnect-iam-rotation:${encodeURIComponent(storage.scope)}`

  const getState = () => ({
    status: isClosing() ? 'logging_out' : current.status,
    contextId: current.contextId,
    tokenRevision: current.revision,
    expiresAt: current.expiresAt,
    mode: current.mode,
    userValidated: false,
  })
  const emit = () => listeners.forEach((listener) => listener(getState()))
  const subscribe = (listener) => {
    listeners.add(listener)
    return () => listeners.delete(listener)
  }
  const getContextSnapshot = () => ({
    contextId: current.contextId,
    generation,
    tokenRevision: current.revision,
  })
  const sameIdentity = (snapshot) => Boolean(snapshot?.contextId)
    && snapshot.contextId === current.contextId
    && snapshot.generation === generation
  const lineageOf = (value) => value?.lineageId ?? value?.contextId ?? null
  const isClosing = () => logoutContext !== null
    && logoutContext.contextId === current.contextId
    && logoutContext.generation === generation
  const isSameContext = (snapshot) => sameIdentity(snapshot)
    && !isClosing() && current.status !== 'switching'

  const validAccessInMemory = () => current.status === 'tokens_available'
    && current.expiresAt > clock() ? current.accessToken : null
  const freshAccess = () => current.expiresAt > clock() ? current.accessToken : null
  const getAccessToken = () => isClosing() ? null : validAccessInMemory()

  const setRecovery = (code) => {
    generation += 1
    current = { ...current, status: 'recovery_required', accessToken: null,
      refreshToken: null, expiresAt: null }
    emit()
    throw new IamSessionError(code)
  }

  const forgetInMemory = (status = 'absent') => {
    const contextId = current.contextId
    generation += 1
    current = empty(status)
    refreshPromise = null
    emit()
    return contextId
  }

  const assertCapabilityHints = () => {
    if (!secureContext()) throw new IamCapabilityError('insecure_context')
    if (idFactory === makeId && !secureIdsAvailable()) {
      throw new IamCapabilityError('secure_id_unavailable')
    }
    try {
      storage.assertAvailable()
      if (typeof coordinator.assertAvailable === 'function') coordinator.assertAvailable()
    } catch (error) {
      if (error instanceof IamStorageError || error instanceof IamCoordinationError) {
        throw new IamCapabilityError(error.code)
      }
      throw error
    }
  }

  const capabilityFailure = (error) =>
    error instanceof IamCoordinationError
      || (error instanceof IamStorageError && error.code === 'storage_unavailable')
      ? new IamCapabilityError(error.code) : error

  const checkCapabilities = async () => {
    assertCapabilityHints()
    try {
      // Un lock separado comprueba que request() funciona sin esperar una rotación.
      await coordinator.runExclusive(`${lockName}:capability`, () => undefined)
    } catch (error) {
      if (error instanceof IamCoordinationError) throw new IamCapabilityError(error.code)
      throw error
    }
    return { available: true }
  }

  const stopSync = () => {
    if (stopMarkerSync) stopMarkerSync()
    stopMarkerSync = null
  }

  const startSync = (eventTarget = globalThis) => {
    if (stopMarkerSync) return stopSync
    try {
      stopMarkerSync = storage.observeMarker(() => {
        if (!current.contextId) return
        if (isClosing()) return
        let marker
        try { marker = storage.readMarker() } catch (error) {
          if (!(error instanceof IamStorageError)) throw error
          forgetInMemory()
          return
        }
        if (!marker || marker.contextId !== current.contextId
          || (marker.phase === 'inflight' && marker.attemptId === 'closed')) {
          forgetInMemory(marker?.contextId !== current.contextId
            && marker?.transition === 'tenant_switch' ? 'remote_switch' : 'absent')
        }
      }, eventTarget)
    } catch (error) {
      if (error instanceof IamStorageError) throw new IamCapabilityError(error.code)
      throw error
    }
    return stopSync
  }

  const clearStoredContext = (contextId) => {
    if (!contextId) return { localCleared: true }
    try {
      storage.clearContext(contextId)
      return { localCleared: true }
    } catch (error) {
      if (!(error instanceof IamStorageError)) throw error
      return { localCleared: false }
    }
  }

  const clearStoredLineage = (contextId, lineageId) => {
    try {
      if (contextId) storage.clearContext(contextId)
      if (lineageId) {
        const marker = storage.readMarker()
        if (lineageOf(marker) === lineageId) storage.clearContext(marker.contextId)
        const record = storage.readCredentials()
        if (lineageOf(record) === lineageId) storage.clearContext(record.contextId)
        if (lineageOf(storage.readMarker()) === lineageId
          || lineageOf(storage.readCredentials()) === lineageId) {
          return { localCleared: false }
        }
      }
      return { localCleared: true }
    } catch (error) {
      if (!(error instanceof IamStorageError)) throw error
      return { localCleared: false }
    }
  }

  const invalidateLocal = async () => {
    const contextId = forgetInMemory()
    try {
      return await coordinator.runExclusive(lockName, () => {
        const storedContextId = contextId ?? storage.readCredentials()?.contextId
        return clearStoredContext(storedContextId)
      })
    } catch (error) {
      if (error instanceof IamCoordinationError || error instanceof IamStorageError) {
        return { localCleared: false }
      }
      throw error
    }
  }

  const invalidateRejected = async (snapshot) => {
    if (!isSameContext(snapshot) || current.revision !== snapshot.tokenRevision) return false
    const contextId = forgetInMemory()
    try {
      await coordinator.runExclusive(lockName, () => {
        const record = storage.readCredentials()
        const marker = storage.readMarker()
        // Otra pestaña puede haber rotado mientras se esperaba el lock.
        if (record?.contextId === contextId && record.revision !== snapshot.tokenRevision) return
        if (marker?.contextId === contextId && marker.revision !== snapshot.tokenRevision) return
        clearStoredContext(contextId)
      })
    } catch (error) {
      if (!(error instanceof IamCoordinationError || error instanceof IamStorageError)) throw error
    }
    return true
  }

  const acceptTokens = async (pair, { rememberSession = false } = {}) => {
    if (!validPair(pair)) throw new IamContractError('invalid_token_pair')
    assertCapabilityHints()
    const contextId = idFactory()
    const revision = idFactory()
    const mode = rememberSession === true ? 'persistent' : 'temporary'
    const record = { version: 1, contextId, revision, lineageId: contextId, mode,
      refreshToken: pair.refreshToken }
    generation += 1
    const startedGeneration = generation
    const startedEpoch = mutationEpoch
    current = empty()
    refreshPromise = null
    emit()
    try {
      await coordinator.runExclusive(lockName, () => {
        if (generation !== startedGeneration || mutationEpoch !== startedEpoch) {
          throw new IamSessionError('context_changed')
        }
        storage.writeCredentials(record)
        storage.writeMarker({ version: 1, contextId, revision,
          lineageId: contextId, phase: 'ready' })
      })
    } catch (error) {
      if (generation !== startedGeneration || mutationEpoch !== startedEpoch) {
        throw new IamSessionError('context_changed')
      }
      current = { ...empty(), status: 'recovery_required' }
      emit()
      throw capabilityFailure(error)
    }
    if (generation !== startedGeneration || mutationEpoch !== startedEpoch) {
      throw new IamSessionError('context_changed')
    }
    current = { status: 'tokens_available', contextId, revision,
      lineageId: contextId, mode,
      accessToken: pair.accessToken, refreshToken: pair.refreshToken,
      expiresAt: clock() + pair.expiresIn * 1000 }
    emit()
    return getState()
  }

  const restore = async () => {
    if (isClosing()) throw new IamSessionError('logout_in_progress')
    assertCapabilityHints()
    generation += 1
    const startedGeneration = generation
    const startedEpoch = mutationEpoch
    refreshPromise = null
    current = empty('restoring')
    emit()
    try {
      return await coordinator.runExclusive(lockName, () => {
        if (generation !== startedGeneration || mutationEpoch !== startedEpoch) {
          throw new IamSessionError('context_changed')
        }
        const record = storage.readCredentials()
        if (!record) current = empty()
        else {
          const marker = storage.readMarker()
          if (!marker || marker.contextId !== record.contextId
            || marker.revision !== record.revision || marker.phase !== 'ready') {
            current = { ...empty(), status: 'recovery_required', contextId: record.contextId,
              mode: record.mode }
          } else {
            current = { status: 'pending_restore', contextId: record.contextId,
              revision: record.revision, lineageId: lineageOf(record),
              mode: record.mode, accessToken: null,
              refreshToken: record.refreshToken, expiresAt: null }
          }
        }
        emit()
        return getState()
      })
    } catch (error) {
      if (generation !== startedGeneration || mutationEpoch !== startedEpoch) {
        throw new IamSessionError('context_changed')
      }
      current = { ...empty(), status: 'recovery_required' }
      emit()
      throw capabilityFailure(error)
    }
  }

  const commitRotatedPair = (record, marker, attemptId, pair, contextId, kind) => {
    if (!validPair(pair)) return setRecovery(`invalid_${kind}_response`)
    const stillOurs = storage.readMarker()
    if (stillOurs?.contextId !== record.contextId
      || stillOurs.revision !== record.revision
      || stillOurs.phase !== 'inflight' || stillOurs.attemptId !== attemptId) {
      return setRecovery(`${kind}_state_uncertain`)
    }
    const revision = idFactory()
    try {
      const lineageId = lineageOf(record)
      storage.writeCredentials({ ...record, contextId, revision, lineageId,
        refreshToken: pair.refreshToken })
      storage.writeMarker({ version: 1, contextId, revision, lineageId, phase: 'ready',
        ...(marker.transition || contextId !== record.contextId
          ? { transition: 'tenant_switch' } : {}) })
    } catch {
      return setRecovery(`${kind}_commit_uncertain`)
    }
    return revision
  }

  const performRefresh = async () => {
    const started = getContextSnapshot()
    if (!['pending_restore', 'tokens_available', 'switching'].includes(current.status)) {
      throw new IamSessionError('no_refresh_credential')
    }

    try {
      return await coordinator.runExclusive(lockName, async () => {
        if (!sameIdentity(started)) throw new IamSessionError('context_changed')
        const record = storage.readCredentials()
        const marker = storage.readMarker()
        if (!record || !marker || record.contextId !== started.contextId
          || marker.contextId !== started.contextId || marker.phase !== 'ready'
          || record.revision !== marker.revision) {
          return setRecovery('refresh_state_uncertain')
        }

        if (record.revision !== current.revision) {
          // Otra pestaña rotó. Sólo el modo compartido permite recuperar el nuevo token.
          if (record.mode !== 'persistent') return setRecovery('stale_temporary_refresh')
          current = { ...current, revision: record.revision,
            refreshToken: record.refreshToken, accessToken: null, expiresAt: null }
          emit()
        }

        const attemptId = idFactory()
        storage.writeMarker({ version: 1, contextId: record.contextId,
          revision: record.revision, lineageId: lineageOf(record),
          phase: 'inflight', attemptId,
          ...(marker.transition ? { transition: marker.transition } : {}) })

        let pair
        try {
          pair = await transport.refresh(record.refreshToken)
        } catch (error) {
          if (!sameIdentity(started)) throw new IamSessionError('context_changed')
          if (error?.status === 401) {
            const contextId = forgetInMemory()
            clearStoredContext(contextId)
            throw new IamSessionError('refresh_rejected')
          }
          if (error instanceof IamContractError) {
            return setRecovery('invalid_refresh_response')
          }
          return setRecovery(['network_error', 'timeout'].includes(error?.code)
            ? 'refresh_outcome_unknown' : error?.code === 'server_error'
              ? 'refresh_server_uncertain' : 'refresh_failed_uncertain')
        }

        if (!sameIdentity(started)) throw new IamSessionError('context_changed')
        const revision = commitRotatedPair(record, marker, attemptId, pair,
          record.contextId, 'refresh')
        current = { ...current, status: current.status === 'switching'
          ? 'switching' : 'tokens_available', revision,
          accessToken: pair.accessToken, refreshToken: pair.refreshToken,
          expiresAt: clock() + pair.expiresIn * 1000 }
        emit()
        if (isClosing()) throw new IamSessionError('logout_in_progress')
        return pair.accessToken
      })
    } catch (error) {
      if (error instanceof IamCoordinationError) return setRecovery(error.code)
      if (error instanceof IamStorageError) return setRecovery(error.code)
      throw error
    }
  }

  const refreshOnce = () => {
    if (refreshPromise) return refreshPromise
    const work = performRefresh().finally(() => {
      if (refreshPromise === work) refreshPromise = null
    })
    refreshPromise = work
    return work
  }

  const refresh = () => isClosing()
    ? Promise.reject(new IamSessionError('logout_in_progress'))
    : current.status === 'switching'
      ? Promise.reject(new IamSessionError('switch_in_progress')) : refreshOnce()

  const switchTenant = (tenantId) => {
    if (typeof tenantId !== 'string' || !tenantId.trim()) {
      return Promise.reject(new IamSessionError('invalid_tenant_id'))
    }
    if (switchIntent) return Promise.reject(new IamSessionError('switch_in_progress'))
    if (isClosing()) return Promise.reject(new IamSessionError('logout_in_progress'))
    if (!['pending_restore', 'tokens_available'].includes(current.status)) {
      return Promise.reject(new IamSessionError('no_refresh_credential'))
    }
    assertCapabilityHints()
    const started = getContextSnapshot()
    const startedEpoch = mutationEpoch
    const intent = { tenantId, started }
    switchIntent = intent
    current = { ...current, status: 'switching' }
    emit()
    const sameSwitch = () => switchIntent === intent && sameIdentity(started)
      && mutationEpoch === startedEpoch && !isClosing()

    const attemptSwitch = () => coordinator.runExclusive(lockName, async () => {
      if (!sameSwitch()) throw new IamSessionError('context_changed')
      const record = storage.readCredentials()
      const marker = storage.readMarker()
      if (!record || !marker || record.contextId !== started.contextId
        || marker.contextId !== started.contextId || marker.phase !== 'ready'
        || record.revision !== marker.revision || record.mode !== current.mode) {
        return setRecovery('switch_state_uncertain')
      }
      if (record.revision !== current.revision) {
        if (record.mode !== 'persistent') return setRecovery('stale_temporary_refresh')
        current = { ...current, revision: record.revision, refreshToken: record.refreshToken }
        emit()
      }
      const accessToken = freshAccess()
      if (!accessToken) throw new IamSessionError('switch_access_expired')
      const attemptId = idFactory()
      storage.writeMarker({ version: 1, contextId: record.contextId,
        revision: record.revision, lineageId: lineageOf(record),
        phase: 'inflight', attemptId,
        ...(marker.transition ? { transition: marker.transition } : {}) })
      let pair
      try {
        pair = await transport.switchTenant(tenantId, accessToken)
      } catch (error) {
        if (!sameSwitch()) throw new IamSessionError('context_changed')
        if ([401, 403, 422].includes(error?.status)) {
          const pending = storage.readMarker()
          if (pending?.contextId !== record.contextId
            || pending.revision !== record.revision || pending.phase !== 'inflight'
            || pending.attemptId !== attemptId) return setRecovery('switch_state_uncertain')
          storage.writeMarker({ version: 1, contextId: record.contextId,
            revision: record.revision, lineageId: lineageOf(record), phase: 'ready',
            ...(marker.transition ? { transition: marker.transition } : {}) })
          if (error.status !== 401) {
            current = { ...current, status: 'tokens_available' }
            emit()
          }
          throw error
        }
        return setRecovery(error instanceof IamContractError
          ? 'invalid_switch_response' : ['network_error', 'timeout'].includes(error?.code)
            ? 'switch_outcome_unknown' : error?.code === 'server_error'
              ? 'switch_server_uncertain' : 'switch_failed_uncertain')
      }
      if (!sameSwitch()) throw new IamSessionError('context_changed')
      const contextId = idFactory()
      const revision = commitRotatedPair(record, marker, attemptId, pair,
        contextId, 'switch')
      generation += 1
      current = { status: 'tokens_available', contextId, revision,
        lineageId: lineageOf(record), mode: record.mode,
        accessToken: pair.accessToken, refreshToken: pair.refreshToken,
        expiresAt: clock() + pair.expiresIn * 1000 }
      emit()
      return getState()
    })

    const work = (async () => {
      if (refreshPromise) await refreshPromise
      if (!sameSwitch()) throw new IamSessionError('context_changed')
      if (!freshAccess()) await refreshOnce()
      for (let attempt = 0; attempt < 2; attempt += 1) {
        if (!sameSwitch()) throw new IamSessionError('context_changed')
        try {
          return await attemptSwitch()
        } catch (error) {
          if (!sameSwitch()) {
            if (current.status === 'recovery_required'
              && error instanceof IamSessionError) throw error
            throw new IamSessionError('context_changed')
          }
          if (attempt === 0 && (error?.status === 401
            || error?.code === 'switch_access_expired')) {
            await refreshOnce()
            continue
          }
          if (error?.status === 401) await invalidateLocal()
          if (error instanceof IamCoordinationError || error instanceof IamStorageError) {
            return setRecovery(error.code)
          }
          throw error
        }
      }
      throw new IamSessionError('switch_rejected')
    })().finally(() => {
      if (switchIntent === intent) switchIntent = null
    })
    return work
  }

  const logout = () => {
    if (isClosing() && logoutOperation?.context === logoutContext) return logoutOperation.promise
    mutationEpoch += 1
    const context = getContextSnapshot()
    let storedContextId = context.contextId
    let lineageId = lineageOf(current)
    let storageFailed = false
    if (!storedContextId) {
      try {
        const stored = storage.readCredentials()
        storedContextId = stored?.contextId ?? null
        lineageId = lineageOf(stored)
      } catch {
        storageFailed = true
      }
    }
    let accessToken = freshAccess()
    const pendingRefresh = refreshPromise
    logoutContext = context
    emit()
    if (!context.contextId) forgetInMemory()

    const work = (async () => {
      let reason = 'no_access_token'
      if (pendingRefresh) {
        try { await pendingRefresh } catch (error) { reason = error?.code ?? 'refresh_failed' }
        if (sameIdentity(context)) accessToken = freshAccess() ?? accessToken
      }
      if (!accessToken && sameIdentity(context)
        && ['pending_restore', 'tokens_available', 'switching'].includes(current.status)) {
        try { await refreshOnce() } catch (error) { reason = error?.code ?? 'refresh_failed' }
        if (sameIdentity(context)) accessToken = freshAccess()
      }

      let revoked = false
      let revokeAttempted = false
      const revoke = async () => {
        if (!accessToken || revokeAttempted) return
        revokeAttempted = true
        try {
          await transport.logout(accessToken)
          revoked = true
        } catch (error) {
          reason = error?.code ?? 'logout_failed'
        }
      }
      let local
      try {
        local = await coordinator.runExclusive(lockName, async () => {
          const first = storageFailed ? { localCleared: false }
            : clearStoredLineage(storedContextId, lineageId)
          if (first.localCleared) return first
          await revoke()
          return storageFailed ? first : clearStoredLineage(storedContextId, lineageId)
        })
      } catch (error) {
        if (!(error instanceof IamCoordinationError || error instanceof IamStorageError)) throw error
        local = { localCleared: false }
      }
      if (context.contextId ? sameIdentity(context) : generation === context.generation) {
        forgetInMemory()
      }
      await revoke()
      return revoked ? { revoked, ...local } : { revoked, ...local, reason }
    })().finally(() => {
      if (logoutContext === context) logoutContext = null
      if (logoutOperation?.context === context) logoutOperation = null
    })
    logoutOperation = { context, promise: work }
    return work
  }

  return {
    acceptTokens, checkCapabilities, getAccessToken, getContextSnapshot, getState,
    invalidateLocal, invalidateRejected, isSameContext, logout, refresh, restore,
    switchTenant,
    startSync, stopSync, subscribe,
  }
}
