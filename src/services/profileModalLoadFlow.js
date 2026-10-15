export const createProfileLoadRequestState = () => ({
  generation: 0,
  profileId: null,
})

export const beginProfileLoadRequest = (requestRef, profileId) => {
  const request = {
    generation: requestRef.current.generation + 1,
    profileId,
  }

  requestRef.current = request
  return request
}

export const invalidateProfileLoadRequests = (requestRef) => (
  beginProfileLoadRequest(requestRef, null)
)

export const isCurrentProfileLoadRequest = (requestRef, request) => (
  requestRef.current.generation === request.generation
  && requestRef.current.profileId === request.profileId
)

export const shouldRenderProfileForm = (mode, selectedProfile) => (
  mode !== 'edit' || Boolean(selectedProfile)
)

export const loadProfileForEditRequest = async ({
  requestRef,
  request,
  getProfile,
  normalizeProfile,
  onSuccess,
  onError,
  onFinally,
}) => {
  try {
    const response = await getProfile(request.profileId)

    if (!isCurrentProfileLoadRequest(requestRef, request)) {
      return { status: 'stale' }
    }

    const profile = normalizeProfile(response?.data)
    if (!profile?.id || String(profile.id) !== String(request.profileId)) {
      throw new Error('La respuesta no corresponde al perfil solicitado.')
    }

    if (!isCurrentProfileLoadRequest(requestRef, request)) {
      return { status: 'stale' }
    }

    onSuccess(profile)
    return { status: 'success', profile }
  } catch (error) {
    if (!isCurrentProfileLoadRequest(requestRef, request)) {
      return { status: 'stale' }
    }

    onError(error)
    return { status: 'error', error }
  } finally {
    if (isCurrentProfileLoadRequest(requestRef, request)) {
      onFinally()
    }
  }
}
