import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { MemoryRouter } from 'react-router-dom'
import { createServer } from 'vite'
import { getIamPermissions } from '../src/services/auth/iamPermissions.js'

const auth = (role, tenantId = 'tenant-a', extra = {}) => ({
  status: 'authenticated', contextId: `context-${tenantId}`,
  user: { id: 'user', tenant_id: tenantId, role, platform_role: null,
    memberships: [], support_session: null, ...extra },
  switchTenant: async () => {}, logout: async () => {}, error: null,
})

test('lectura de ejecuciones y administración de credenciales siguen el contrato por rol', () => {
  for (const role of ['viewer', 'operator', 'admin']) {
    const permissions = getIamPermissions(auth(role))
    assert.equal(permissions.canViewExecutions, true)
    assert.equal(permissions.canViewSettings, true)
    assert.equal(permissions.canViewUserAdmin, role === 'admin')
    assert.equal(permissions.canViewFinnegansCredentials, role === 'admin')
    assert.equal(permissions.canManageFinnegansCredentials, role === 'admin')
  }
  const readOnlySupport = getIamPermissions(auth('viewer', 'tenant-a', {
    platform_role: 'superadmin', support_session: {
      id: 'support', tenant_id: 'tenant-a', access_level: 'read_only',
    },
  }))
  assert.equal(readOnlySupport.canViewFinnegansCredentials, true)
  assert.equal(readOnlySupport.canManageFinnegansCredentials, false)

  const fullSupport = getIamPermissions(auth('admin', 'tenant-a', {
    platform_role: 'superadmin', support_session: {
      id: 'support', tenant_id: 'tenant-a', access_level: 'full',
    },
  }))
  assert.equal(fullSupport.canViewFinnegansCredentials, true)
  assert.equal(fullSupport.canManageFinnegansCredentials, true)

  for (const session of [auth(null, null, { platform_role: 'superadmin' }),
    { ...auth('admin'), status: 'switching' }, auth('viewer', 'tenant-a', {
      support_session: { tenant_id: 'tenant-b', access_level: 'read_only' },
    })]) {
    const permissions = getIamPermissions(session)
    assert.equal(permissions.canManageFinnegansCredentials, false)
    assert.equal(permissions.canViewFinnegansCredentials, false)
  }
})

test('Sidebar, Settings y la ruta de usuarios muestran controles acordes al rol efectivo', async () => {
  const vite = await createServer({ appType: 'custom', logLevel: 'silent',
    configLoader: 'runner', server: { middlewareMode: true } })
  try {
    const AuthContext = (await vite.ssrLoadModule('/src/context/AuthContext.jsx')).default
    const Sidebar = (await vite.ssrLoadModule('/src/components/common/Sidebar.jsx')).default
    const Settings = (await vite.ssrLoadModule('/src/pages/settings/Settings.jsx')).default
    const ProtectedRoute = (await vite.ssrLoadModule(
      '/src/components/common/ProtectedRoute.jsx')).default
    const render = (session, Component, props = {}, child = null) => renderToStaticMarkup(
      createElement(AuthContext.Provider, { value: session },
        createElement(MemoryRouter, null, createElement(Component, props, child))))

    for (const role of ['viewer', 'operator', 'admin']) {
      const menu = render(auth(role), Sidebar)
      assert.match(menu, /href="\/dashboard"/)
      assert.match(menu, /href="\/integrations"/)
      assert.match(menu, /href="\/executions"/)
      assert.match(menu, /href="\/settings"/)
      assert.equal(menu.includes('href="/settings/users"'), role === 'admin')
      const route = render(auth(role), ProtectedRoute,
        { allowedRoles: ['admin'] }, createElement('span', null, 'Administración de usuarios'))
      assert.equal(route.includes('Administración de usuarios'), role === 'admin')
      if (role !== 'admin') assert.match(route, /No tenés permiso/)
    }

    const viewerSettings = render(auth('viewer'), Settings)
    assert.match(viewerSettings, /No tenés permiso para consultar las credenciales/)
    assert.doesNotMatch(viewerSettings, /finnegans-client-secret/)
    assert.match(viewerSettings, /Ajustes del espacio de trabajo/)
    const operatorSettings = render(auth('operator'), Settings)
    assert.doesNotMatch(operatorSettings, /finnegans-client-secret/)

    const adminSettings = render(auth('admin'), Settings)
    assert.match(adminSettings, /finnegans-client-secret/)
    assert.match(adminSettings, /Guardar credenciales/)

    const supportReadOnly = auth('viewer', 'tenant-a', { platform_role: 'superadmin',
      support_session: { id: 'support', tenant_id: 'tenant-a', access_level: 'read_only' } })
    const supportSettings = render(supportReadOnly, Settings)
    assert.match(supportSettings, /Consultando credenciales/)
    assert.match(supportSettings, /Consultar estado/)
    assert.doesNotMatch(supportSettings, /finnegans-client-secret/)
    assert.match(supportSettings, /La edición requiere acceso de administración/)

    const noTenant = auth(null, null, { platform_role: 'superadmin' })
    assert.doesNotMatch(render(noTenant, Sidebar), /href="\/settings\/users"/)
    assert.doesNotMatch(render(noTenant, Sidebar), /href="\/executions"/)
    assert.match(render(noTenant, ProtectedRoute), /Seleccionar|organización/i)
    assert.doesNotMatch(render(noTenant, Settings), /finnegans-client-secret/)
  } finally {
    await vite.close()
  }
})

test('monitor y Dashboard conservan controles de lectura, filtros y navegación', async () => {
  const vite = await createServer({ appType: 'custom', logLevel: 'silent',
    configLoader: 'runner', server: { middlewareMode: true } })
  try {
    const Dashboard = (await vite.ssrLoadModule('/src/pages/dashboard/Dashboard.jsx')).default
    const { ExecutionsContent } = await vite.ssrLoadModule('/src/pages/executions/Executions.jsx')
    const ExecutionDetail = (await vite.ssrLoadModule(
      '/src/pages/executions/ExecutionDetail.jsx')).default
    const dashboard = renderToStaticMarkup(createElement(Dashboard))
    assert.match(dashboard, /Integraciones activas/)
    assert.match(dashboard, /Ejecuciones recientes/)
    assert.match(dashboard, /Sistema de origen/)
    const state = { data: [], loading: false, error: null }
    const executions = renderToStaticMarkup(createElement(MemoryRouter, null,
      createElement(ExecutionsContent, { monitor: state, options: state, search: '',
        selectedIntegrationId: '', onSearchChange: () => {}, onIntegrationChange: () => {},
        onRefresh: () => {}, onRetryIntegrations: () => {} })))
    assert.match(executions, /Buscar ejecuciones/)
    assert.match(executions, /Todas las integraciones/)
    assert.match(executions, /Refrescar/)
    assert.doesNotMatch(executions, /Reprocesar|Cancelar ejecución/)
    const detail = renderToStaticMarkup(createElement(MemoryRouter, null,
      createElement(ExecutionDetail)))
    assert.match(detail, /Detalle de ejecución/)
    assert.match(detail, /Refrescar/)
  } finally {
    await vite.close()
  }
})

test('el editor verifica el permiso de guardado y el contexto descarta su borrador', async () => {
  const [component, routes, service] = await Promise.all([
    readFile(new URL('../src/components/settings/FinnegansCredentialsSettings.jsx', import.meta.url), 'utf8'),
    readFile(new URL('../src/app/router/routes.jsx', import.meta.url), 'utf8'),
    readFile(new URL('../src/services/api/finnegansCredentialsService.js', import.meta.url), 'utf8'),
  ])
  const submit = component.slice(component.indexOf('const handleSubmit = async'),
    component.indexOf('const missingTenant ='))
  assert.match(submit, /event\.preventDefault\(\)[\s\S]*if \(!canManage\) return[\s\S]*updateTenantFinnegansCredentials/)
  assert.match(component, /if \(!permissions\.canViewFinnegansCredentials\)/)
  assert.match(component, /key=\{`\$\{auth\.contextId[^`]*auth\.user\.tenant_id[^`]*auth\.user\.role[^`]*support_session/)
  assert.match(component, /active = false/)
  assert.match(routes, /<MainLayout key=\{contextId\}/)
  assert.match(routes, /<ProtectedRoute allowedRoles=\{\['admin'\]\}>/)
  assert.match(service, /apiClient\.get\(getTenantCredentialsPath\(tenantId\)\)/)
  assert.match(service, /apiClient\.put\(path, payload\)/)
  assert.doesNotMatch(service, /integrations\/\$\{integrationId\}\/finnegans-credentials/)
})
