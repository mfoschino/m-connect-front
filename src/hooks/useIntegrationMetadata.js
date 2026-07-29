import { useEffect, useState } from 'react'
import metadataService from '../services/api/metadataService'

const initialMetadata = {
  fieldTypes: [],
  commonConfigFields: [],
  fieldTypeConfigFields: {},
  onErrorStrategies: [],
  entityTypes: [],
  connectorTypes: [],
}

const getErrorMessage = (error) => {
  const backendDetail = error?.response?.data?.detail
  if (typeof backendDetail === 'string') return backendDetail
  if (error?.message) return error.message
  return 'No se pudo cargar la metadata de integraciones.'
}

const useIntegrationMetadata = () => {
  const [metadata, setMetadata] = useState(initialMetadata)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    let mounted = true

    Promise.all([
      metadataService.getFieldTypes(),
      metadataService.getOnErrorStrategies(),
      metadataService.getEntityTypes(),
      metadataService.getConnectorTypes(),
    ])
      .then(([fieldTypeCatalog, onErrorStrategies, entityTypes, connectorTypes]) => {
        if (!mounted) return
        setMetadata({
          ...fieldTypeCatalog,
          onErrorStrategies,
          entityTypes,
          connectorTypes,
        })
      })
      .catch((requestError) => {
        if (!mounted) return
        setError(getErrorMessage(requestError))
      })
      .finally(() => {
        if (mounted) setLoading(false)
      })

    return () => {
      mounted = false
    }
  }, [])

  return { ...metadata, loading, error }
}

export default useIntegrationMetadata
