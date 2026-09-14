import assert from 'node:assert/strict'
import { after, before, test } from 'node:test'
import React from 'react'
import { renderToString } from 'react-dom/server'
import { createServer } from 'vite'

let vite
let MappingProfileReadOnly

before(async () => {
  vite = await createServer({
    appType: 'custom',
    logLevel: 'silent',
    server: { middlewareMode: true },
  })
  const module = await vite.ssrLoadModule(
    '/src/components/integrations/MappingProfileReadOnly.jsx',
  )
  MappingProfileReadOnly = module.default
})

after(async () => {
  await vite?.close()
})

const renderProfiles = (props) => renderToString(
  React.createElement(MappingProfileReadOnly, props),
)

const profile = (overrides = {}) => ({
  id: 'profile-real-id',
  source_system: 'tiendanube',
  source_entity: 'sales_order',
  version: '1.0.0',
  active: true,
  config: [
    { source_field: 'id', target_field: 'external_id', field_type: 'simple' },
  ],
  ...overrides,
})

test('zero candidates explains that the profile must be created without navigation controls', () => {
  const html = renderProfiles({
    profiles: [],
    emptyMessage: 'No existe un MappingProfile inbound activo compatible con Tienda Nube y sales_order.',
    emptyDescription: 'Debe crearse un profile compatible desde la sección Perfiles de mapeo.',
  })

  assert.match(html, /No existe un MappingProfile inbound activo compatible con Tienda Nube y sales_order\./)
  assert.match(html, /Debe crearse un profile compatible desde la sección Perfiles de mapeo\./)
  assert.doesNotMatch(html, /<button|<select|type="radio"/)
})

test('one inbound candidate shows the real profile and its mappings automatically', () => {
  const html = renderProfiles({ profiles: [profile()] })

  assert.match(html, /Perfil detectado automáticamente/)
  assert.match(html, /tiendanube/)
  assert.match(html, /sales_order/)
  assert.match(html, /1\.0\.0/)
  assert.match(html, /Activo/)
  assert.match(html, /profile-real-id/)
  assert.match(html, /id/)
  assert.match(html, /external_id/)
  assert.doesNotMatch(html, /<select|type="radio"|role="radio"/)
})

test('multiple candidates show every profile and warn that backend resolves the ambiguity', () => {
  const html = renderProfiles({
    profiles: [
      profile({ id: 'profile-v1', version: '1.0.0' }),
      profile({
        id: 'profile-v2',
        version: '2.0.0',
        config: [
          { source_field: 'id', target_field: 'external_id', field_type: 'simple' },
          { source_field: 'total', target_field: 'total', field_type: 'simple' },
        ],
      }),
    ],
  })

  assert.match(html, /Se encontraron múltiples MappingProfiles activos compatibles\./)
  assert.match(html, /La IntegrationConfig actual no permite seleccionar uno explícitamente\./)
  assert.match(html, /Backend determinará cuál resolver durante la ejecución\./)
  assert.match(html, /profile-v1/)
  assert.match(html, /profile-v2/)
  assert.match(html, /1\.0\.0/)
  assert.match(html, /2\.0\.0/)
  assert.match(html, /total/)
  assert.doesNotMatch(html, /<select|type="radio"|role="radio"/)
})

test('read-only mapping summary supports simple, constant, lookup, expression, datetime and nested mappings', () => {
  const html = renderProfiles({
    profiles: [profile({
      id: 'outbound-profile',
      source_system: 'finnegans',
      config: [
        { source_field: 'external_id', target_field: 'IdentificacionExterna', field_type: 'simple' },
        { source_field: '**constant**', target_field: 'Cliente', field_type: 'constant', constant_value: 'CF' },
        {
          source_field: 'currency',
          target_field: 'MonedaCodigo',
          field_type: 'lookup',
          lookup_table_code: 'FinnegansMonedaMap',
          on_error: 'default',
          default_value: 'PES',
        },
        {
          source_field: 'ordered_at',
          target_field: 'Fecha',
          field_type: 'datetime',
          target_format: 'date',
        },
        {
          source_field: 'external_id',
          target_field: 'Referencia',
          field_type: 'expression',
          expression: 'str(external_id)',
        },
        {
          source_field: 'lines',
          target_field: 'Items',
          field_type: 'table',
          sub_mappings: [
            { source_field: 'sku', target_field: 'ProductoCodigo', field_type: 'simple' },
          ],
        },
        {
          source_field: 'shipping_address',
          target_field: 'Direccion',
          field_type: 'nested_object',
          sub_mappings: [
            { source_field: 'shipping_address.city', target_field: 'Ciudad', field_type: 'path' },
          ],
        },
      ],
    })],
  })

  assert.match(html, /external_id/)
  assert.match(html, /IdentificacionExterna/)
  assert.match(html, /Constante (?:&quot;|")CF(?:&quot;|")/)
  assert.match(html, /Cliente/)
  assert.match(html, /currency/)
  assert.match(html, /MonedaCodigo/)
  assert.match(html, /Lookup: FinnegansMonedaMap/)
  assert.match(html, /Valor por defecto: (?:&quot;|")PES(?:&quot;|")/)
  assert.match(html, /Formato de destino: date/)
  assert.match(html, /Expresión: str\(external_id\)/)
  assert.match(html, /lines/)
  assert.match(html, /Items/)
  assert.match(html, /Mapeos anidados/)
  assert.match(html, /sku/)
  assert.match(html, /ProductoCodigo/)
  assert.match(html, /shipping_address\.city/)
  assert.match(html, /Ciudad/)
})

test('a raw backend constant value remains readable as a defensive fallback', () => {
  const html = renderProfiles({
    profiles: [profile({
      config: [
        { source_field: '**constant**', target_field: 'Cliente', field_type: 'constant', value: 'CF' },
      ],
    })],
  })

  assert.match(html, /Constante (?:&quot;|")CF(?:&quot;|")/)
})

test('json-summary keeps profile metadata and prioritizes JSON without detailed mapping cards', () => {
  const html = renderProfiles({
    profiles: [profile({
      config: [
        {
          source_field: 'products',
          target_field: 'lines',
          field_type: 'table',
          sub_mappings: [
            { source_field: 'sku', target_field: 'sku', field_type: 'simple' },
          ],
        },
      ],
    })],
    presentation: 'json-summary',
  })

  assert.match(html, /Perfil detectado automáticamente/)
  assert.match(html, /profile-real-id/)
  assert.match(html, /Mappings/)
  assert.match(html, /Configuración JSON del MappingProfile/)
  assert.match(html, /source_field/)
  assert.match(html, /products/)
  assert.match(html, /sub_mappings/)
  assert.match(html, /sku/)
  assert.doesNotMatch(html, /Mapeos anidados/)
  assert.doesNotMatch(html, /Lookup:|Constante /)
  assert.doesNotMatch(html, /Perfil de mapeo/)
  assert.doesNotMatch(html, /Ver configuración JSON del perfil/)
  assert.doesNotMatch(html, /<details/)
})
