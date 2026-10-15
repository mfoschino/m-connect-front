import assert from 'node:assert/strict'
import test from 'node:test'
import { mapBackendProfileToForm } from '../src/services/adapters/profileAdapter.js'
import {
  beginProfileLoadRequest,
  createProfileLoadRequestState,
  invalidateProfileLoadRequests,
  loadProfileForEditRequest,
  shouldRenderProfileForm,
} from '../src/services/profileModalLoadFlow.js'
import { persistProfile } from '../src/services/profileSaveFlow.js'

const deferred = () => {
  let resolve
  let reject
  const promise = new Promise((resolvePromise, rejectPromise) => {
    resolve = resolvePromise
    reject = rejectPromise
  })
  return { promise, resolve, reject }
}

const backendProfile = (id) => ({
  id,
  source_system: 'tiendanube',
  entity: 'sales_order',
  version: '1.0.0',
  config: [{ source_field: id, target_field: 'external_id', field_type: 'simple' }],
  is_active: true,
})

const createHarness = () => {
  const requests = new Map()
  const requestRef = { current: createProfileLoadRequestState() }
  const state = {
    open: false,
    mode: 'create',
    selectedProfile: null,
    loading: false,
    error: null,
    targetProfileId: null,
  }

  const getProfile = (profileId) => {
    const pending = deferred()
    const profileRequests = requests.get(profileId) || []
    profileRequests.push(pending)
    requests.set(profileId, profileRequests)
    return pending.promise
  }

  const openEdit = (profile) => {
    const request = beginProfileLoadRequest(requestRef, profile.id)
    Object.assign(state, {
      open: true,
      mode: 'edit',
      selectedProfile: null,
      loading: true,
      error: null,
      targetProfileId: profile.id,
    })

    return loadProfileForEditRequest({
      requestRef,
      request,
      getProfile,
      normalizeProfile: mapBackendProfileToForm,
      onSuccess: (loadedProfile) => {
        state.selectedProfile = loadedProfile
        state.error = null
      },
      onError: () => {
        state.selectedProfile = null
        state.error = 'No se pudo cargar el perfil. Intenta de nuevo.'
      },
      onFinally: () => {
        state.loading = false
      },
    })
  }

  const openCreate = () => {
    invalidateProfileLoadRequests(requestRef)
    Object.assign(state, {
      open: true,
      mode: 'create',
      selectedProfile: null,
      loading: false,
      error: null,
      targetProfileId: null,
    })
  }

  const close = () => {
    invalidateProfileLoadRequests(requestRef)
    Object.assign(state, {
      open: false,
      selectedProfile: null,
      loading: false,
      error: null,
      targetProfileId: null,
    })
  }

  const retry = () => openEdit({ id: state.targetProfileId })
  const pending = (profileId, index = 0) => requests.get(profileId)[index]

  return { state, openEdit, openCreate, close, retry, pending }
}

test('Edit A → Create ignores the late A response', async () => {
  const harness = createHarness()
  const editA = harness.openEdit({ id: 'A', config: ['stale-list-snapshot'] })
  harness.openCreate()
  harness.pending('A').resolve({ data: backendProfile('A') })

  assert.deepEqual(await editA, { status: 'stale' })
  assert.deepEqual(harness.state, {
    open: true,
    mode: 'create',
    selectedProfile: null,
    loading: false,
    error: null,
    targetProfileId: null,
  })
})

test('Edit A → Edit B keeps B when B resolves before A', async () => {
  const harness = createHarness()
  const editA = harness.openEdit({ id: 'A' })
  const editB = harness.openEdit({ id: 'B' })
  harness.pending('B').resolve({ data: backendProfile('B') })
  await editB
  harness.pending('A').resolve({ data: backendProfile('A') })
  await editA

  assert.equal(harness.state.selectedProfile.id, 'B')
  assert.equal(harness.state.loading, false)
})

test('Edit A → Edit B waits for and shows B when A resolves first', async () => {
  const harness = createHarness()
  const editA = harness.openEdit({ id: 'A' })
  const editB = harness.openEdit({ id: 'B' })
  harness.pending('A').resolve({ data: backendProfile('A') })
  await editA

  assert.equal(harness.state.selectedProfile, null)
  assert.equal(harness.state.loading, true)

  harness.pending('B').resolve({ data: backendProfile('B') })
  await editB
  assert.equal(harness.state.selectedProfile.id, 'B')
  assert.equal(harness.state.loading, false)
})

test('Edit → close ignores a late response and leaves loading clean', async () => {
  const harness = createHarness()
  const edit = harness.openEdit({ id: 'A' })
  harness.close()
  harness.pending('A').resolve({ data: backendProfile('A') })
  await edit

  assert.equal(harness.state.open, false)
  assert.equal(harness.state.selectedProfile, null)
  assert.equal(harness.state.error, null)
  assert.equal(harness.state.loading, false)
})

test('a current detail error fails closed', async () => {
  const harness = createHarness()
  const listSnapshot = { id: 'A', config: ['stale-list-snapshot'] }
  const edit = harness.openEdit(listSnapshot)
  harness.pending('A').reject(new Error('network failed'))
  const result = await edit

  assert.equal(result.status, 'error')
  assert.equal(harness.state.selectedProfile, null)
  assert.match(harness.state.error, /No se pudo cargar el perfil/)
  assert.equal(harness.state.loading, false)
})

test('a mismatched detail response fails closed', async () => {
  const harness = createHarness()
  const edit = harness.openEdit({ id: 'A' })
  harness.pending('A').resolve({ data: backendProfile('B') })
  const result = await edit

  assert.equal(result.status, 'error')
  assert.equal(harness.state.selectedProfile, null)
  assert.match(harness.state.error, /No se pudo cargar el perfil/)
  assert.equal(harness.state.loading, false)
})

test('an error state does not mount ProfileForm', () => {
  assert.equal(shouldRenderProfileForm('edit', null), false)
  assert.equal(shouldRenderProfileForm('edit', backendProfile('A')), true)
  assert.equal(shouldRenderProfileForm('create', null), true)
})

test('a failed detail request never uses the list snapshot', async () => {
  const harness = createHarness()
  const listSnapshot = { id: 'A', config: ['must-not-be-used'] }
  const edit = harness.openEdit(listSnapshot)
  harness.pending('A').reject(new Error('timeout'))
  await edit

  assert.notEqual(harness.state.selectedProfile, listSnapshot)
  assert.equal(harness.state.selectedProfile, null)
})

test('retry starts a new generation and mounts the successful profile', async () => {
  const harness = createHarness()
  const first = harness.openEdit({ id: 'A' })
  harness.pending('A', 0).reject(new Error('temporary failure'))
  await first

  const retry = harness.retry()
  assert.equal(harness.state.loading, true)
  assert.equal(harness.state.error, null)
  harness.pending('A', 1).resolve({ data: backendProfile('A') })
  assert.equal((await retry).status, 'success')
  assert.equal(harness.state.selectedProfile.id, 'A')
  assert.equal(harness.state.loading, false)
})

test('an old retry is ignored after a newer action', async () => {
  const harness = createHarness()
  const first = harness.openEdit({ id: 'A' })
  harness.pending('A', 0).reject(new Error('temporary failure'))
  await first

  const retry = harness.retry()
  harness.openCreate()
  harness.pending('A', 1).resolve({ data: backendProfile('A') })
  assert.equal((await retry).status, 'stale')
  assert.equal(harness.state.mode, 'create')
  assert.equal(harness.state.selectedProfile, null)
})

test('create always starts with loading=false', () => {
  const harness = createHarness()
  harness.openEdit({ id: 'A' })
  harness.openCreate()
  assert.equal(harness.state.loading, false)
})

test('a stale catch does not publish an error', async () => {
  const harness = createHarness()
  const editA = harness.openEdit({ id: 'A' })
  harness.openCreate()
  harness.pending('A').reject(new Error('late error'))
  assert.equal((await editA).status, 'stale')
  assert.equal(harness.state.error, null)
})

test('a stale finally does not change loading for the current edit', async () => {
  const harness = createHarness()
  const editA = harness.openEdit({ id: 'A' })
  const editB = harness.openEdit({ id: 'B' })
  harness.pending('A').resolve({ data: backendProfile('A') })
  await editA

  assert.equal(harness.state.loading, true)
  assert.equal(harness.state.selectedProfile, null)

  harness.pending('B').resolve({ data: backendProfile('B') })
  await editB
})

test('saving after competing edits PATCHes the last valid profile ID', async () => {
  const harness = createHarness()
  const editA = harness.openEdit({ id: 'A' })
  const editB = harness.openEdit({ id: 'B' })
  harness.pending('B').resolve({ data: backendProfile('B') })
  await editB
  harness.pending('A').resolve({ data: backendProfile('A') })
  await editA

  const patchedIds = []
  await persistProfile({
    mode: harness.state.mode,
    profileId: harness.state.selectedProfile.id,
    payload: { version: '2.0.0' },
    profileApi: {
      updateProfile: async (profileId) => {
        patchedIds.push(profileId)
      },
    },
    confirmEdit: () => true,
  })

  assert.deepEqual(patchedIds, ['B'])
})
