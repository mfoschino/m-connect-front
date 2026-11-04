import assert from 'node:assert/strict'
import test from 'node:test'
import { connectorAvailability, filterConnectorDefinitions, filterConnectorInstallations,
  normalizeConnectorDefinitions, normalizeConnectorInstallations,
  normalizeConnectorInstallation } from '../src/services/adapters/connectorAdapter.js'
import { definition, installation } from './connectorFixtures.js'

test('las listas respetan el array contractual, el ID y code nullable', () => {
  const source = [definition('a'), definition('b')]
  const result = normalizeConnectorDefinitions(source)
  assert.deepEqual(result.map(({ id, code }) => ({ id, code })), [
    { id: 'a', code: null }, { id: 'b', code: null },
  ])
  assert.deepEqual(result[0].active_version, { id: 'version-a', version: '1.0.0' })
  assert.deepEqual(normalizeConnectorDefinitions([]), [])
  assert.deepEqual(normalizeConnectorInstallations([]), [])
  for (const invalid of [null, {}, { items: source }, { data: source }, [null], [definition('a'), definition('a')]]) {
    assert.throws(() => normalizeConnectorDefinitions(invalid))
  }
})

test('la proyección de instalación elimina config, secretos, campos extra y formularios sin mutar el response', () => {
  const source = installation('a', { config: { headers: { Authorization: 'DO-NOT-SHOW' }, password: 'PW' },
    secrets: { auth_token: 'TOKEN' }, secrets_enc: 'CIPHERTEXT',
    integration_form: [{ name: 'token', default: 'TOKEN' }],
    connector: { ...installation().connector, config: { password: 'PW' } } })
  const snapshot = structuredClone(source)
  const result = normalizeConnectorInstallation(source)
  assert.deepEqual(result.secret_fields, ['auth_token'])
  assert.deepEqual(result.connector, installation().connector)
  assert.equal(result.definition_version_id, 'version-a')
  assert.equal(result.version, '1.0.0')
  assert.doesNotMatch(JSON.stringify(result), /DO-NOT-SHOW|TOKEN|PW|CIPHERTEXT|config|integration_form|secrets_enc/)
  assert.deepEqual(source, snapshot)
})

test('no se inventan estado, versión, descripción ni credenciales faltantes', () => {
  const sparse = { id: 'a', name: 'Nombre' }
  assert.deepEqual(normalizeConnectorDefinitions([sparse]), [sparse])
  assert.equal(connectorAvailability(sparse), 'unknown')
  const minimal = { ...sparse, tenant_id: 'tenant-a', connector: { id: 'def', name: 'Conector' } }
  assert.deepEqual(normalizeConnectorInstallation(minimal), minimal)
  for (const value of [installation('a', { tenant_id: null }), installation('a', { connector: {} }),
    installation('a', { secret_fields: { auth_token: 'SECRET' } }), installation('a', { is_active: 'false' })]) {
    assert.throws(() => normalizeConnectorInstallation(value))
  }
})

test('disponibilidad distingue desactivado, sin publicar y publicado sin inferir una versión', () => {
  assert.equal(connectorAvailability(definition()), 'available')
  assert.equal(connectorAvailability(definition('a', { active_version: null })), 'unpublished')
  assert.equal(connectorAvailability(definition('a', { is_active: false })), 'inactive')
})

test('búsqueda y filtros de instalaciones son locales y combinables por ID, tipo y estado', () => {
  const a = installation('a', { name: 'Pedidos ACME' })
  const b = installation('b', { name: 'Otra cuenta', is_active: false,
    connector: { id: 'definition-b', name: 'Finnegans', kind: 'output' } })
  const items = [a, b]
  assert.deepEqual(filterConnectorInstallations(items, { search: ' acme ' }), [a])
  assert.deepEqual(filterConnectorInstallations(items, { search: 'FINNEGANS', kind: 'output', status: 'inactive', definitionId: 'definition-b' }), [b])
  assert.deepEqual(filterConnectorInstallations(items, { kind: 'input', status: 'inactive' }), [])
  assert.deepEqual(filterConnectorInstallations(items, { search: 'inexistente' }), [])
  assert.deepEqual(items, [a, b])
})

test('el catálogo filtra nombre, descripción, lado y disponibilidad sin usar code como identidad', () => {
  const a = definition('a')
  const b = definition('b', { name: 'Destino', kind: 'output', active_version: null })
  assert.deepEqual(filterConnectorDefinitions([a, b], { search: 'entrada', kind: 'input', availability: 'available' }), [a])
  assert.deepEqual(filterConnectorDefinitions([a, b], { search: 'DESTINO', availability: 'unpublished' }), [b])
})
