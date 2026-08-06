import { useEffect, useState } from 'react'
import { useAuth } from '../../context/AuthContext'
import finnegansCredentialsService from '../../services/api/finnegansCredentialsService'
import Alert from '../ui/Alert'
import Button from '../ui/Button'
import Card from '../ui/Card'
import Input from '../ui/Input'

const EMPTY_FORM = {
  client_id: '',
  client_secret: '',
  base_url: '',
}

const getRequestErrorMessage = (error, action) => {
  const status = error?.response?.status

  if (status === 401) return 'La sesión no está autorizada para realizar esta operación.'
  if (status === 403) return 'No tenés permisos para administrar estas credenciales.'
  if (status === 404) return 'No se encontró el tenant asociado a la sesión.'
  if (status === 422) return 'Los datos ingresados no cumplen el contrato de credenciales Finnegans.'

  return action === 'load'
    ? 'No se pudo consultar el estado de las credenciales Finnegans.'
    : 'No se pudieron guardar las credenciales Finnegans.'
}

const FinnegansCredentialsSettings = () => {
  const { user } = useAuth()
  const tenantId = user?.tenant_id
  const [credentialsStatus, setCredentialsStatus] = useState(null)
  const [formValues, setFormValues] = useState(EMPTY_FORM)
  const [loading, setLoading] = useState(Boolean(tenantId))
  const [saving, setSaving] = useState(false)
  const [loadError, setLoadError] = useState('')
  const [saveMessage, setSaveMessage] = useState({ type: '', text: '' })
  const [reloadKey, setReloadKey] = useState(0)

  useEffect(() => {
    if (!tenantId) return undefined

    let active = true

    finnegansCredentialsService.getTenantFinnegansCredentials(tenantId)
      .then((status) => {
        if (!active) return

        setCredentialsStatus(status)
        setFormValues((current) => ({
          ...current,
          client_id: status?.client_id ?? '',
          client_secret: '',
          base_url: status?.base_url ?? '',
        }))
        setLoadError('')
      })
      .catch((error) => {
        if (!active) return
        setLoadError(getRequestErrorMessage(error, 'load'))
      })
      .finally(() => {
        if (active) setLoading(false)
      })

    return () => {
      active = false
    }
  }, [reloadKey, tenantId])

  const handleChange = (field) => (event) => {
    const value = event.target.value
    setFormValues((current) => ({ ...current, [field]: value }))
    setSaveMessage({ type: '', text: '' })
  }

  const handleReload = () => {
    if (!tenantId) return
    setLoading(true)
    setLoadError('')
    setReloadKey((current) => current + 1)
  }

  const handleSubmit = async (event) => {
    event.preventDefault()

    if (!tenantId) {
      setSaveMessage({
        type: 'error',
        text: 'No se pudo determinar el tenant actual. No se enviaron credenciales.',
      })
      return
    }

    setSaving(true)
    setSaveMessage({ type: '', text: '' })

    try {
      const status = await finnegansCredentialsService.updateTenantFinnegansCredentials(
        tenantId,
        formValues,
      )

      setCredentialsStatus(status)
      setFormValues((current) => ({
        ...current,
        client_id: status?.client_id ?? current.client_id,
        client_secret: '',
        base_url: status?.base_url ?? '',
      }))
      setSaveMessage({
        type: 'success',
        text: 'Credenciales Finnegans guardadas correctamente.',
      })
    } catch (error) {
      setSaveMessage({
        type: 'error',
        text: getRequestErrorMessage(error, 'save'),
      })
    } finally {
      setSaving(false)
    }
  }

  const missingTenant = !tenantId
  const hasCredentials = credentialsStatus?.has_credentials === true

  return (
    <Card
      className="xl:col-span-2"
      title="Credenciales Finnegans"
      description="Configura las credenciales de destino compartidas por las integraciones del tenant."
    >
      <div className="space-y-6">
        {missingTenant ? (
          <Alert
            variant="error"
            title="Tenant no disponible"
            description="La sesión actual no contiene tenant_id. No se realizarán llamadas de credenciales."
          />
        ) : null}

        {loadError ? (
          <Alert variant="error" title="No se pudo consultar el estado" description={loadError} />
        ) : null}

        <div className="flex flex-col gap-4 rounded-2xl border border-slate-200 bg-slate-50 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-semibold text-slate-900">
              {loading
                ? 'Consultando credenciales...'
                : hasCredentials
                  ? 'Credenciales configuradas'
                  : 'Credenciales no configuradas'}
            </p>
            <p className="mt-1 text-sm text-slate-600">
              {hasCredentials
                ? 'El secret es write-only y no se muestra por seguridad.'
                : 'Ingresá las credenciales para habilitar la entrega hacia Finnegans.'}
            </p>
          </div>
          <Button
            type="button"
            variant="outline"
            onClick={handleReload}
            loading={loading}
            disabled={missingTenant || saving}
          >
            Consultar estado
          </Button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="grid gap-5 md:grid-cols-2">
            <Input
              id="finnegans-client-id"
              label="Client ID"
              value={formValues.client_id}
              onChange={handleChange('client_id')}
              autoComplete="off"
              required
              disabled={missingTenant || saving}
            />
            <Input
              id="finnegans-client-secret"
              label={hasCredentials ? 'Nuevo client secret' : 'Client secret'}
              type="password"
              value={formValues.client_secret}
              onChange={handleChange('client_secret')}
              autoComplete="new-password"
              helperText="Write-only: nunca se recupera ni se muestra desde el backend."
              required
              disabled={missingTenant || saving}
            />
          </div>

          <Input
            id="finnegans-base-url"
            label="Base URL opcional"
            type="url"
            value={formValues.base_url}
            onChange={handleChange('base_url')}
            placeholder="https://api.finneg.com"
            helperText="Si se omite, el backend utiliza la URL global configurada."
            disabled={missingTenant || saving}
          />

          {saveMessage.text ? (
            <Alert
              variant={saveMessage.type === 'success' ? 'success' : 'error'}
              title={saveMessage.type === 'success' ? 'Credenciales actualizadas' : 'Error al guardar'}
              description={saveMessage.text}
            />
          ) : null}

          <div className="flex flex-col gap-3 border-t border-slate-200 pt-4 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-slate-500">
              Credenciales específicas por integración: futuro override, fuera de este PR.
            </p>
            <Button type="submit" loading={saving} disabled={missingTenant || loading}>
              {hasCredentials ? 'Reemplazar credenciales' : 'Guardar credenciales'}
            </Button>
          </div>
        </form>
      </div>
    </Card>
  )
}

export default FinnegansCredentialsSettings
