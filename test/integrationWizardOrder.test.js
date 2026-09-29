import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { test } from 'node:test'
import { buildCanonicalFlowTrace } from '../src/services/adapters/canonicalFlowAdapter.js'
import {
  buildBackendIntegrationPayload,
  getInboundProfileCandidates,
  getOutboundProfileCandidates,
  getOutboundProfileSourceSystem,
  normalizeFinnegansDocumentForEntity,
} from '../src/services/adapters/integrationFlowAdapter.js'

const readWizard = () => readFile(
  new URL('../src/components/integrations/IntegrationForm.jsx', import.meta.url),
  'utf8',
)

const getStepBlock = (source, step) => {
  const start = source.indexOf(`{currentStep === ${step} ? (`)
  const end = source.indexOf(`{currentStep === ${step + 1} ? (`, start)
  assert.ok(start >= 0 && end > start, `step ${step} precedes step ${step + 1}`)
  return source.slice(start, end)
}

const inboundProfile = {
  id: 'inbound',
  source_system: 'tiendanube',
  entity: 'sales_order',
  is_active: true,
  config: [{ source_field: 'id', target_field: 'external_id', field_type: 'simple' }],
}

const outboundProfile = (id, sourceSystem, targetField) => ({
  id,
  source_system: sourceSystem,
  entity: 'sales_order',
  is_active: true,
  config: [{ source_field: 'external_id', target_field: targetField, field_type: 'simple' }],
})

test('wizard keeps seven steps in causal order and wires the three moved views', async () => {
  const source = await readWizard()
  const stepsDefinition = source.slice(source.indexOf('const STEPS = ['), source.indexOf('const STEP_DESCRIPTIONS ='))
  const titles = [...stepsDefinition.matchAll(/title: '([^']+)'/g)].map((match) => match[1])

  assert.deepEqual(titles, [
    'Información general',
    'Sistema de origen',
    'Mapeo de entrada',
    'Destino Finnegans',
    'Mapeo de salida',
    'Trazabilidad canónica',
    'Revisión',
  ])
  assert.match(getStepBlock(source, 3), /<MappingProfileReadOnly[\s\S]*profiles=\{inboundProfiles\}/)
  assert.match(getStepBlock(source, 4), /Documento destino[\s\S]*setFinnegansDocument\(documentOption\.value\)/)
  assert.match(getStepBlock(source, 5), /<MappingProfileReadOnly[\s\S]*profiles=\{outboundProfiles\}/)
  assert.match(getStepBlock(source, 6), /<CanonicalFlowReadOnly[\s\S]*inboundProfiles=\{inboundProfiles\}[\s\S]*outboundProfiles=\{outboundProfiles\}/)
  assert.match(source.slice(source.indexOf('{currentStep === 7 ? (')), /<IntegrationReview/)
  assert.doesNotMatch(getStepBlock(source, 3) + getStepBlock(source, 5), /<select|type="radio"/)

  const flowOverview = source.slice(source.indexOf('const FlowOverview ='), source.indexOf('const IntegrationForm ='))
  assert.match(flowOverview, /label: canonicalLabel[\s\S]*active: currentStep === 6/)
  assert.match(flowOverview, /label: 'Mapeo de salida'[\s\S]*active: currentStep === 5/)
  assert.match(flowOverview, /label: 'Finnegans'[\s\S]*active: currentStep === 4/)
})

test('new step indices keep document validation, Back/Continue and final submit aligned', async () => {
  const source = await readWizard()
  const validation = source.slice(source.indexOf('const validateStep ='), source.indexOf('const validateAllSteps ='))
  const documentStep = getStepBlock(source, 4)

  assert.match(validation, /stepToValidate === 4 && isFinnegansDocumentEnabled && !finnegansDocument/)
  assert.doesNotMatch(validation, /stepToValidate === 6/)
  assert.match(validation, /stepToValidate === 1[\s\S]*!name\.trim\(\)/)
  assert.match(validation, /stepToValidate === 2[\s\S]*!sourceSystem[\s\S]*!entity/)
  assert.match(documentStep, /isFinnegansDocumentEnabled[\s\S]*finnegansDocumentOptions\.map/)
  assert.match(documentStep, /Destino sin documento configurable/)
  assert.match(source, /for \(let step = 1; step < STEPS\.length; step \+= 1\)/)
  assert.match(source, /if \(!validateStep\(currentStep\)\) return[\s\S]*setCurrentStep\(\(step\) => Math\.min\(step \+ 1, STEPS\.length\)\)/)
  assert.match(source, /setCurrentStep\(\(step\) => Math\.max\(step - 1, 1\)\)/)
  assert.match(source, /if \(!validateAllSteps\(\)\) return\s+onSubmit\(payloadPreview\)/)
  assert.match(source, /currentStep < STEPS\.length[\s\S]*'Crear integración'/)
})

test('returning to Destination and changing document recomputes outbound and canonical trace', async () => {
  const source = await readWizard()
  const profiles = [
    inboundProfile,
    outboundProfile('pedido', 'finnegans', 'PedidoId'),
    outboundProfile('punto', 'finnegans_punto_venta', 'PuntoVentaId'),
  ]
  const inbound = getInboundProfileCandidates(profiles, 'tiendanube', 'sales_order')
  let document = 'pedido_venta'
  let outbound = getOutboundProfileCandidates(profiles, document, 'sales_order')

  assert.equal(getOutboundProfileSourceSystem(document, 'sales_order'), 'finnegans')
  assert.deepEqual(outbound.map((profile) => profile.id), ['pedido'])
  assert.equal(buildCanonicalFlowTrace({ inboundProfile: inbound[0], outboundProfile: outbound[0] })
    .fields[0].consumers[0].targetPath, 'PedidoId')

  // Same state transition as going Back to step 4, choosing another document, then Continue.
  document = 'punto_venta'
  outbound = getOutboundProfileCandidates(profiles, document, 'sales_order')

  assert.equal(getOutboundProfileSourceSystem(document, 'sales_order'), 'finnegans_punto_venta')
  assert.deepEqual(outbound.map((profile) => profile.id), ['punto'])
  assert.equal(buildCanonicalFlowTrace({ inboundProfile: inbound[0], outboundProfile: outbound[0] })
    .fields[0].consumers[0].targetPath, 'PuntoVentaId')

  assert.match(source, /\[availableProfiles, entityId, finnegansDocument\]/)
  assert.match(getStepBlock(source, 5), /profiles=\{outboundProfiles\}/)
  assert.match(getStepBlock(source, 6), /outboundProfiles=\{outboundProfiles\}/)
  assert.match(source.slice(source.indexOf('{currentStep === 7 ? (')), /outboundProfiles=\{outboundProfiles\}/)
})

test('moving the document step leaves its payload contract and entity default unchanged', async () => {
  const source = await readWizard()
  const buildPayload = (document) => buildBackendIntegrationPayload({
    name: 'Pedidos',
    source_entity: 'sales_order',
    connector_type: 'api',
    source_system: 'tiendanube',
    config: { base_url: 'https://example.test' },
    finnegans_document: document,
    schedule: null,
    is_active: true,
  })

  for (const document of ['pedido_venta', 'punto_venta']) {
    const payload = buildPayload(document)
    assert.equal(payload.config.finnegans_document, document)
    assert.equal(payload.config.source_system, 'tiendanube')
    assert.equal(payload.source_entity, 'sales_order')
    for (const key of ['profile_id', 'inbound_profile_id', 'outbound_profile_id']) {
      assert.equal(key in payload.config, false)
      assert.equal(key in payload, false)
    }
  }

  assert.equal(normalizeFinnegansDocumentForEntity('sales_order', {}), 'pedido_venta')
  assert.equal(normalizeFinnegansDocumentForEntity('customer', 'punto_venta'), '')
  assert.equal(buildBackendIntegrationPayload({
    name: 'Clientes',
    source_entity: 'customer',
    connector_type: 'api',
    source_system: 'tiendanube',
    config: {},
    finnegans_document: 'punto_venta',
  }).config.finnegans_document, undefined)

  assert.match(source, /normalizeFinnegansDocumentForEntity\(initialEntityId, designValues\)/)
  assert.match(source, /normalizeFinnegansDocumentForEntity\(selectedEntityId, currentDocument\)/)
  assert.match(source, /finnegans_document: finnegansDocument/)
  assert.match(source, /finnegansDocument=\{finnegansDocument\}/)
  assert.match(source, /config=\{payloadPreview\.config\}/)
})
