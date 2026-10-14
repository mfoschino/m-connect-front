import apiClient from './client'

const getInvitations = ({ status = '', skip = 0, limit = 50 } = {}) =>
  apiClient.get('/tenant/invitations', {
    params: { ...(status ? { status } : {}), skip, limit },
  })

const createInvitation = ({ email, role }) =>
  apiClient.post('/tenant/invitations', { email, role }, { _iamSkipAuthRetry: true })

const resendInvitation = (invitationId) =>
  apiClient.post(`/tenant/invitations/${invitationId}/resend`, undefined,
    { _iamSkipAuthRetry: true })

const revokeInvitation = (invitationId) =>
  apiClient.delete(`/tenant/invitations/${invitationId}`, { _iamSkipAuthRetry: true })

export default { getInvitations, createInvitation, resendInvitation, revokeInvitation }
