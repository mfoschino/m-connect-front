import apiClient from './client'
import {
  normalizeFieldTypesCatalog,
  normalizeMetadataOptions,
} from '../adapters/metadataAdapter'

const getMetadata = async (endpoint, collectionKeys, metadataName) => {
  const response = await apiClient.get(endpoint)
  return normalizeMetadataOptions(response.data, collectionKeys, metadataName)
}

const getFieldTypes = async () => {
  const response = await apiClient.get('/metadata/field-types')
  return normalizeFieldTypesCatalog(response.data)
}

const getOnErrorStrategies = () => getMetadata(
  '/metadata/on-error-strategies',
  ['on_error_strategies', 'onErrorStrategies'],
  'Las estrategias de error',
)

const getEntityTypes = () => getMetadata(
  '/metadata/entity-types',
  ['entity_types', 'entityTypes'],
  'Los tipos de entidad',
)

const getConnectorTypes = () => getMetadata(
  '/metadata/connector-types',
  ['connector_types', 'connectorTypes'],
  'Los tipos de conector',
)

export default {
  getFieldTypes,
  getOnErrorStrategies,
  getEntityTypes,
  getConnectorTypes,
}
