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

const withoutReactTextMarkers = (html) => html.replaceAll('<!-- -->', '')

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

const wizardProps = (overrides = {}) => ({
  presentation: 'wizard',
  wizardContext: {
    direction: 'inbound',
    fromLabel: 'Tienda Nube',
    toLabel: 'Pedido M-Connect',
    matchSystemLabel: 'Tienda Nube',
    matchSystemCode: 'tiendanube',
    entity: 'sales_order',
  },
  ...overrides,
})

test('wizard shows one detected transformation before its collapsed rules and technical details', () => {
  const html = renderProfiles(wizardProps({ profiles: [profile()] }))

  assert.match(html, /Transformación de entrada/)
  assert.match(html, /Transformación detectada automáticamente/)
  assert.match(html, /Tienda Nube.*Pedido M-Connect/)
  assert.match(html, /1 regla principal configurada/)
  assert.match(html, /coincide con el sistema, la entidad y el estado activo/)
  assert.equal(html.match(/<details\b/g)?.length, 2)
  assert.match(html, /<details><summary[^>]*>Ver reglas<\/summary>/)
  assert.match(html, /<summary[^>]*>Ver detalles técnicos<\/summary>/)
  assert.doesNotMatch(html, /<details[^>]*\bopen\b/)
  assert.match(html, /external_id/)
  assert.match(html, /source_field/)
  assert.match(html, /1\.0\.0/)
  assert.match(html, /profile-real-id/)
  assert.match(html, /Configuración JSON del MappingProfile/)
  assert.doesNotMatch(html, /<select|type="radio"|Perfil seleccionado|Seleccionar perfil/)
})

test('wizard zero state names the missing match without navigation or blocking controls', () => {
  const html = withoutReactTextMarkers(renderProfiles(wizardProps({ profiles: [] })))

  assert.match(html, /Transformación de entrada.*Requisito pendiente/)
  assert.match(html, /No se encontró un MappingProfile activo compatible/)
  assert.match(html, /Sistema: Tienda Nube \(tiendanube\)/)
  assert.match(html, /Entidad: sales_order/)
  assert.match(html, /no guarda una selección manual de perfil/)
  assert.match(html, /Revisá los Perfiles de mapeo compatibles/)
  assert.doesNotMatch(html, /<button|<select|type="radio"|<a\b/)
})

test('wizard multiple state counts and retains every profile without ranking or selection', () => {
  const html = renderProfiles(wizardProps({
    profiles: [
      profile({ id: 'profile-v1', version: '1.0.0' }),
      profile({ id: 'profile-v2', version: '2.0.0', config: [
        { source_field: 'id', target_field: 'external_id', field_type: 'simple' },
        { source_field: 'total', target_field: 'amount', field_type: 'simple' },
      ] }),
    ],
  }))

  assert.match(html, /Se encontraron 2 MappingProfiles activos compatibles/)
  assert.match(html, /La resolución de estos recursos compartidos corresponde al backend/)
  assert.equal(html.match(/Perfil compatible/g)?.length, 2)
  assert.match(html, /1 regla principal configurada/)
  assert.match(html, /2 reglas principales configuradas/)
  assert.match(html, /profile-v1/)
  assert.match(html, /profile-v2/)
  assert.match(html, /1\.0\.0/)
  assert.match(html, /2\.0\.0/)
  assert.match(html, /source_field/)
  assert.match(html, /total/)
  assert.doesNotMatch(html, /Candidato [12]|<select|type="radio"|role="radio"/)
})

test('wizard outbound uses the same pattern with labels supplied by its context', () => {
  const html = renderProfiles(wizardProps({
    profiles: [profile({ source_system: 'finnegans_punto_venta' })],
    wizardContext: {
      direction: 'outbound',
      fromLabel: 'Pedido M-Connect',
      toLabel: 'Finnegans Punto de venta',
      matchSystemLabel: 'Finnegans Punto de venta',
      matchSystemCode: 'finnegans_punto_venta',
      entity: 'sales_order',
    },
  }))

  assert.match(html, /Transformación de salida/)
  assert.match(html, /Transformación detectada automáticamente/)
  assert.match(html, /Pedido M-Connect.*Finnegans Punto de venta/)
  assert.match(html, /Ver reglas/)
  assert.match(html, /Ver detalles técnicos/)
  assert.doesNotMatch(html, /Tienda Nube/)
})

test('wizard rules retain values and hierarchy for every configured mapping type', () => {
  const html = withoutReactTextMarkers(renderProfiles(wizardProps({ profiles: [profile({ config: [
    { source_field: 'id', target_field: 'IdentificacionExterna', field_type: 'simple' },
    { source_field: '**constant**', target_field: 'Cliente', field_type: 'constant', constant_value: 0 },
    { source_field: 'currency', target_field: 'MonedaCodigo', field_type: 'lookup', lookup_table_code: 'FinnegansMonedaMap', on_error: 'default', default_value: 'PES' },
    { source_field: 'external_id', target_field: 'Referencia', field_type: 'expression', expression: 'str(external_id)' },
    { source_field: 'ordered_at', target_field: 'Fecha', field_type: 'datetime', source_format: 'iso', target_format: 'date' },
    { source_field: 'lines', target_field: 'Items', field_type: 'table', sub_mappings: [
      { source_field: 'sku', target_field: 'ProductoCodigo', field_type: 'simple' },
    ] },
    { source_field: 'address', target_field: 'Direccion', field_type: 'nested_object', sub_mappings: [
      { source_field: 'city', target_field: 'Ciudad', field_type: 'simple' },
    ] },
  ] })] })))

  assert.match(html, /7 reglas principales configuradas/)
  assert.match(html, /IdentificacionExterna/)
  assert.match(html, /Cliente.*=.*0/)
  assert.match(html, /Valor fijo/)
  assert.match(html, /Tabla de conversión: FinnegansMonedaMap/)
  assert.match(html, /Ante error: default/)
  assert.match(html, /Valor por defecto: (?:&quot;|")PES(?:&quot;|")/)
  assert.match(html, /Cálculo configurado: str\(external_id\)/)
  assert.match(html, /Origen declarado: external_id/)
  assert.match(html, /Conversión de fecha/)
  assert.match(html, /Formato de origen: iso/)
  assert.match(html, /Formato de destino: date/)
  assert.equal(html.match(/1 regla interna/g)?.length, 2)
  assert.match(html, /Reglas internas/)
  assert.match(html, /ProductoCodigo/)
  assert.match(html, /Ciudad/)
  assert.match(html, /sub_mappings/)
})

test('wizard fixed values preserve falsy values and the legacy value field', () => {
  const html = withoutReactTextMarkers(renderProfiles(wizardProps({ profiles: [profile({ config: [
    { target_field: 'Nulo', field_type: 'constant', constant_value: null },
    { target_field: 'Falso', field_type: 'constant', constant_value: false },
    { target_field: 'Cero', field_type: 'constant', value: 0 },
  ] })] })))

  assert.match(html, /Nulo.*=.*null/)
  assert.match(html, /Falso.*=.*false/)
  assert.match(html, /Cero.*=.*0/)
  assert.match(html, /constant_value/)
  assert.match(html, /&quot;value&quot;: 0/)
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
