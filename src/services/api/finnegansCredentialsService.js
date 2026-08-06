import apiClient from './client'

const getTenantCredentialsPath = (tenantId) => {
  const normalizedTenantId = String(tenantId ?? '').trim()

  if (!normalizedTenantId) {
    throw new Error('No se pudo determinar el tenant actual.')
  }

  return `/tenants/${encodeURIComponent(normalizedTenantId)}/finnegans-credentials`
}

const buildCredentialsPayload = (values = {}) => {
  const clientId = String(values.client_id ?? '').trim()
  const clientSecret = String(values.client_secret ?? '')
  const baseUrl = String(values.base_url ?? '').trim()

  if (!clientId || !clientSecret) {
    throw new Error('Client ID y client secret son obligatorios.')
  }

  return {
    client_id: clientId,
    client_secret: clientSecret,
    ...(baseUrl ? { base_url: baseUrl } : {}),
  }
}

const getTenantFinnegansCredentials = async (tenantId) => {
  const response = await apiClient.get(getTenantCredentialsPath(tenantId))
  return response.data
}

const updateTenantFinnegansCredentials = async (tenantId, values) => {
  const path = getTenantCredentialsPath(tenantId)
  const payload = buildCredentialsPayload(values)
  const response = await apiClient.put(path, payload)
  return response.data
}

export default {
  getTenantFinnegansCredentials,
  updateTenantFinnegansCredentials,
}
