import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import integrationService from '../../services/api/integrationService'
import profileService from '../../services/api/profileService'
import lookupService from '../../services/api/lookupService'
import executionService from '../../services/api/executionService'
import Badge from '../../components/ui/Badge'
import Button from '../../components/ui/Button'
import Card from '../../components/ui/Card'
import Input from '../../components/ui/Input'
import Modal from '../../components/ui/Modal'
import Table from '../../components/ui/Table'
import IntegrationForm from '../../components/integrations/IntegrationForm'
import ProfileForm from '../../components/integrations/ProfileForm'
import LookupTableForm from '../../components/integrations/LookupTableForm'

const tabOptions = [
  { value: 'integrations', label: 'Integraciones' },
  { value: 'profiles', label: 'Perfiles de mapeo' },
  { value: 'lookupTables', label: 'Tablas de búsqueda' },
]

const statusOptions = [
  { value: 'all', label: 'Todos' },
  { value: 'active', label: 'Activas' },
  { value: 'inactive', label: 'Inactivas' },
]

const connectorOptions = [
  { value: 'all', label: 'Todos' },
  { value: 'api', label: 'API' },
  { value: 'db', label: 'DB' },
  { value: 'file', label: 'File' },
  { value: 'webhook', label: 'Webhook' },
]

const integrationStatusVariant = (isActive) => (isActive === false ? 'offline' : 'online')
const profileStatusVariant = (isActive) => (isActive === false ? 'offline' : 'online')

const formatDateTime = (value) => {
  if (!value) return '—'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '—'
  return date.toLocaleString()
}

const Integrations = () => {
  const [activeTab, setActiveTab] = useState('integrations')
  const [integrations, setIntegrations] = useState([])
  const [profiles, setProfiles] = useState([])
  const [lookupTables, setLookupTables] = useState([])
  const [executions, setExecutions] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [refreshing, setRefreshing] = useState(false)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [connectorFilter, setConnectorFilter] = useState('all')

  const [integrationModalOpen, setIntegrationModalOpen] = useState(false)
  const [integrationModalMode, setIntegrationModalMode] = useState('create')
  const [selectedIntegration, setSelectedIntegration] = useState(null)
  const [integrationModalLoading, setIntegrationModalLoading] = useState(false)
  const [integrationModalError, setIntegrationModalError] = useState(null)
  const [integrationDetailOpen, setIntegrationDetailOpen] = useState(false)
  const [detailIntegration, setDetailIntegration] = useState(null)
  const [detailLoading, setDetailLoading] = useState(false)
  const [detailError, setDetailError] = useState(null)
  const [triggerModalOpen, setTriggerModalOpen] = useState(false)
  const [triggerLoading, setTriggerLoading] = useState(false)
  const [triggerMessage, setTriggerMessage] = useState('')
  const [triggerForm, setTriggerForm] = useState({ source_system: '', source_entity: '', raw_payload: '{}' })

  const [profileModalOpen, setProfileModalOpen] = useState(false)
  const [profileModalMode, setProfileModalMode] = useState('create')
  const [selectedProfile, setSelectedProfile] = useState(null)
  const [profileModalLoading, setProfileModalLoading] = useState(false)
  const [profileModalError, setProfileModalError] = useState(null)
  const [profileDetailOpen, setProfileDetailOpen] = useState(false)
  const [detailProfile, setDetailProfile] = useState(null)

  const [lookupModalOpen, setLookupModalOpen] = useState(false)
  const [lookupModalMode, setLookupModalMode] = useState('create')
  const [selectedLookup, setSelectedLookup] = useState(null)
  const [lookupModalLoading, setLookupModalLoading] = useState(false)
  const [lookupModalError, setLookupModalError] = useState(null)
  const [lookupDetailOpen, setLookupDetailOpen] = useState(false)
  const [detailLookup, setDetailLookup] = useState(null)
  const [lookupDeleteLoading, setLookupDeleteLoading] = useState(false)

  const [successMessage, setSuccessMessage] = useState('')

  const fetchData = async () => {
    setLoading(true)
    setError(null)

    try {
      const [integrationsRes, profilesRes, lookupsRes, executionsRes] = await Promise.all([
        integrationService.listIntegrations(),
        profileService.listProfiles(),
        lookupService.listLookupTables(),
        executionService.listExecutions(),
      ])

      setIntegrations(integrationsRes.data || [])
      setProfiles(profilesRes.data || [])
      setLookupTables(lookupsRes.data || [])
      setExecutions(executionsRes.data || [])
    } catch (err) {
      console.error('Failed to load integrations module data', err)
      setError('No se pudieron cargar los datos del módulo. Intenta recargar.')
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  useEffect(() => {
    let mounted = true

    const loadData = async () => {
      if (!mounted) return
      setLoading(true)
      setError(null)

      try {
        const [integrationsRes, profilesRes, lookupsRes, executionsRes] = await Promise.all([
          integrationService.listIntegrations(),
          profileService.listProfiles(),
          lookupService.listLookupTables(),
          executionService.listExecutions(),
        ])

        if (!mounted) return

        setIntegrations(integrationsRes.data || [])
        setProfiles(profilesRes.data || [])
        setLookupTables(lookupsRes.data || [])
        setExecutions(executionsRes.data || [])
      } catch (err) {
        console.error('Failed to load integrations module data', err)
        if (mounted) {
          setError('No se pudieron cargar los datos del módulo. Intenta recargar.')
        }
      } finally {
        if (mounted) {
          setLoading(false)
          setRefreshing(false)
        }
      }
    }

    loadData()
    return () => {
      mounted = false
    }
  }, [])

  const refreshData = async () => {
    setRefreshing(true)
    await fetchData()
  }

  const filteredIntegrations = useMemo(() => {
    const searchTerm = search.trim().toLowerCase()

    return integrations.filter((integration) => {
      if (statusFilter === 'active' && integration.is_active === false) return false
      if (statusFilter === 'inactive' && integration.is_active !== false) return false
      if (connectorFilter !== 'all' && integration.connector_type !== connectorFilter) return false
      if (!searchTerm) return true

      return [
        integration.name,
        integration.connector_type,
        integration.source_entity,
        integration.schedule,
      ]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(searchTerm))
    })
  }, [integrations, search, statusFilter, connectorFilter])

  const filteredProfiles = useMemo(() => {
    const searchTerm = search.trim().toLowerCase()
    return profiles.filter((profile) => {
      if (statusFilter === 'active' && profile.active === false) return false
      if (statusFilter === 'inactive' && profile.active !== false) return false
      if (!searchTerm) return true

      return [profile.name, profile.source_system, profile.source_entity, profile.version]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(searchTerm))
    })
  }, [profiles, search, statusFilter])

  const filteredLookupTables = useMemo(() => {
    const searchTerm = search.trim().toLowerCase()
    if (!searchTerm) return lookupTables
    return lookupTables.filter((lookup) => [lookup.name, lookup.id]
      .filter(Boolean)
      .some((value) => String(value).toLowerCase().includes(searchTerm)))
  }, [lookupTables, search])

  const relatedProfilesForIntegration = useMemo(() => {
    if (!detailIntegration) return []
    return profiles.filter((profile) => profile.source_entity === detailIntegration.source_entity)
  }, [profiles, detailIntegration])

  const integrationExecutions = useMemo(() => {
    if (!detailIntegration) return []
    return executions.filter((execution) => execution.integration_id === detailIntegration.id)
  }, [executions, detailIntegration])

  const openIntegrationCreate = () => {
    setIntegrationModalMode('create')
    setSelectedIntegration(null)
    setIntegrationModalError(null)
    setIntegrationModalOpen(true)
  }

  const openIntegrationEdit = async (integration) => {
    setIntegrationModalMode('edit')
    setIntegrationModalError(null)
    setIntegrationModalLoading(true)
    setSelectedIntegration(null)

    try {
      const response = await integrationService.getIntegration(integration.id)
      setSelectedIntegration(response.data || integration)
      setIntegrationModalOpen(true)
    } catch (err) {
      console.error('Failed to load integration', err)
      setIntegrationModalError('No se pudo cargar la integración. Intenta de nuevo.')
      setSelectedIntegration(integration)
      setIntegrationModalOpen(true)
    } finally {
      setIntegrationModalLoading(false)
    }
  }

  const openIntegrationDetail = async (integration) => {
    setDetailError(null)
    setDetailLoading(true)
    setDetailIntegration(null)
    setIntegrationDetailOpen(true)

    try {
      const response = await integrationService.getIntegration(integration.id)
      setDetailIntegration(response.data || integration)
      setTriggerForm({
        source_system: response.data?.source_system || '',
        source_entity: response.data?.source_entity || integration.source_entity || '',
        raw_payload: '{}',
      })
    } catch (err) {
      console.error('Failed to load integration details', err)
      setDetailError('No se pudieron cargar los detalles de la integración.')
      setDetailIntegration(integration)
      setTriggerForm({
        source_system: integration.source_system || '',
        source_entity: integration.source_entity || '',
        raw_payload: '{}',
      })
    } finally {
      setDetailLoading(false)
    }
  }

  const closeIntegrationModal = () => {
    setIntegrationModalOpen(false)
    setSelectedIntegration(null)
    setIntegrationModalError(null)
  }

  const closeIntegrationDetail = () => {
    setIntegrationDetailOpen(false)
    setDetailIntegration(null)
    setDetailError(null)
    setTriggerMessage('')
  }

  const handleIntegrationSave = async (payload) => {
    setIntegrationModalLoading(true)
    setIntegrationModalError(null)
    setSuccessMessage('')

    try {
      if (integrationModalMode === 'create') {
        await integrationService.createIntegration(payload)
        setSuccessMessage('Integración creada correctamente.')
      } else if (selectedIntegration?.id) {
        await integrationService.updateIntegration(selectedIntegration.id, payload)
        setSuccessMessage('Integración actualizada correctamente.')
      }
      await refreshData()
      closeIntegrationModal()
    } catch (err) {
      console.error('Failed to save integration', err)
      const backendMessage = err?.response?.data?.detail || err?.message
      setIntegrationModalError(backendMessage || 'Error al guardar la integración. Intenta de nuevo.')
    } finally {
      setIntegrationModalLoading(false)
    }
  }

  const handleRunIntegration = async () => {
    if (!detailIntegration?.id) return
    setTriggerLoading(true)
    setTriggerMessage('')

    try {
      const response = await integrationService.runIntegration(detailIntegration.id)
      setTriggerMessage(`Ejecución programada correctamente. Tarea: ${response.data?.task_id || 'sin id'}`)
      await refreshData()
    } catch (err) {
      console.error('Failed to run integration', err)
      setTriggerMessage('Error al iniciar ejecución. Intenta de nuevo.')
    } finally {
      setTriggerLoading(false)
    }
  }

  const openTriggerModal = () => {
    setTriggerMessage('')
    setTriggerModalOpen(true)
    setTriggerForm((previous) => ({
      ...previous,
      raw_payload: '{}',
    }))
  }

  const closeTriggerModal = () => {
    setTriggerModalOpen(false)
    setTriggerMessage('')
  }

  const handleTriggerIntegration = async (event) => {
    event.preventDefault()
    if (!detailIntegration?.id) return

    setTriggerLoading(true)
    setTriggerMessage('')

    try {
      const payload = {
        source_system: triggerForm.source_system,
        entity: triggerForm.source_entity,
        raw_payload: JSON.parse(triggerForm.raw_payload || '{}'),
      }
      const response = await integrationService.triggerIntegration(detailIntegration.id, payload)
      setTriggerMessage(`Mensaje enviado. Trace ID: ${response.data?.trace_id || 'sin id'}`)
      await refreshData()
    } catch (err) {
      console.error('Failed to trigger integration', err)
      setTriggerMessage('Error al enviar trigger. Verifica el JSON o intenta de nuevo.')
    } finally {
      setTriggerLoading(false)
    }
  }

  const openProfileCreate = () => {
    setProfileModalMode('create')
    setSelectedProfile(null)
    setProfileModalError(null)
    setProfileModalOpen(true)
  }

  const openProfileEdit = async (profile) => {
    setProfileModalMode('edit')
    setProfileModalError(null)
    setProfileModalLoading(true)
    setSelectedProfile(null)

    try {
      const response = await profileService.getProfile(profile.id)
      setSelectedProfile(response.data || profile)
      setProfileModalOpen(true)
    } catch (err) {
      console.error('Failed to load profile', err)
      setProfileModalError('No se pudo cargar el perfil. Intenta de nuevo.')
      setSelectedProfile(profile)
      setProfileModalOpen(true)
    } finally {
      setProfileModalLoading(false)
    }
  }

  const closeProfileModal = () => {
    setProfileModalOpen(false)
    setSelectedProfile(null)
    setProfileModalError(null)
  }

  const handleProfileSave = async (payload) => {
    setProfileModalLoading(true)
    setProfileModalError(null)
    setSuccessMessage('')

    try {
      if (profileModalMode === 'create') {
        await profileService.createProfile(payload)
        setSuccessMessage('Perfil de mapeo creado correctamente.')
      } else if (selectedProfile?.id) {
        await profileService.updateProfile(selectedProfile.id, payload)
        setSuccessMessage('Perfil de mapeo actualizado correctamente.')
      }
      await refreshData()
      closeProfileModal()
    } catch (err) {
      console.error('Failed to save profile', err)
      const backendMessage = err?.response?.data?.detail || err?.message
      setProfileModalError(backendMessage || 'Error al guardar el perfil.')
    } finally {
      setProfileModalLoading(false)
    }
  }

  const openProfileDetail = async (profile) => {
    setDetailProfile(null)
    setProfileDetailOpen(true)
    try {
      const response = await profileService.getProfile(profile.id)
      setDetailProfile(response.data || profile)
    } catch (err) {
      console.error('Failed to load profile details', err)
      setDetailProfile(profile)
    }
  }

  const closeProfileDetail = () => {
    setProfileDetailOpen(false)
    setDetailProfile(null)
  }

  const openLookupCreate = () => {
    setLookupModalMode('create')
    setSelectedLookup(null)
    setLookupModalError(null)
    setLookupModalOpen(true)
  }

  const openLookupEdit = async (lookup) => {
    setLookupModalMode('edit')
    setLookupModalError(null)
    setLookupModalLoading(true)
    setSelectedLookup(null)

    try {
      const response = await lookupService.getLookupTable(lookup.id)
      setSelectedLookup(response.data || lookup)
      setLookupModalOpen(true)
    } catch (err) {
      console.error('Failed to load lookup table', err)
      setLookupModalError('No se pudo cargar la tabla. Intenta de nuevo.')
      setSelectedLookup(lookup)
      setLookupModalOpen(true)
    } finally {
      setLookupModalLoading(false)
    }
  }

  const closeLookupModal = () => {
    setLookupModalOpen(false)
    setSelectedLookup(null)
    setLookupModalError(null)
  }

  const handleLookupSave = async (payload) => {
    setLookupModalLoading(true)
    setLookupModalError(null)
    setSuccessMessage('')

    try {
      if (lookupModalMode === 'create') {
        await lookupService.createLookupTable(payload)
        setSuccessMessage('Tabla de búsqueda creada correctamente.')
      } else if (selectedLookup?.id) {
        await lookupService.updateLookupTable(selectedLookup.id, payload)
        setSuccessMessage('Tabla de búsqueda actualizada correctamente.')
      }
      await refreshData()
      closeLookupModal()
    } catch (err) {
      console.error('Failed to save lookup table', err)
      const backendMessage = err?.response?.data?.detail || err?.message
      setLookupModalError(backendMessage || 'Error al guardar la tabla de búsqueda.')
    } finally {
      setLookupModalLoading(false)
    }
  }

  const openLookupDetail = async (lookup) => {
    setDetailLookup(null)
    setLookupDetailOpen(true)
    try {
      const response = await lookupService.getLookupTable(lookup.id)
      setDetailLookup(response.data || lookup)
    } catch (err) {
      console.error('Failed to load lookup table details', err)
      setDetailLookup(lookup)
    }
  }

  const closeLookupDetail = () => {
    setLookupDetailOpen(false)
    setDetailLookup(null)
  }

  const handleDeleteLookup = async (lookup) => {
    if (!window.confirm(`¿Eliminar tabla de búsqueda "${lookup.name}"? Esta acción no se puede revertir.`)) {
      return
    }

    setLookupDeleteLoading(true)
    try {
      await lookupService.deleteLookupTable(lookup.id)
      setSuccessMessage('Tabla de búsqueda eliminada correctamente.')
      await refreshData()
    } catch (err) {
      console.error('Failed to delete lookup table', err)
      setError('No se pudo eliminar la tabla. Intenta de nuevo.')
    } finally {
      setLookupDeleteLoading(false)
    }
  }

  return (
    <div className="space-y-8">
      <div className="space-y-3">
        <p className="text-sm font-semibold uppercase tracking-[0.24em] text-slate-500">Configuración de integración</p>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="section-title">Gestión de integraciones, perfiles y tablas</h2>
            <p className="section-subtitle">
              Todo lo que admite la API actual: integraciones, mapeos de campos y tablas de búsqueda.
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Button variant="outline" onClick={refreshData} loading={refreshing}>
              Refrescar datos
            </Button>
            {activeTab === 'integrations' ? (
              <Button onClick={openIntegrationCreate}>Crear integración</Button>
            ) : activeTab === 'profiles' ? (
              <Button onClick={openProfileCreate}>Crear perfil</Button>
            ) : (
              <Button onClick={openLookupCreate}>Crear tabla</Button>
            )}
          </div>
        </div>
      </div>

      {successMessage ? (
        <div className="rounded-3xl border border-emerald-100 bg-emerald-50 px-5 py-4 text-sm text-emerald-800">
          {successMessage}
        </div>
      ) : null}

      <div className="flex flex-wrap gap-2 rounded-3xl border border-slate-200 bg-slate-50 p-3">
        {tabOptions.map((tab) => (
          <button
            key={tab.value}
            type="button"
            onClick={() => setActiveTab(tab.value)}
            className={`rounded-2xl px-4 py-2 text-sm font-semibold transition ${
              activeTab === tab.value
                ? 'bg-slate-900 text-white shadow-sm'
                : 'bg-white text-slate-600 hover:bg-slate-100'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <Card
        title={activeTab === 'integrations' ? 'Filtros de integraciones' : activeTab === 'profiles' ? 'Filtros de perfiles' : 'Búsqueda de tablas'}
        description={
          activeTab === 'integrations'
            ? 'Busca por nombre, tipo de conector y estado para encontrar integraciones rápidamente.'
            : activeTab === 'profiles'
            ? 'Filtra perfiles por nombre, sistema o entidad de origen.'
            : 'Busca tablas de búsqueda por nombre o ID.'
        }
      >
        <div className="grid gap-4 sm:grid-cols-3">
          <Input
            id="search"
            label="Buscar"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder={
              activeTab === 'integrations'
                ? 'Nombre, entidad o conector...'
                : activeTab === 'profiles'
                ? 'Nombre, sistema o entidad...'
                : 'Nombre o ID de tabla...'
            }
          />
          {activeTab !== 'lookupTables' ? (
            <div className="space-y-2">
              <label htmlFor="status-filter" className="block text-sm font-semibold text-slate-900">
                Estado
              </label>
              <select
                id="status-filter"
                value={statusFilter}
                onChange={(event) => setStatusFilter(event.target.value)}
                className="form-input w-full"
              >
                {statusOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
          ) : null}
          {activeTab === 'integrations' ? (
            <div className="space-y-2">
              <label htmlFor="connector-filter" className="block text-sm font-semibold text-slate-900">
                Tipo de conector
              </label>
              <select
                id="connector-filter"
                value={connectorFilter}
                onChange={(event) => setConnectorFilter(event.target.value)}
                className="form-input w-full"
              >
                {connectorOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
          ) : null}
        </div>
        {error ? <p className="mt-3 text-sm font-medium text-red-600">{error}</p> : null}
      </Card>

      {activeTab === 'integrations' ? (
        <Card title="Integraciones registradas" description="Estado actual de las integraciones, programación y últimos eventos.">
          <div className="overflow-x-auto">
            <Table>
              <thead>
                <tr>
                  <th>Nombre</th>
                  <th>Conector</th>
                  <th>Entidad</th>
                  <th>Programación</th>
                  <th>Estado</th>
                  <th>Última ejecución</th>
                  <th>Próxima ejecución</th>
                  <th>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {filteredIntegrations.length === 0 ? (
                  <tr>
                    <td colSpan="8" className="px-6 py-4 text-center text-sm text-slate-500">
                      {loading ? 'Cargando integraciones...' : 'No se encontraron integraciones.'}
                    </td>
                  </tr>
                ) : (
                  filteredIntegrations.map((integration) => (
                    <tr key={integration.id} className="hover:bg-slate-50">
                      <td className="font-medium text-slate-900">{integration.name || '—'}</td>
                      <td>{integration.connector_type || '—'}</td>
                      <td>{integration.source_entity || '—'}</td>
                      <td>{integration.schedule || 'Manual'}</td>
                      <td>
                        <Badge variant={integrationStatusVariant(integration.is_active)}>
                          {integration.is_active === false ? 'Inactiva' : 'Activa'}
                        </Badge>
                      </td>
                      <td>{formatDateTime(integration.last_run_at)}</td>
                      <td>{formatDateTime(integration.next_run_at)}</td>
                      <td className="flex flex-wrap gap-2">
                        <Button variant="outline" className="rounded-full px-3 py-1 text-sm" onClick={() => openIntegrationDetail(integration)}>
                          Detalles
                        </Button>
                        <Button variant="outline" className="rounded-full px-3 py-1 text-sm" onClick={() => openIntegrationEdit(integration)}>
                          Editar
                        </Button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </Table>
          </div>
        </Card>
      ) : activeTab === 'profiles' ? (
        <Card title="Perfiles de mapeo" description="Administra los perfiles de transformación y su estado activo.">
          <div className="overflow-x-auto">
            <Table>
              <thead>
                <tr>
                  <th>Nombre</th>
                  <th>Sistema origen</th>
                  <th>Entidad</th>
                  <th>Versión</th>
                  <th>Estado</th>
                  <th>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {filteredProfiles.length === 0 ? (
                  <tr>
                    <td colSpan="6" className="px-6 py-4 text-center text-sm text-slate-500">
                      {loading ? 'Cargando perfiles...' : 'No se encontraron perfiles.'}
                    </td>
                  </tr>
                ) : (
                  filteredProfiles.map((profile) => (
                    <tr key={profile.id} className="hover:bg-slate-50">
                      <td className="font-medium text-slate-900">{profile.name || '—'}</td>
                      <td>{profile.source_system || '—'}</td>
                      <td>{profile.source_entity || '—'}</td>
                      <td>{profile.version || '—'}</td>
                      <td>
                        <Badge variant={profileStatusVariant(profile.active)}>
                          {profile.active === false ? 'Inactivo' : 'Activo'}
                        </Badge>
                      </td>
                      <td className="flex flex-wrap gap-2">
                        <Button variant="outline" className="rounded-full px-3 py-1 text-sm" onClick={() => openProfileDetail(profile)}>
                          Ver
                        </Button>
                        <Button variant="outline" className="rounded-full px-3 py-1 text-sm" onClick={() => openProfileEdit(profile)}>
                          Editar
                        </Button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </Table>
          </div>
        </Card>
      ) : (
        <Card title="Tablas de búsqueda" description="Gestione tablas de búsqueda reutilizables para transformaciones y reglas.">
          <div className="overflow-x-auto">
            <Table>
              <thead>
                <tr>
                  <th>Nombre</th>
                  <th>ID</th>
                  <th>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {filteredLookupTables.length === 0 ? (
                  <tr>
                    <td colSpan="3" className="px-6 py-4 text-center text-sm text-slate-500">
                      {loading ? 'Cargando tablas...' : 'No se encontraron tablas de búsqueda.'}
                    </td>
                  </tr>
                ) : (
                  filteredLookupTables.map((lookup) => (
                    <tr key={lookup.id} className="hover:bg-slate-50">
                      <td className="font-medium text-slate-900">{lookup.name || '—'}</td>
                      <td>{lookup.id || '—'}</td>
                      <td className="flex flex-wrap gap-2">
                        <Button variant="outline" className="rounded-full px-3 py-1 text-sm" onClick={() => openLookupDetail(lookup)}>
                          Ver
                        </Button>
                        <Button variant="outline" className="rounded-full px-3 py-1 text-sm" onClick={() => openLookupEdit(lookup)}>
                          Editar
                        </Button>
                        <Button
                          variant="ghost"
                          className="rounded-full px-3 py-1 text-sm text-rose-600"
                          onClick={() => handleDeleteLookup(lookup)}
                          disabled={lookupDeleteLoading}
                        >
                          Eliminar
                        </Button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </Table>
          </div>
        </Card>
      )}

      <Modal open={integrationModalOpen} size="large" title={integrationModalMode === 'create' ? 'Crear nueva integración' : 'Editar integración'} subtitle={integrationModalMode === 'create' ? 'Set up a new integration in just a few steps' : 'Update your integration configuration'} onClose={closeIntegrationModal} footer={null}>
        {integrationModalLoading && integrationModalMode === 'edit' && !selectedIntegration ? (
          <div className="py-20 text-center text-slate-600">Cargando integración...</div>
        ) : (
          <IntegrationForm
            key={selectedIntegration?.id || integrationModalMode}
            mode={integrationModalMode}
            defaultValues={selectedIntegration || {}}
            onSubmit={handleIntegrationSave}
            onCancel={closeIntegrationModal}
            loading={integrationModalLoading}
            errorMessage={integrationModalError}
          />
        )}
      </Modal>

      <Modal open={integrationDetailOpen} title={detailIntegration ? `Detalles de ${detailIntegration.name}` : 'Detalles de integración'} onClose={closeIntegrationDetail} footer={null}>
        {detailLoading ? (
          <div className="py-20 text-center text-slate-600">Cargando detalles...</div>
        ) : detailError ? (
          <div className="text-sm text-red-600">{detailError}</div>
        ) : detailIntegration ? (
          <div className="space-y-6">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="rounded-3xl border border-slate-200 bg-slate-50 p-4">
                <h3 className="text-base font-semibold text-slate-900">Visión general</h3>
                <dl className="mt-4 grid gap-3 text-sm text-slate-700">
                  <div>
                    <dt className="font-medium text-slate-900">Nombre</dt>
                    <dd>{detailIntegration.name || '—'}</dd>
                  </div>
                  <div>
                    <dt className="font-medium text-slate-900">Conector</dt>
                    <dd>{detailIntegration.connector_type || '—'}</dd>
                  </div>
                  <div>
                    <dt className="font-medium text-slate-900">Entidad</dt>
                    <dd>{detailIntegration.source_entity || '—'}</dd>
                  </div>
                  <div>
                    <dt className="font-medium text-slate-900">Estado</dt>
                    <dd>
                      <Badge variant={integrationStatusVariant(detailIntegration.is_active)}>
                        {detailIntegration.is_active === false ? 'Inactiva' : 'Activa'}
                      </Badge>
                    </dd>
                  </div>
                </dl>
              </div>
              <div className="rounded-3xl border border-slate-200 bg-slate-50 p-4">
                <h3 className="text-base font-semibold text-slate-900">Programación</h3>
                <dl className="mt-4 grid gap-3 text-sm text-slate-700">
                  <div>
                    <dt className="font-medium text-slate-900">Cron</dt>
                    <dd>{detailIntegration.schedule || 'Manual'}</dd>
                  </div>
                  <div>
                    <dt className="font-medium text-slate-900">Última ejecución</dt>
                    <dd>{formatDateTime(detailIntegration.last_run_at)}</dd>
                  </div>
                  <div>
                    <dt className="font-medium text-slate-900">Próxima ejecución</dt>
                    <dd>{formatDateTime(detailIntegration.next_run_at)}</dd>
                  </div>
                </dl>
              </div>
            </div>

            <div className="rounded-3xl border border-slate-200 bg-slate-50 p-4">
              <h3 className="text-base font-semibold text-slate-900">Configuración de conector</h3>
              <pre className="mt-3 max-h-72 overflow-auto rounded-2xl bg-slate-950 p-4 text-xs text-slate-100">{JSON.stringify(detailIntegration.config, null, 2) || 'No hay configuración disponible.'}</pre>
            </div>

            <div className="rounded-3xl border border-slate-200 bg-slate-50 p-4">
              <h3 className="text-base font-semibold text-slate-900">Perfiles relacionados</h3>
              {relatedProfilesForIntegration.length > 0 ? (
                <div className="mt-4 space-y-2">
                  {relatedProfilesForIntegration.map((profile) => (
                    <div key={profile.id} className="rounded-2xl border border-slate-200 bg-white px-4 py-3">
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <p className="font-semibold text-slate-900">{profile.name}</p>
                          <p className="text-sm text-slate-500">
                            {profile.source_system || 'Sistema desconocido'} · {profile.source_entity}
                          </p>
                        </div>
                        <Badge variant={profileStatusVariant(profile.active)}>{profile.active === false ? 'Inactivo' : 'Activo'}</Badge>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="mt-4 text-sm text-slate-500">No se encuentran perfiles relacionados por entidad de origen.</p>
              )}
              <p className="mt-4 text-sm text-slate-500">
                Nota: la relación se muestra según la entidad de origen. Si necesitas asociación más precisa, asegúrate de revisar fuente/sistema y entidad.
              </p>
            </div>

            <div className="rounded-3xl border border-slate-200 bg-slate-50 p-4">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h3 className="text-base font-semibold text-slate-900">Historial de ejecuciones</h3>
                  <p className="mt-1 text-sm text-slate-500">Últimas ejecuciones relacionadas con esta integración.</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button variant="outline" onClick={handleRunIntegration} loading={triggerLoading}>
                    Ejecutar ahora
                  </Button>
                  <Button onClick={openTriggerModal}>Trigger de prueba</Button>
                </div>
              </div>
              {integrationExecutions.length === 0 ? (
                <p className="mt-4 text-sm text-slate-500">No hay ejecuciones registradas para esta integración.</p>
              ) : (
                <div className="mt-4 overflow-x-auto">
                  <Table>
                    <thead>
                      <tr>
                        <th>Trace ID</th>
                        <th>Estado</th>
                        <th>Sistema</th>
                        <th>Entidad</th>
                        <th>Creado</th>
                      </tr>
                    </thead>
                    <tbody>
                      {integrationExecutions.slice(0, 8).map((execution) => (
                        <tr key={execution.trace_id} className="hover:bg-slate-50">
                          <td className="font-medium text-slate-900">
                            <Link className="text-slate-900 underline" to={`/executions/${execution.trace_id}`}>
                              {execution.trace_id}
                            </Link>
                          </td>
                          <td>{execution.status || '—'}</td>
                          <td>{execution.source_system || '—'}</td>
                          <td>{execution.entity || '—'}</td>
                          <td>{formatDateTime(execution.created_at)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </Table>
                </div>
              )}
            </div>

            <div className="rounded-3xl border border-amber-200 bg-amber-50 p-4">
              <h3 className="text-base font-semibold text-amber-900">Funciones API no cubiertas aún</h3>
              <ul className="mt-3 list-disc space-y-2 pl-5 text-sm text-amber-900">
                <li>Visor de orquestación de workflows no disponible en la API actual.</li>
                <li>Editor visual de mapeo/bloques de transformación requiere metadatos adicionales.</li>
                <li>Relación directa entre integración y perfil sólo puede inferirse por entidad.</li>
              </ul>
            </div>
          </div>
        ) : null}
      </Modal>

      <Modal open={triggerModalOpen} title="Enviar trigger de prueba" onClose={closeTriggerModal} footer={null}>
        <form onSubmit={handleTriggerIntegration} className="space-y-5">
          <div className="grid gap-4 sm:grid-cols-2">
            <Input
              id="trigger-source-system"
              label="Sistema origen"
              value={triggerForm.source_system}
              onChange={(event) => setTriggerForm((current) => ({ ...current, source_system: event.target.value }))}
              required
            />
            <Input
              id="trigger-entity"
              label="Entidad"
              value={triggerForm.source_entity}
              onChange={(event) => setTriggerForm((current) => ({ ...current, source_entity: event.target.value }))}
              required
            />
          </div>
          <div className="space-y-2">
            <label htmlFor="trigger-payload" className="block text-sm font-semibold text-slate-900">
              Payload JSON
            </label>
            <textarea
              id="trigger-payload"
              value={triggerForm.raw_payload}
              onChange={(event) => setTriggerForm((current) => ({ ...current, raw_payload: event.target.value }))}
              className="form-input min-h-[240px] font-mono text-sm"
              aria-label="Payload JSON"
            />
          </div>
          {triggerMessage ? <p className="text-sm text-slate-700">{triggerMessage}</p> : null}
          <div className="flex items-center justify-end gap-3 border-t border-slate-200 pt-4">
            <Button type="button" variant="outline" onClick={closeTriggerModal}>
              Cancelar
            </Button>
            <Button type="submit" loading={triggerLoading}>
              Enviar trigger
            </Button>
          </div>
        </form>
      </Modal>

      <Modal open={profileModalOpen} title={profileModalMode === 'create' ? 'Crear nuevo perfil' : 'Editar perfil'} onClose={closeProfileModal} footer={null}>
        {profileModalLoading && profileModalMode === 'edit' && !selectedProfile ? (
          <div className="py-20 text-center text-slate-600">Cargando perfil...</div>
        ) : (
          <ProfileForm
            key={selectedProfile?.id || profileModalMode}
            initialValues={selectedProfile || {}}
            onSubmit={handleProfileSave}
            onCancel={closeProfileModal}
            submitLabel={profileModalMode === 'create' ? 'Crear perfil' : 'Guardar cambios'}
          />
        )}
        {profileModalError ? <p className="mt-4 text-sm font-medium text-red-600">{profileModalError}</p> : null}
      </Modal>

      <Modal open={profileDetailOpen} title={detailProfile ? `Perfil ${detailProfile.name}` : 'Detalle del perfil'} onClose={closeProfileDetail} footer={null}>
        {detailProfile ? (
          <div className="space-y-6">
            <dl className="grid gap-4 sm:grid-cols-2 text-sm text-slate-700">
              <div>
                <dt className="font-medium text-slate-900">Nombre</dt>
                <dd>{detailProfile.name || '—'}</dd>
              </div>
              <div>
                <dt className="font-medium text-slate-900">Sistema origen</dt>
                <dd>{detailProfile.source_system || '—'}</dd>
              </div>
              <div>
                <dt className="font-medium text-slate-900">Entidad</dt>
                <dd>{detailProfile.source_entity || '—'}</dd>
              </div>
              <div>
                <dt className="font-medium text-slate-900">Versión</dt>
                <dd>{detailProfile.version || '—'}</dd>
              </div>
              <div>
                <dt className="font-medium text-slate-900">Activo</dt>
                <dd>{detailProfile.active === false ? 'No' : 'Sí'}</dd>
              </div>
            </dl>
            <div className="rounded-3xl border border-slate-200 bg-slate-50 p-4">
              <h3 className="text-base font-semibold text-slate-900">Configuración del perfil</h3>
              <pre className="mt-3 max-h-72 overflow-auto rounded-2xl bg-slate-950 p-4 text-xs text-slate-100">
                {JSON.stringify(detailProfile.config, null, 2) || 'No hay configuración disponible.'}
              </pre>
            </div>
            <div className="rounded-3xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950">
              <p>
                Esta vista usa los campos que expone la API actual. Para un editor visual de mapeo y previas de transformación, se requiere metadatos adicionales del backend.
              </p>
            </div>
          </div>
        ) : (
          <div className="py-20 text-center text-slate-600">Cargando perfil...</div>
        )}
      </Modal>

      <Modal open={lookupModalOpen} title={lookupModalMode === 'create' ? 'Crear nueva tabla' : 'Editar tabla'} onClose={closeLookupModal} footer={null}>
        {lookupModalLoading && lookupModalMode === 'edit' && !selectedLookup ? (
          <div className="py-20 text-center text-slate-600">Cargando tabla...</div>
        ) : (
          <LookupTableForm
            key={selectedLookup?.id || lookupModalMode}
            initialValues={selectedLookup || {}}
            onSubmit={handleLookupSave}
            onCancel={closeLookupModal}
            submitLabel={lookupModalMode === 'create' ? 'Crear tabla' : 'Guardar cambios'}
          />
        )}
        {lookupModalError ? <p className="mt-4 text-sm font-medium text-red-600">{lookupModalError}</p> : null}
      </Modal>

      <Modal open={lookupDetailOpen} title={detailLookup ? `Tabla ${detailLookup.name}` : 'Detalle de tabla'} onClose={closeLookupDetail} footer={null}>
        {detailLookup ? (
          <div className="space-y-6">
            <div className="grid gap-4 sm:grid-cols-2 text-sm text-slate-700">
              <div>
                <dt className="font-medium text-slate-900">Nombre</dt>
                <dd>{detailLookup.name || '—'}</dd>
              </div>
              <div>
                <dt className="font-medium text-slate-900">ID</dt>
                <dd>{detailLookup.id || '—'}</dd>
              </div>
            </div>
            <div className="rounded-3xl border border-slate-200 bg-slate-50 p-4">
              <h3 className="text-base font-semibold text-slate-900">Entradas</h3>
              <pre className="mt-3 max-h-72 overflow-auto rounded-2xl bg-slate-950 p-4 text-xs text-slate-100">
                {JSON.stringify(detailLookup.entries, null, 2) || 'No hay entradas definidas.'}
              </pre>
            </div>
          </div>
        ) : (
          <div className="py-20 text-center text-slate-600">Cargando tabla...</div>
        )}
      </Modal>
    </div>
  )
}

export default Integrations
