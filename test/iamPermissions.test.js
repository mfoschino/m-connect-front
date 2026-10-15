import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { MemoryRouter } from 'react-router-dom'
import { createServer } from 'vite'
import { getIamPermissions } from '../src/services/auth/iamPermissions.js'

const authenticated = (role, tenantId = 'tenant-a', extra = {}) => ({
  status: 'authenticated',
  user: { id: 'user', role, tenant_id: tenantId, platform_role: null,
    memberships: [], support_session: null, ...extra },
})

test('la matriz de presentación usa sólo el rol efectivo del tenant validado', () => {
  const viewer = getIamPermissions(authenticated('viewer'))
  const operator = getIamPermissions(authenticated('operator'))
  const admin = getIamPermissions(authenticated('admin'))

  for (const resource of ['Integrations', 'Profiles', 'Lookups']) {
    assert.equal(viewer[`canView${resource}`], true)
  }
  for (const permission of ['canManageIntegrations', 'canRunIntegrations',
    'canDeleteIntegrations', 'canManageProfiles', 'canDeactivateProfiles',
    'canManageLookups', 'canDeleteLookups']) {
    assert.equal(viewer[permission], false, permission)
  }
  for (const permission of ['canManageIntegrations', 'canRunIntegrations',
    'canManageProfiles', 'canManageLookups']) {
    assert.equal(operator[permission], true, permission)
    assert.equal(admin[permission], true, permission)
  }
  for (const permission of ['canDeleteIntegrations', 'canDeactivateProfiles',
    'canDeleteLookups']) {
    assert.equal(operator[permission], false, permission)
    assert.equal(admin[permission], true, permission)
  }
})

test('sin tenant ni sesión autenticada no hay capacidades implícitas de superadmin', () => {
  const noTenant = getIamPermissions(authenticated('admin', null,
    { platform_role: 'superadmin' }))
  const unauthenticated = getIamPermissions({ ...authenticated('admin'),
    status: 'switching' })
  const unknownRole = getIamPermissions(authenticated('owner'))
  const malformedRole = getIamPermissions(authenticated({ value: 'admin' }))
  for (const permissions of [noTenant, unauthenticated, unknownRole, malformedRole]) {
    assert.ok(Object.values(permissions).every((allowed) => allowed === false))
  }
})

test('soporte read_only y full reciben las capacidades de /users/me', () => {
  const supportSession = { access_level: 'read_only' }
  const readOnly = getIamPermissions(authenticated('viewer', 'tenant-a',
    { platform_role: 'superadmin', support_session: supportSession }))
  const full = getIamPermissions(authenticated('admin', 'tenant-a',
    { platform_role: 'superadmin', support_session: { access_level: 'full' } }))
  assert.equal(readOnly.canRunIntegrations, false)
  assert.equal(readOnly.canDeleteLookups, false)
  assert.equal(full.canRunIntegrations, true)
  assert.equal(full.canDeleteLookups, true)
})

test('controles observables de Integraciones y ejecución guiada respetan el rol', async () => {
  const vite = await createServer({ appType: 'custom', logLevel: 'silent',
    configLoader: 'runner', server: { middlewareMode: true } })
  try {
    const AuthContext = (await vite.ssrLoadModule('/src/context/AuthContext.jsx')).default
    const Integrations = (await vite.ssrLoadModule(
      '/src/pages/integrations/Integrations.jsx')).default
    const RunPanel = (await vite.ssrLoadModule(
      '/src/components/integrations/TiendaNubeRunPanel.jsx')).default
    const { IntegrationRowActions, ProfileRowActions, LookupRowActions } =
      await vite.ssrLoadModule('/src/components/integrations/TenantResourceActions.jsx')
    const renderPage = (auth) => renderToStaticMarkup(createElement(
      AuthContext.Provider, { value: { ...auth, contextId: 'context-a' } },
      createElement(MemoryRouter, null, createElement(Integrations)),
    ))
    const panelProps = { integration: { id: 'integration-a' },
      readiness: { checks: [], missingChecks: [{ id: 'i', action: 'integration',
        ready: false, label: 'Falta integración' }], canRun: true,
      fullyReady: false, documentLabel: 'Pedido' }, onRun: () => {},
    onEditIntegration: () => {}, onOpenProfiles: () => {}, onOpenLookupTables: () => {} }
    const renderPanel = (auth) => renderToStaticMarkup(createElement(MemoryRouter,
      null, createElement(RunPanel, { ...panelProps,
        canRunIntegration: getIamPermissions(auth).canRunIntegrations,
        canManageIntegration: getIamPermissions(auth).canManageIntegrations })))
    const renderRows = (auth) => {
      const permissions = getIamPermissions(auth)
      const noop = () => {}
      return [
        renderToStaticMarkup(createElement(IntegrationRowActions, {
          canEdit: permissions.canManageIntegrations,
          canDelete: permissions.canDeleteIntegrations, deleting: false,
          onDetail: noop, onEdit: noop, onDelete: noop,
        })),
        renderToStaticMarkup(createElement(ProfileRowActions, {
          canEdit: permissions.canManageProfiles,
          canDeactivate: permissions.canDeactivateProfiles, deactivating: false,
          onDetail: noop, onEdit: noop, onDeactivate: noop,
        })),
        renderToStaticMarkup(createElement(LookupRowActions, {
          canEdit: permissions.canManageLookups, canDelete: permissions.canDeleteLookups,
          deleting: false, onDetail: noop, onEdit: noop, onDelete: noop,
        })),
      ]
    }

    const viewer = renderPage(authenticated('viewer'))
    assert.match(viewer, /Acceso de sólo lectura/)
    assert.match(viewer, /Gestión de integraciones, perfiles y tablas/)
    assert.doesNotMatch(viewer, />Crear integración</)
    assert.doesNotMatch(renderPanel(authenticated('viewer')), />Ejecutar integración</)
    assert.doesNotMatch(renderPanel(authenticated('viewer')), />Editar integración</)
    for (const row of renderRows(authenticated('viewer'))) {
      assert.match(row, /<(?:button)\b/)
      assert.doesNotMatch(row, />Editar</)
      assert.doesNotMatch(row, />Eliminar</)
      assert.doesNotMatch(row, />Desactivar</)
    }

    const operator = renderPage(authenticated('operator'))
    assert.match(operator, />Crear integración</)
    assert.doesNotMatch(operator, /Acceso de sólo lectura/)
    assert.match(renderPanel(authenticated('operator')), />Ejecutar integración</)
    assert.match(renderPanel(authenticated('operator')), />Editar integración</)
    for (const row of renderRows(authenticated('operator'))) {
      assert.match(row, />Editar</)
      assert.doesNotMatch(row, />Eliminar</)
      assert.doesNotMatch(row, />Desactivar</)
    }
    assert.match(renderRows(authenticated('admin'))[0], />Eliminar</)
    assert.match(renderRows(authenticated('admin'))[1], />Desactivar</)
    assert.match(renderRows(authenticated('admin'))[2], />Eliminar</)

    const adminA = renderPage(authenticated('admin', 'tenant-a'))
    const viewerB = renderPage(authenticated('viewer', 'tenant-b'))
    const viewerA = renderPage(authenticated('viewer', 'tenant-a'))
    const adminB = renderPage(authenticated('admin', 'tenant-b'))
    assert.match(adminA, />Crear integración</)
    assert.doesNotMatch(viewerB, />Crear integración</)
    assert.doesNotMatch(viewerA, />Crear integración</)
    assert.match(adminB, />Crear integración</)
    assert.doesNotMatch(renderPage(authenticated('viewer', 'tenant-a',
      { platform_role: 'superadmin', support_session: { access_level: 'read_only' } })),
    />Crear integración</)
    assert.match(renderPage(authenticated('admin', 'tenant-a',
      { platform_role: 'superadmin', support_session: { access_level: 'full' } })),
    />Crear integración</)
  } finally {
    await vite.close()
  }
})

test('guardas de escritura y modales usan capacidades actuales; los servicios conservan rutas', async () => {
  const readSource = (path) => readFile(new URL(path, import.meta.url), 'utf8')
  const [page, integrationService, profileService, lookupService] = await Promise.all([
    readSource('../src/pages/integrations/Integrations.jsx'),
    readSource('../src/services/api/integrationService.js'),
    readSource('../src/services/api/profileService.js'),
    readSource('../src/services/api/lookupService.js'),
  ])
  for (const [handler, guard] of [
    ['handleIntegrationSave', 'canManageIntegrations'],
    ['handleDeleteIntegration', 'canDeleteIntegrations'],
    ['handleRunIntegration', 'canRunIntegrations'],
    ['handleGuidedRunIntegration', 'canRunIntegrations'],
    ['handleTriggerIntegration', 'canRunIntegrations'],
    ['handleProfileSave', 'canManageProfiles'],
    ['handleDeactivateProfile', 'canDeactivateProfiles'],
    ['handleLookupSave', 'canManageLookups'],
    ['handleDeleteLookup', 'canDeleteLookups'],
  ]) {
    assert.match(page, new RegExp(`const ${handler} = async [\\s\\S]*?if \\(!${guard}(?: \\|\\|[^)]*)?\\) return`))
  }
  for (const [modal, guard] of [
    ['integrationModalOpen', 'canManageIntegrations'],
    ['profileModalOpen', 'canManageProfiles'],
    ['lookupModalOpen', 'canManageLookups'],
    ['triggerModalOpen', 'canRunIntegrations'],
  ]) {
    assert.ok(page.includes(`open={${modal} && ${guard}}`))
  }
  assert.match(page, /key=\{`\$\{contextId \|\| ''\}:\$\{user\?\.tenant_id \|\| ''\}:\$\{user\?\.role \|\| ''\}`\}/)
  assert.match(integrationService, /post\('\/integrations', payload\)/)
  assert.match(integrationService, /post\(`\/integrations\/\$\{integrationId\}\/run`\)/)
  assert.match(integrationService, /delete\(`\/integrations\/\$\{integrationId\}`\)/)
  assert.match(profileService, /buildBackendProfileUpdatePayload\(formData\)/)
  assert.match(profileService, /post\(`\/profiles\/\$\{profileId\}\/deactivate`\)/)
  assert.match(lookupService, /delete\(`\/lookup-tables\/\$\{lookupId\}`\)/)
})
