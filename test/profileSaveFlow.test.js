import assert from 'node:assert/strict'
import test from 'node:test'
import {
  SHARED_PROFILE_EDIT_CONFIRMATION,
  persistProfile,
} from '../src/services/profileSaveFlow.js'

test('confirms a shared edit before issuing PATCH', async () => {
  const calls = []
  const profileApi = {
    updateProfile: async (profileId, payload) => {
      calls.push(['patch', profileId, payload])
      return { data: { id: profileId } }
    },
  }

  const result = await persistProfile({
    mode: 'edit',
    profileId: 'profile-1',
    payload: { version: '2.0.0' },
    profileApi,
    confirmEdit: (message) => {
      calls.push(['confirm', message])
      return true
    },
    onBeforePersist: () => calls.push(['pending']),
  })

  assert.equal(result.saved, true)
  assert.deepEqual(calls, [
    ['confirm', SHARED_PROFILE_EDIT_CONFIRMATION],
    ['pending'],
    ['patch', 'profile-1', { version: '2.0.0' }],
  ])
})

test('cancelling the shared edit does not issue PATCH', async () => {
  let requests = 0
  const result = await persistProfile({
    mode: 'edit',
    profileId: 'profile-1',
    payload: {},
    profileApi: {
      updateProfile: async () => {
        requests += 1
      },
    },
    confirmEdit: () => false,
  })

  assert.deepEqual(result, { saved: false, reason: 'cancelled' })
  assert.equal(requests, 0)
})

test('an edit without a confirmation callback fails closed and does not issue PATCH', async () => {
  let requests = 0
  const result = await persistProfile({
    mode: 'edit',
    profileId: 'profile-1',
    payload: {},
    profileApi: {
      updateProfile: async () => {
        requests += 1
      },
    },
  })

  assert.deepEqual(result, { saved: false, reason: 'confirmation-unavailable' })
  assert.equal(requests, 0)
})

test('create persists without the additional shared-edit confirmation', async () => {
  let confirmations = 0
  let requests = 0

  const result = await persistProfile({
    mode: 'create',
    payload: { source_system: 'tiendanube' },
    profileApi: {
      createProfile: async () => {
        requests += 1
      },
    },
    confirmEdit: () => {
      confirmations += 1
      return true
    },
  })

  assert.equal(result.saved, true)
  assert.equal(confirmations, 0)
  assert.equal(requests, 1)
})
