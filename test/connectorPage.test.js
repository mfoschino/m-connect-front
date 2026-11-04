import assert from 'node:assert/strict'
import { after, before, test } from 'node:test'
import { createElement, isValidElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { MemoryRouter } from 'react-router-dom'
import { createServer } from 'vite'
import { getIamPermissions } from '../src/services/auth/iamPermissions.js'
import { initialConnectorReadState } from '../src/services/connectorReadFlow.js'
import { definition, installation } from './connectorFixtures.js'

let vite
let ConnectorsPage
let ConnectorsContent
let InstallationDetail
let AuthContext
let Sidebar
let AppRoutes
before(async () => {
  vite = await createServer({ appType: 'custom', logLevel: 'silent', configLoader: 'runner',
    server: { middlewareMode: true } })
  const page = await vite.ssrLoadModule('/src/pages/connectors/ConnectorsPage.jsx')
  ConnectorsPage = page.default
  ConnectorsContent = page.ConnectorsContent
  InstallationDetail = page.InstallationDetail
  AuthContext = (await vite.ssrLoadModule('/src/context/AuthContext.jsx')).default
  Sidebar = (await vite.ssrLoadModule('/src/components/common/Sidebar.jsx')).default
  AppRoutes = (await vite.ssrLoadModule('/src/app/router/routes.jsx')).default
})
after(async () => { await vite?.close() })

const auth = (role = 'viewer', extra = {}) => ({ status: 'authenticated', contextId: 'context-a',
  user: { id: 'user-a', tenant_id: 'tenant-a', role }, ...extra })
const renderWithAuth = (Component, value) => renderToStaticMarkup(createElement(AuthContext.Provider,
  { value }, createElement(MemoryRouter, { initialEntries: ['/connectors'] }, createElement(Component))))
const emptyFilters = { search: '', kind: '', status: '', definitionId: '', availability: '' }
const noop = () => {}
const contentProps = (extra = {}) => ({ directory: initialConnectorReadState(), activeView: 'installations',
  filters: emptyFilters, onViewChange: noop, onFilterChange: noop, onRefresh: noop, onOpenDetail: noop,
  onCloseDetail: noop, onRetryDetail: noop, ...extra })
const renderContent = (extra) => renderToStaticMarkup(createElement(ConnectorsContent, contentProps(extra)))
const loaded = (data = []) => ({ data, loading: false, error: '' })
const directory = () => ({ installations: loaded([installation()]), definitions: loaded([definition()]),
  detail: initialConnectorReadState().detail })

test('loading, error con retry, vacío real y sin resultados tienen presentaciones distintas', () => {
  assert.match(renderContent(), /Cargando las instalaciones/)
  assert.doesNotMatch(renderContent(), /Todavía no hay instalaciones/)
  const data = directory()
  data.installations = { data: [], loading: false, error: 'No tenés permiso para consultar conectores.' }
  const error = renderContent({ directory: data })
  assert.match(error, /No tenés permiso/)
  assert.match(error, />Reintentar</)
  assert.doesNotMatch(error, /Todavía no hay instalaciones/)
  data.installations = loaded([])
  assert.match(renderContent({ directory: data }), /Todavía no hay instalaciones/)
  data.installations = loaded([installation()])
  assert.match(renderContent({ directory: data, filters: { ...emptyFilters, search: 'sin-match' } }), /No hay resultados/)
  assert.doesNotMatch(renderContent({ directory: data }), /No hay resultados/)
})

test('catálogo presenta definiciones con code null y su disponibilidad sin acciones de instalación', () => {
  const data = directory()
  data.definitions = loaded([definition('a', { name: 'Disponible A' }),
    definition('b', { name: 'Privado B', visibility: 'private', owner_tenant_id: 'tenant-a', active_version: null }),
    definition('c', { name: 'Inactivo C', is_active: false })])
  const html = renderContent({ directory: data, activeView: 'definitions' })
  for (const value of ['Disponible A', 'Privado B', 'Inactivo C', 'Sin publicar', 'Desactivado']) assert.ok(html.includes(value))
  assert.doesNotMatch(html, />(?:Instalar|Crear|Editar|Eliminar|Activar|Desactivar|Probar conexión)</)
  data.definitions = loaded([])
  assert.match(renderContent({ directory: data, activeView: 'definitions' }), /No hay conectores en el catálogo/)
})

test('un filtro cuyo conector desapareció tras recargar sigue visible y puede limpiarse', () => {
  const html = renderContent({ directory: directory(), filters: { ...emptyFilters, definitionId: 'removed' } })
  assert.match(html, /value="removed" selected="">Conector fuera del listado/)
  assert.match(html, /No hay resultados/)
  assert.match(html, /option value="">Todos/)
})

test('detalle y listado presentan sólo datos permitidos incluso si reciben un objeto con secretos', () => {
  const unsafe = installation('a', { name: 'Cuenta ACME', config: { headers: { Authorization: 'BEARER-SECRET' },
    connection_string: 'DSN-SECRET' }, secrets: { auth_token: 'TOKEN-SECRET' }, secrets_enc: 'ENC-SECRET',
    integration_form: [{ default: 'FORM-SECRET' }] })
  const data = directory()
  data.installations = loaded([unsafe])
  data.detail = { open: true, id: 'a', data: unsafe, loading: false, error: '' }
  const html = renderContent({ directory: data })
  assert.match(html, /Cuenta ACME/)
  assert.match(html, /API de pedidos/)
  assert.match(html, /Versión fijada/)
  assert.match(html, /1 campo\(s\) secreto\(s\) cargado\(s\)/)
  assert.doesNotMatch(html, /BEARER-SECRET|DSN-SECRET|TOKEN-SECRET|ENC-SECRET|FORM-SECRET|<pre|type="password"/)
  assert.doesNotMatch(html, />(?:Crear|Editar|Eliminar|Activar|Desactivar|Probar conexión)</)
})

test('detalle loading, 404 y sin datos no presentan una instalación anterior', () => {
  const render = (detail) => renderToStaticMarkup(createElement(InstallationDetail,
    { detail, onRetry: noop, onClose: noop }))
  const base = { open: true, id: 'a', data: null, loading: false, error: '' }
  assert.match(render({ ...base, loading: true }), /Cargando el detalle/)
  assert.match(render({ ...base, error: 'La instalación no existe o no está disponible.' }), /no existe/)
  assert.match(render({ ...base, error: 'La instalación no existe.' }), />Reintentar</)
  assert.match(render(base), /detalle de la instalación no está disponible/)
  assert.equal(render({ ...base, open: false }), '')
})

test('permisos, sidebar y ruta permiten consulta para roles del tenant y soporte', () => {
  for (const role of ['viewer', 'operator', 'admin', 'VIEWER']) {
    const value = auth(role)
    assert.equal(getIamPermissions(value).canViewConnectors, true)
    assert.match(renderWithAuth(ConnectorsPage, value), /Conexiones de tu organización/)
    assert.match(renderWithAuth(Sidebar, value), /href="\/connectors"/)
  }
  for (const [level, role] of [['read_only', 'viewer'], ['full', 'admin']]) {
    const value = auth(role)
    value.user.platform_role = 'superadmin'
    value.user.support_session = { id: 'support-a', tenant_id: 'tenant-a', access_level: level }
    assert.equal(getIamPermissions(value).canViewConnectors, true)
    assert.match(renderWithAuth(ConnectorsPage, value), /Conexiones de tu organización/)
  }
  assert.match(renderWithAuth(AppRoutes, auth()), /Conexiones de tu organización/)
})

test('sin tenant, sin rol válido o durante cambio IAM no hay acceso ni enlace de conectores', () => {
  const invalid = [auth('owner'), auth(null), auth('viewer', { status: 'switching' }),
    auth('viewer', { status: 'anonymous', user: null }),
    auth('admin', { user: { id: 'superadmin', platform_role: 'superadmin', role: 'admin', tenant_id: null } })]
  for (const value of invalid) {
    assert.equal(getIamPermissions(value).canViewConnectors, false)
    assert.match(renderWithAuth(ConnectorsPage, value), /Consulta no disponible/)
    assert.doesNotMatch(renderWithAuth(Sidebar, value), /href="\/connectors"/)
  }
  assert.match(renderWithAuth(ConnectorsPage, auth('admin', { contextId: null })), /Consulta no disponible/)
  assert.match(renderWithAuth(AppRoutes, auth('owner')), /No tenés permiso/)
})

test('tenant, contexto IAM, usuario o rol nuevos generan una sesión de pantalla nueva', () => {
  const sessions = []
  const Probe = () => {
    const element = ConnectorsPage()
    sessions.push(element)
    return element
  }
  const a = auth()
  const variants = [a, { ...a, contextId: 'context-b' },
    { ...a, user: { ...a.user, tenant_id: 'tenant-b' } },
    { ...a, user: { ...a.user, id: 'user-b' } },
    { ...a, user: { ...a.user, role: 'admin' } }]
  for (const value of variants) {
    const html = renderWithAuth(Probe, value)
    assert.match(html, /Cargando las instalaciones/)
    assert.doesNotMatch(html, /Detalle de la instalación|Cuenta ACME/)
  }
  assert.equal(new Set(sessions.map((element) => element.key)).size, variants.length)
  assert.equal(sessions[2].props.tenantId, 'tenant-b')
})

test('los controles de consulta conectan selección, recarga, retry y cierre a sus callbacks', () => {
  const calls = []
  const data = directory()
  const tree = ConnectorsContent(contentProps({ directory: data,
    onViewChange: (view) => calls.push(view), onRefresh: () => calls.push('refresh'),
    onOpenDetail: (id) => calls.push(id), onCloseDetail: () => calls.push('close'),
    onRetryDetail: () => calls.push('retry-detail') }))
  const elements = []
  const visit = (node) => {
    if (Array.isArray(node)) return node.forEach(visit)
    if (!isValidElement(node)) return
    elements.push(node)
    visit(node.props.children)
  }
  visit(tree)
  elements.find((element) => element.props.children === 'Catálogo').props.onClick()
  elements.find((element) => element.props['aria-label'] === 'Ver detalle de Conexión installation-a').props.onClick()
  elements.find((element) => element.props.label === 'las instalaciones').props.onRetry()
  const detail = elements.find((element) => element.type === InstallationDetail)
  detail.props.onClose()
  detail.props.onRetry()
  assert.deepEqual(calls, ['definitions', 'installation-a', 'refresh', 'close', 'retry-detail'])
})
