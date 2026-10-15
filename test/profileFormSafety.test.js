import assert from 'node:assert/strict'
import { after, before, test } from 'node:test'
import React from 'react'
import { renderToString } from 'react-dom/server'
import { createServer } from 'vite'
import { getResetProfileMappings } from '../src/services/adapters/profileAdapter.js'

let vite
let ProfileForm

before(async () => {
  vite = await createServer({
    appType: 'custom',
    logLevel: 'silent',
    server: { middlewareMode: true },
  })
  const module = await vite.ssrLoadModule(
    '/src/components/integrations/ProfileForm.jsx',
  )
  ProfileForm = module.default
})

after(async () => {
  await vite?.close()
})

const baseProfile = {
  source_system: 'tiendanube',
  entity: 'sales_order',
  version: '1.0.0',
  is_active: true,
  config: [],
}

const renderForm = (props = {}) => renderToString(
  React.createElement(ProfileForm, {
    initialValues: baseProfile,
    onCancel: () => {},
    onSubmit: () => {},
    entityTypes: [{ value: 'sales_order', label: 'Pedido de venta' }],
    ...props,
  }),
)

const getTagById = (html, tagName, id) => html.match(
  new RegExp(`<${tagName}\\b[^>]*id="${id}"[^>]*>`),
)?.[0] ?? ''

test('create identifies the profile from persisted fields without requiring name', () => {
  const html = renderForm()
  const sourceSystemInput = getTagById(html, 'input', 'profile-source-system')
  const entitySelect = getTagById(html, 'select', 'profile-source-entity')

  assert.match(html, /Identidad del MappingProfile/)
  assert.match(html, /tiendanube · sales_order · 1\.0\.0/)
  assert.doesNotMatch(html, /profile-name|Nombre del perfil/)
  assert.doesNotMatch(sourceSystemInput, /readonly|disabled/i)
  assert.doesNotMatch(entitySelect, /disabled/)
  assert.doesNotMatch(html, /MappingProfile compartido/)
})

test('edit keeps identity visible and makes source system and entity read-only', () => {
  const html = renderForm({
    initialValues: {
      ...baseProfile,
      id: 'profile-id',
      name: 'Legacy name that is not required',
    },
    isEditing: true,
  })
  const sourceSystemInput = getTagById(html, 'input', 'profile-source-system')
  const entityInput = getTagById(html, 'input', 'profile-source-entity')

  assert.match(sourceSystemInput, /readonly/i)
  assert.match(entityInput, /readonly/i)
  assert.equal(getTagById(html, 'select', 'profile-source-entity'), '')
  assert.match(html, /MappingProfile compartido/)
  assert.match(
    html,
    /Los cambios pueden afectar\s*integraciones compatibles que utilicen esta configuración\./,
  )
  assert.doesNotMatch(html, /Legacy name that is not required/)
})

test('loading disables actions and exposes an explicit saving state', () => {
  const html = renderForm({ loading: true, submitLabel: 'Crear perfil' })
  const submitButton = html.match(
    /<button\b[^>]*type="submit"[^>]*>[\s\S]*?<\/button>/,
  )?.[0] ?? ''
  const cancelButton = html.match(
    /<button\b[^>]*type="button"[^>]*>[\s\S]*?Cancelar[\s\S]*?<\/button>/,
  )?.[0] ?? ''

  assert.match(submitButton, /disabled/)
  assert.match(submitButton, /Guardando\.\.\./)
  assert.match(cancelButton, /disabled/)
})

test('a save error remains text while the form stays available for retry', () => {
  const html = renderForm({
    saveError: 'El servidor rechazó la versión indicada.',
    submitLabel: 'Guardar cambios',
  })

  assert.match(html, /role="alert"/)
  assert.match(html, /El servidor rechazó la versión indicada\./)
  assert.match(html, /profile-version/)
  assert.match(html, /Guardar cambios/)
  assert.doesNotMatch(
    html.match(/<button\b[^>]*type="submit"[^>]*>/)?.[0] ?? '',
    /disabled/,
  )
})

test('reset restores a defensive copy of the initial mappings instead of emptying an edit', () => {
  const initialConfig = [{
    source_field: 'id',
    target_field: 'external_id',
    field_type: 'simple',
    on_error: 'fail',
  }]
  const restored = getResetProfileMappings(initialConfig)

  assert.deepEqual(restored, initialConfig)
  assert.notEqual(restored, initialConfig)
  assert.notEqual(restored[0], initialConfig[0])
  assert.equal(restored.length, 1)
})
