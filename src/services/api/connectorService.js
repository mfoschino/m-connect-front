import apiClient from './client'
import { normalizeConnectorDefinitions, normalizeConnectorInstallations,
  normalizeConnectorInstallation } from '../adapters/connectorAdapter'

const kindParams = (kind) => {
  if (kind === undefined || kind === null || kind === '') return {}
  if (kind !== 'input' && kind !== 'output') throw new TypeError('Tipo de conector inválido.')
  return { kind }
}

const listDefinitions = async ({ kind, include_inactive } = {}, { signal } = {}) => {
  const params = kindParams(kind)
  if (include_inactive !== undefined) {
    if (typeof include_inactive !== 'boolean') throw new TypeError('Filtro de actividad inválido.')
    params.include_inactive = include_inactive
  }
  const response = await apiClient.get('/connector-definitions', { params, signal })
  return { ...response, data: normalizeConnectorDefinitions(response.data) }
}

const listInstallations = async ({ kind, connector_definition_id } = {}, { signal } = {}) => {
  const params = kindParams(kind)
  if (connector_definition_id) params.connector_definition_id = connector_definition_id
  const response = await apiClient.get('/connector-installations', { params, signal })
  return { ...response, data: normalizeConnectorInstallations(response.data) }
}

const getInstallation = async (installationId, { signal } = {}) => {
  if (typeof installationId !== 'string' || !installationId.trim()) {
    throw new TypeError('Falta identificar la instalación.')
  }
  const response = await apiClient.get(`/connector-installations/${encodeURIComponent(installationId)}`, { signal })
  return { ...response, data: normalizeConnectorInstallation(response.data) }
}

export default { listDefinitions, listInstallations, getInstallation }
