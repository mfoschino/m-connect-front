import assert from 'node:assert/strict'
import test from 'node:test'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { MemoryRouter } from 'react-router-dom'
import { createServer } from 'vite'
import { membershipChoices, safePathAfterContextChange } from '../src/services/auth/iamTenantUi.js'

const membership = (tenantId, name, status = 'active', tenantIsActive = true) => ({
  tenant_id: tenantId, tenant_name: name, role: 'viewer', status,
  tenant_is_active: tenantIsActive,
})

const user = (tenantId, memberships, platformRole = null) => ({
  id: 'user', tenant_id: tenantId, role: tenantId ? 'viewer' : null,
  platform_role: platformRole, memberships,
})

test('opciones usan sólo memberships y distinguen suspensión de inactividad', () => {
  const choices = membershipChoices(user('a', [
    membership('a', 'Acme'),
    membership('b', 'Suspendida', 'active', false),
    membership('c', 'Inactiva', 'inactive'),
  ]))
  assert.deepEqual(choices.map(({ available, reason }) => ({ available, reason })), [
    { available: true, reason: null },
    { available: false, reason: 'Organización suspendida' },
    { available: false, reason: 'Membresía inactiva' },
  ])
  assert.deepEqual(membershipChoices(user(null, [])), [])
})

test('nueva frontera descarta URL de ejecución y ruta admin según rol efectivo', () => {
  assert.equal(safePathAfterContextChange('/executions/trace-a', 'viewer'), '/executions')
  assert.equal(safePathAfterContextChange('/settings/users', 'viewer'), '/dashboard')
  assert.equal(safePathAfterContextChange('/settings/users', 'admin'), null)
  assert.equal(safePathAfterContextChange('/integrations', 'viewer'), null)
  assert.equal(safePathAfterContextChange('//external.example', 'viewer'), null)
})

test('selector real y ProtectedRoute muestran sólo la organización validada', async () => {
  const vite = await createServer({ appType: 'custom', logLevel: 'silent', configLoader: 'runner',
    server: { middlewareMode: true } })
  try {
    const AuthContext = (await vite.ssrLoadModule('/src/context/AuthContext.jsx')).default
    const Selector = (await vite.ssrLoadModule(
      '/src/components/common/OrganizationSelector.jsx')).default
    const ProtectedRoute = (await vite.ssrLoadModule(
      '/src/components/common/ProtectedRoute.jsx')).default
    const render = (auth, Component, props = {}, child = null) => renderToStaticMarkup(
      createElement(AuthContext.Provider, { value: auth },
        createElement(MemoryRouter, null,
          createElement(Component, props, child))))
    const buttonFor = (markup, name) => (markup.match(/<button\b[^>]*>[\s\S]*?<\/button>/g) || [])
      .find((button) => button.includes(`>${name}</span>`))
    const base = { status: 'authenticated', switching: false,
      switchTenant: async () => {}, logout: async () => {}, error: null }
    const suspended = membership('s', 'Pausada', 'active', false)
    const inactive = membership('i', 'Sin acceso', 'inactive')

    const one = render({ ...base, user: user('a', [membership('a', 'Acme')]) }, Selector)
    assert.match(one, /Acme/)
    assert.doesNotMatch(one, /<select/)

    for (const unavailable of [[suspended], [inactive], [suspended, inactive]]) {
      const onlyActive = render({ ...base,
        user: user('a', [membership('a', 'Acme'), ...unavailable]) }, Selector)
      assert.match(onlyActive, /Acme/)
      assert.doesNotMatch(onlyActive, /<select/)
      assert.match(onlyActive, /aria-label="Organizaciones no disponibles"/)
      assert.doesNotMatch(onlyActive, /<button/)
      for (const choice of unavailable) {
        assert.match(onlyActive, new RegExp(`${choice.tenant_name} — `
          + (choice.tenant_is_active ? 'Membresía inactiva' : 'Organización suspendida')))
      }
    }

    const two = render({ ...base, user: user('a', [membership('a', 'Acme'),
      membership('b', 'Beta')]) }, Selector)
    assert.match(two, /<select/)
    assert.match(two, /<option value="b">Beta<\/option>/)

    const twoWithSuspended = render({ ...base, user: user('a', [membership('a', 'Acme'),
      membership('b', 'Beta'), suspended]) }, Selector)
    assert.match(twoWithSuspended, /<select/)
    assert.match(twoWithSuspended, /<option value="b">Beta<\/option>/)
    assert.match(twoWithSuspended, /<option value="s" disabled="">Pausada — Organización suspendida<\/option>/)

    const many = render({ ...base, user: user('a', [membership('a', 'Acme'),
      membership('b', 'Beta'), suspended, inactive]) }, Selector)
    assert.match(many, /<select/)
    assert.match(many, /<option value="b">Beta<\/option>/)
    assert.match(many, /Beta/)
    assert.match(many, /Pausada — Organización suspendida/)
    assert.match(many, /Sin acceso — Membresía inactiva/)
    assert.equal((many.match(/disabled=""/g) || []).length, 2)

    const noTenant = render({ ...base, user: user(null, [membership('a', 'Acme')]) },
      ProtectedRoute, {}, createElement('span', null, 'Datos privados'))
    assert.match(noTenant, /Elegí una organización/)
    assert.match(noTenant, /Seleccionar organización/)
    assert.match(noTenant, /Cerrar sesión/)
    assert.doesNotMatch(noTenant, /Datos privados/)
    assert.doesNotMatch(buttonFor(noTenant, 'Acme'), /disabled=""/)

    const noTenantCompact = render({ ...base,
      user: user(null, [membership('a', 'Acme')]) }, Selector)
    assert.doesNotMatch(noTenantCompact, /<select/)
    assert.match(noTenantCompact, /Seleccionar Acme/)
    assert.doesNotMatch(noTenantCompact, /<button[^>]*disabled=""/)

    const noTenantWithSuspended = render({ ...base,
      user: user(null, [membership('a', 'Acme'), suspended]) },
    ProtectedRoute, {}, createElement('span', null, 'Datos privados'))
    assert.doesNotMatch(buttonFor(noTenantWithSuspended, 'Acme'), /disabled=""/)
    assert.match(buttonFor(noTenantWithSuspended, 'Pausada'), /disabled=""/)
    assert.match(noTenantWithSuspended, /Organización suspendida/)
    assert.doesNotMatch(noTenantWithSuspended, /Datos privados/)

    const noAvailable = render({ ...base, user: user(null, [suspended, inactive]) },
      ProtectedRoute, {}, createElement('span', null, 'Datos privados'))
    assert.match(noAvailable, /No tenés organizaciones habilitadas/)
    assert.match(buttonFor(noAvailable, 'Pausada'), /disabled=""/)
    assert.match(buttonFor(noAvailable, 'Sin acceso'), /disabled=""/)
    assert.match(noAvailable, /Cerrar sesión/)
    assert.doesNotMatch(noAvailable, /Datos privados/)

    const noMemberships = render({ ...base, user: user(null, [], 'superadmin') },
      ProtectedRoute, {}, createElement('span', null, 'Datos privados'))
    assert.match(noMemberships, /No tenés organizaciones habilitadas/)
    assert.match(noMemberships, /Cerrar sesión/)
    assert.doesNotMatch(noMemberships, /Datos privados/)

    const switching = render({ ...base, status: 'switching', switching: true,
      user: null }, ProtectedRoute, {}, createElement('span', null, 'Datos privados'))
    assert.match(switching, /Cambiando organización/)
    assert.doesNotMatch(switching, /Datos privados/)

    const busySelector = render({ ...base, switching: true,
      user: user('a', [membership('a', 'Acme'), membership('b', 'Beta')]) }, Selector)
    assert.match(busySelector, /<select[^>]*disabled=""/)
    const busyStandalone = render({ ...base, switching: true,
      user: user(null, [membership('a', 'Acme')]) }, Selector, { standalone: true })
    assert.match(buttonFor(busyStandalone, 'Acme'), /disabled=""/)

    const forbidden = render({ ...base, error: { status: 403 },
      user: user('a', [membership('a', 'Acme'), membership('b', 'Beta')]) }, Selector)
    assert.match(forbidden, /No se pudo cambiar de organización/)
    const forbiddenSingle = render({ ...base, error: { status: 403 },
      user: user('a', [membership('a', 'Acme'), suspended]) }, Selector)
    assert.doesNotMatch(forbiddenSingle, /<select/)
    assert.match(forbiddenSingle, /No se pudo cambiar de organización/)
  } finally {
    await vite.close()
  }
})
