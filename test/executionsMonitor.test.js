import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { after, before, test } from 'node:test'
import React from 'react'
import { renderToString } from 'react-dom/server'
import { MemoryRouter } from 'react-router-dom'
import { createServer } from 'vite'
import { loadMonitorRequest } from '../src/pages/executions/loadMonitorRequest.js'

let vite
let ExecutionsContent
let executionService
let apiClient
let pageSource

before(async () => {
  vite = await createServer({ appType: 'custom', logLevel: 'silent', server: { middlewareMode: true } })
  ExecutionsContent = (await vite.ssrLoadModule('/src/pages/executions/Executions.jsx')).ExecutionsContent
  executionService = (await vite.ssrLoadModule('/src/services/api/executionService.js')).default
  apiClient = (await vite.ssrLoadModule('/src/services/api/client.js')).default
  pageSource = await readFile(new URL('../src/pages/executions/Executions.jsx', import.meta.url), 'utf8')
})

after(async () => { await vite?.close() })

const idA = '05931e65-b6e0-4d7f-bfa9-bf0141f080f1'
const idB = '77f3c06a-ae6d-4362-8563-3d8cbe3c9e78'
const idC = '9be89c68-899f-4205-bdb8-8910966586d1'
const traceId = 'f7ded15d-3838-44cb-8015-389435868e00'
const integrations = [
  { id: idA, name: 'Pedidos Tienda Nube', source_system: 'tiendanube', is_active: true },
  { id: idB, name: 'Pedidos históricos', source_system: 'tiendanube', is_active: false },
]
const execution = {
  trace_id: traceId, integration_id: idA, status: 'ok', entity: 'sales_order',
  source_system: 'tiendanube', created_at: '2026-10-05T10:00:00Z', updated_at: '2026-10-05T10:01:00Z',
}
const state = (data = []) => ({ data, loading: false, error: null })
const props = (overrides = {}) => ({
  monitor: state([execution]), options: state(integrations), search: '', selectedIntegrationId: '',
  onSearchChange: () => {}, onIntegrationChange: () => {}, onRefresh: () => {}, onRetryIntegrations: () => {},
  ...overrides,
})

// Capture the actual element handlers during SSR, using the existing React/Vite test setup.
const render = (overrides = {}) => {
  let tree
  const Probe = () => {
    tree = ExecutionsContent(props(overrides))
    return tree
  }
  const html = renderToString(React.createElement(MemoryRouter, null, React.createElement(Probe)))
  return { html: html.replaceAll('<!-- -->', ''), tree }
}

const findElement = (element, predicate) => {
  if (!React.isValidElement(element)) return undefined
  if (predicate(element)) return element
  for (const child of React.Children.toArray(element.props.children)) {
    const found = findElement(child, predicate)
    if (found) return found
  }
  return undefined
}
const selectedOption = (html) => html.match(/<option\b[^>]*selected=""[^>]*>[^<]*<\/option>/)?.[0] ?? ''
const deferred = () => {
  let resolve
  let reject
  const promise = new Promise((res, rej) => { resolve = res; reject = rej })
  return { promise, resolve, reject }
}
const resource = () => {
  let current = state()
  const requestRef = { current: 0 }
  return {
    requestRef,
    get state() { return current },
    load: (load, errorMessage = 'No se pudieron cargar las ejecuciones. Intenta recargar.') => loadMonitorRequest({
      requestRef, load, errorMessage,
      onChange: (next) => { current = typeof next === 'function' ? next(current) : next },
    }),
  }
}

test('selector defaults to All, labels by name and preserves real UUIDs for inactive options', () => {
  const { html } = render()
  assert.match(html, /<label for="execution-integration"[^>]*>Integración<\/label>/)
  assert.match(html, /<select[^>]*id="execution-integration"/)
  assert.match(selectedOption(html), /value=""[^>]*>Todas las integraciones/)
  assert.ok(html.includes(`<option value="${idA}">Pedidos Tienda Nube</option>`))
  assert.ok(html.includes(`<option value="${idB}">Pedidos históricos — inactiva</option>`))
  assert.doesNotMatch(html, /value="tiendanube"|value="Pedidos Tienda Nube"/)
  assert.ok(selectedOption(render({ selectedIntegrationId: idB }).html).includes(idB))
})

test('an unavailable selected UUID is retained instead of switching to All', () => {
  const { html } = render({ selectedIntegrationId: idC })
  assert.ok(selectedOption(html).includes(`value="${idC}"`))
  assert.ok(html.includes(`Integración no disponible — ${idC}`))
  assert.doesNotMatch(html, /eliminada/)
})

test('selecting and clearing send the selected UUID or an unfiltered request', async (t) => {
  const get = t.mock.method(apiClient, 'get', async () => ({ data: [execution] }))
  const monitor = resource()
  let pending
  const { tree } = render({
    onIntegrationChange: (integrationId) => {
      pending = monitor.load(() => executionService.listExecutions({ integration_id: integrationId }))
    },
  })
  const selector = findElement(tree, (element) => element.props.id === 'execution-integration')
  selector.props.onChange({ target: { value: idB } })
  await pending
  selector.props.onChange({ target: { value: '' } })
  await pending

  assert.deepEqual(get.mock.calls.map((call) => call.arguments), [
    ['/executions', { params: { integration_id: idB } }],
    ['/executions', { params: {} }],
  ])
  const handler = pageSource.slice(pageSource.indexOf('const handleIntegrationChange'), pageSource.indexOf('  useEffect('))
  assert.match(handler, /setSelectedIntegrationId\(integrationId\)/)
  assert.match(handler, /fetchExecutions\(integrationId\)/)
  assert.doesNotMatch(handler, /setSearch|fetchIntegrations/)
  assert.match(pageSource, /onIntegrationChange=\{handleIntegrationChange\}/)
})

test('search remains local and preserved across integration changes', () => {
  let changedSearch
  const { tree, html } = render({ search: 'Pedidos', selectedIntegrationId: idB, onSearchChange: (value) => { changedSearch = value } })
  assert.match(html, /id="execution-search"[^>]*value="Pedidos"/)
  findElement(tree, (element) => element.props.id === 'execution-search').props.onChange({ target: { value: 'sales_order' } })
  assert.equal(changedSearch, 'sales_order')

  for (const search of ['Pedidos Tienda Nube', traceId, 'sales_order', 'TIENDANUBE', 'ok']) {
    assert.ok(render({ search }).html.includes(`/executions/${traceId}`))
  }
  assert.match(render({ search: 'no-match' }).html, /No hay ejecuciones que coincidan con los filtros actuales\./)
  assert.match(pageSource, /onSearchChange=\{setSearch\}/)
  assert.match(pageSource, /listExecutions\(\{ integration_id: integrationId \}\)/)
})

test('Refresh keeps the current integration and reloads each resource once', async (t) => {
  const get = t.mock.method(apiClient, 'get', async () => ({ data: [] }))
  const monitor = resource()
  const options = resource()
  let pending
  const { tree } = render({ selectedIntegrationId: idA, search: 'order', onRefresh: () => {
    pending = Promise.all([
      monitor.load(() => executionService.listExecutions({ integration_id: idA })),
      options.load(() => executionService.listIntegrations()),
    ])
  } })
  const card = findElement(tree, (element) => element.props.title === 'Filtros')
  card.props.actions.props.onClick()
  await pending
  assert.deepEqual(get.mock.calls.map((call) => call.arguments), [
    ['/executions', { params: { integration_id: idA } }],
    ['/integrations'],
  ])
  assert.match(pageSource, /onRefresh=\{\(\) => \{\s*fetchExecutions\(selectedIntegrationId\)\s*fetchIntegrations\(\)/)
})

for (const [selectedIntegrationId, search, expected] of [
  ['', '', 'No hay ejecuciones.'],
  [idA, '', 'No hay ejecuciones para la integración seleccionada.'],
  ['', 'order', 'No hay ejecuciones que coincidan con los filtros actuales.'],
  [idA, 'order', 'No hay ejecuciones que coincidan con los filtros actuales.'],
]) {
  test(`successful empty state for integration=${selectedIntegrationId || 'All'} and search=${search || 'none'}`, () => {
    const { html } = render({ monitor: state(), selectedIntegrationId, search })
    assert.ok(html.includes(expected))
    assert.doesNotMatch(html, /role="alert"|Cargando ejecuciones/)
  })
}

test('execution errors are visible and never rendered as empty, even after previous success', async () => {
  const monitor = resource()
  await monitor.load(async () => ({ data: [execution] }))
  await monitor.load(async () => { throw new Error('HTTP 500') })
  for (const data of [[], monitor.state.data]) {
    const { html } = render({ monitor: { ...monitor.state, data }, search: 'no-match' })
    assert.match(html, /role="alert"[^>]*>No se pudieron cargar las ejecuciones/)
    assert.doesNotMatch(html, /No hay ejecuciones|Ver detalle/)
  }
})

test('a pending new selection shows loading instead of rows from the previous filter', async () => {
  const monitor = resource()
  await monitor.load(async () => ({ data: [execution] }))
  const next = deferred()
  const loading = monitor.load(() => next.promise)
  const { html } = render({ monitor: monitor.state, selectedIntegrationId: idB })
  assert.match(html, /Cargando ejecuciones/)
  assert.doesNotMatch(html, /No hay ejecuciones|Ver detalle/)
  next.resolve({ data: [] })
  await loading
})

test('options failure never discards successful executions; retry only reloads options', async (t) => {
  const monitor = resource()
  const options = resource()
  const requests = []
  let optionsAttempt = 0
  t.mock.method(apiClient, 'get', async (url) => {
    requests.push(url)
    if (url === '/executions') return { data: [execution] }
    if (++optionsAttempt === 1) throw new Error('HTTP 500')
    return { data: integrations }
  })
  const fetchOptions = () => options.load(() => executionService.listIntegrations(), 'No se pudieron cargar las integraciones.')
  await Promise.all([monitor.load(() => executionService.listExecutions()), fetchOptions()])
  let retry
  const { html, tree } = render({ monitor: monitor.state, options: options.state, onRetryIntegrations: () => { retry = fetchOptions() } })
  assert.match(html, /No se pudieron cargar las integraciones/)
  assert.match(html, /Todas las integraciones/)
  assert.ok(html.includes(`/executions/${traceId}`))
  assert.doesNotMatch(html, /No hay ejecuciones/)
  findElement(tree, (element) => element.props.children === 'Reintentar integraciones').props.onClick()
  assert.equal(options.state.loading, true)
  assert.equal(options.state.error, null)
  assert.equal(monitor.state.loading, false)
  await retry
  assert.deepEqual(options.state, state(integrations))
  assert.deepEqual(requests, ['/executions', '/integrations', '/integrations'])
  assert.match(pageSource, /onRetryIntegrations=\{fetchIntegrations\}/)
})

test('slow options do not block monitor results, and slow executions do not block options', () => {
  assert.match(render({ options: { ...state(), loading: true } }).html, /Ver detalle/)
  const { html } = render({ monitor: { ...state(), loading: true } })
  assert.match(html, /Pedidos históricos — inactiva/)
  assert.match(html, /Cargando ejecuciones/)
})

test('A → B → C: C wins even when earlier responses arrive after C', async () => {
  const monitor = resource()
  const pending = [deferred(), deferred(), deferred()]
  const loads = pending.map((request) => monitor.load(() => request.promise))
  pending[2].resolve({ data: [{ ...execution, integration_id: idC }] })
  await loads[2]
  pending[0].resolve({ data: [{ ...execution, integration_id: idA }] })
  pending[1].reject(new Error('late B failure'))
  await Promise.all(loads)
  assert.deepEqual(monitor.state, state([{ ...execution, integration_id: idC }]))
})

test('stale completion cannot clear loading or publish errors for a newer request', async () => {
  const monitor = resource()
  const old = deferred()
  const latest = deferred()
  const first = monitor.load(() => old.promise)
  const second = monitor.load(() => latest.promise)
  old.reject(new Error('late error'))
  await first
  assert.equal(monitor.state.loading, true)
  assert.equal(monitor.state.error, null)
  latest.resolve({ data: [] })
  await second
  assert.deepEqual(monitor.state, state())
})

test('unmount invalidates requests; a subsequent StrictMode setup can load again', async () => {
  const monitor = resource()
  const old = deferred()
  const first = monitor.load(() => old.promise)
  monitor.requestRef.current += 1
  const afterCleanup = monitor.state
  old.resolve({ data: [execution] })
  await first
  assert.equal(monitor.state, afterCleanup)
  await monitor.load(async () => ({ data: [execution] }))
  assert.deepEqual(monitor.state, state([execution]))
  assert.match(pageSource, /return \(\) => \{\s*executionRequestRef.current \+= 1\s*integrationRequestRef.current \+= 1/)
})

test('rendering many rows performs no requests and keeps trace links and message fields', (t) => {
  const get = t.mock.method(apiClient, 'get', async () => ({ data: [] }))
  const rows = Array.from({ length: 20 }, (_, index) => ({
    ...execution, trace_id: `${traceId}-${index}`, error_detail: { detail: 'Error de entrega' },
  }))
  rows.push({ id: 'fallback-id', integration_id: idC, status: 'pending' })
  const { html } = render({ monitor: state(rows) })
  assert.equal(get.mock.callCount(), 0)
  assert.equal((html.match(/href="\/executions\//g) || []).length, 40)
  assert.ok(html.includes(`/executions/${traceId}-0`))
  assert.match(html, /Pedidos Tienda Nube|Error de entrega|fallback-id/)
  assert.doesNotMatch(html, /href="\/executions\/fallback-id"|\/runs/)
  const effect = pageSource.match(/useEffect\(\(\) => \{([\s\S]*?)\}, \[fetchExecutions, fetchIntegrations\]\)/)?.[1] ?? ''
  assert.equal((effect.match(/fetchExecutions\(\)/g) || []).length, 1)
  assert.equal((effect.match(/fetchIntegrations\(\)/g) || []).length, 1)
  assert.doesNotMatch(pageSource, /Promise\.all|page_size|\boffset\b|\bcursor\b|tenant_id|\/runs/)
})
