export const SHARED_PROFILE_EDIT_CONFIRMATION =
  'Este MappingProfile es compartido por el tenant. Guardar los cambios puede afectar integraciones compatibles que utilicen esta configuración. ¿Querés continuar?'

export const persistProfile = async ({
  mode,
  profileId,
  payload,
  profileApi,
  confirmEdit,
  onBeforePersist = () => {},
}) => {
  if (mode === 'edit') {
    if (!profileId) return { saved: false, reason: 'missing-profile' }
    if (typeof confirmEdit !== 'function') {
      return { saved: false, reason: 'confirmation-unavailable' }
    }

    const confirmed = confirmEdit(SHARED_PROFILE_EDIT_CONFIRMATION)
    if (!confirmed) return { saved: false, reason: 'cancelled' }

    onBeforePersist()
    const response = await profileApi.updateProfile(profileId, payload)
    return { saved: true, response }
  }

  onBeforePersist()
  const response = await profileApi.createProfile(payload)
  return { saved: true, response }
}
