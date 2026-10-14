import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { MemoryRouter } from 'react-router-dom'
import { createServer } from 'vite'
import { getTiendaNubeRunReadiness, getGuidedRunErrorMessage } from
  '../src/services/adapters/tiendaNubeRunReadiness.js'
import { getIamPermissions } from '../src/services/auth/iamPermissions.js'

const integration = {
  id: 'integration-a', connector_type: 'api', source_entity: 'sales_order',
  is_active: true, config: { source_system: 'tiendanube', base_url: 'https://example.test',
    endpoint: '/orders', auth_type: 'api_key', api_key_header: 'Authentication',
    api_key: '{{key}}', headers: {}, pagination: {}, finnegans_document: 'pedido_venta' },
}
const profiles = [
  { source_system: 'tiendanube', entity: 'sales_order', is_active: true, config: [] },
  { source_system: 'finnegans', entity: 'sales_order', is_active: true, config: [] },
]
const auth = (role, extra = {}) => ({ status: 'authenticated',
  user: { role, tenant_id: 'tenant-a', platform_role: null,
    support_session: null, ...extra } })
const readiness = (overrides = {}) => getTiendaNubeRunReadiness({
  integration, profiles, lookupTables: [], credentialsStatus: null, ...overrides,
})

test('el panel decide la ejecución visible según rol y verificaciones reales', async () => {
  const vite = await createServer({ appType: 'custom', logLevel: 'silent',
    configLoader: 'runner', server: { middlewareMode: true } })
  try {
    const Panel = (await vite.ssrLoadModule(
      '/src/components/integrations/TiendaNubeRunPanel.jsx')).default
    const render = (session, check, feedback = null) => {
      const permissions = getIamPermissions(session)
      return renderToStaticMarkup(createElement(MemoryRouter, null,
        createElement(Panel, { integration, readiness: check, runFeedback: feedback,
          canRunIntegration: permissions.canRunIntegrations,
          canManageIntegration: permissions.canManageIntegrations,
          canManageCredentials: permissions.canManageFinnegansCredentials,
          onRun: () => {}, onEditIntegration: () => {}, onOpenProfiles: () => {},
          onOpenLookupTables: () => {} })))
    }
    const runButton = (html) => html.match(/<button[^>]*>Ejecutar integración<\/button>/)?.[0]

    const adminReady = render(auth('admin'), readiness({
      credentialsStatus: { has_credentials: true, client_id: 'id',
        client_secret: 'sensitive-value' },
    }))
    assert.match(adminReady, /Lista para ejecutar/)
    assert.ok(runButton(adminReady))
    assert.doesNotMatch(runButton(adminReady), /disabled/)
    assert.doesNotMatch(adminReady, /sensitive-value|client_secret/)

    const adminMissing = render(auth('admin'), readiness({
      credentialsStatus: { has_credentials: false },
    }))
    assert.match(adminMissing, /faltan datos requeridos/)
    assert.match(adminMissing, /Configurar credenciales/)
    assert.match(runButton(adminMissing), /disabled/)

    const unavailable = readiness({ credentialsUnavailableByPermission: true })
    const operator = render(auth('operator'), unavailable)
    assert.match(operator, /Estado de credenciales Finnegans no verificable/)
    assert.match(operator, /Su estado no está verificado/)
    assert.doesNotMatch(operator, /Lista para ejecutar|Configurar credenciales/)
    assert.doesNotMatch(runButton(operator), /disabled/)

    const viewer = render(auth('viewer'), unavailable)
    assert.equal(runButton(viewer), undefined)
    assert.doesNotMatch(viewer, /Configurar credenciales/)

    const incomplete = render(auth('operator'), readiness({
      credentialsUnavailableByPermission: true,
      integration: { ...integration, config: { ...integration.config, endpoint: '' } },
    }))
    assert.match(runButton(incomplete), /disabled/)
    assert.match(incomplete, /Configuración crítica pendiente/)

    const network = render(auth('admin'), readiness({
      credentialsError: 'No se pudo verificar por un error de red o servidor.',
    }))
    assert.match(runButton(network), /disabled/)
    assert.match(network, /error de red o servidor/)

    const denied = render(auth('operator'), unavailable, { type: 'error',
      message: getGuidedRunErrorMessage({ response: { status: 403 } }) })
    const failed = render(auth('operator'), unavailable, { type: 'error',
      message: getGuidedRunErrorMessage({ response: { status: 503 } }) })
    assert.match(denied, /backend rechazó la ejecución/)
    assert.match(failed, /backend no pudo iniciar la ejecución/)
    assert.doesNotMatch(denied, /Ejecución iniciada/)
  } finally {
    await vite.close()
  }
})

test('la pantalla evita el GET admin para operator y mantiene las guardas y el POST sin payload', async () => {
  const page = await readFile(new URL('../src/pages/integrations/Integrations.jsx', import.meta.url), 'utf8')
  const service = await readFile(new URL('../src/services/api/integrationService.js', import.meta.url), 'utf8')
  const loader = page.split('const loadFinnegansCredentialsStatus = async')[1]
    ?.split('const openIntegrationDetail = async')[0] ?? ''
  assert.ok(loader.indexOf('if (!canViewFinnegansCredentials)') >= 0)
  assert.ok(loader.indexOf('if (!canViewFinnegansCredentials)') <
    loader.indexOf('getTenantFinnegansCredentials(tenantId)'))
  assert.match(page, /credentialsUnavailableByPermission: Boolean\(tenantId && !canViewFinnegansCredentials\)/)
  assert.match(page, /if \(!canRunIntegrations\) return[\s\S]*?const handleGuidedRunIntegration = async \(\) => \{\s*if \(!canRunIntegrations\) return/)
  assert.match(page, /key=\{`\$\{contextId \|\| ''\}:\$\{user\?\.tenant_id \|\| ''\}:\$\{user\?\.role \|\| ''\}`\}/)
  assert.match(service, /runIntegration = \(integrationId\) => apiClient\.post\(`\/integrations\/\$\{integrationId\}\/run`\)/)
  assert.equal(getIamPermissions(auth('operator')).canViewFinnegansCredentials, false)
  assert.equal(getIamPermissions(auth('operator')).canRunIntegrations, true)
  assert.equal(getIamPermissions(auth('viewer')).canRunIntegrations, false)
})
