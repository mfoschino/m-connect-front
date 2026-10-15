import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { after, before, test } from 'node:test'
import React from 'react'
import { renderToString } from 'react-dom/server'
import { createServer } from 'vite'
import {
  CONNECTION_TEST_UNAVAILABLE_MESSAGE,
  getConnectorFieldInputType,
  getNextConnectorConfig,
  reportConnectionTestUnavailable,
} from '../src/services/adapters/connectorConfigFormAdapter.js'
import { buildBackendIntegrationPayload } from '../src/services/adapters/integrationFlowAdapter.js'

let vite
let ConnectorConfigForm

before(async () => {
  vite = await createServer({
    appType: 'custom',
    logLevel: 'silent',
    server: { middlewareMode: true },
  })
  const module = await vite.ssrLoadModule(
    '/src/components/integrations/ConnectorConfigForm.jsx',
  )
  ConnectorConfigForm = module.default
})

after(async () => {
  await vite?.close()
})

const renderForm = (connectorType, config) => renderToString(
  React.createElement(ConnectorConfigForm, {
    connectorType,
    sourceSystemName: 'Sistema genérico',
    config,
    setConfig: () => {},
    onValidationChange: () => {},
  }),
)

const getInputTag = (html, id) => html.match(
  new RegExp(`<input\\b[^>]*id="${id}"[^>]*>`),
)?.[0] ?? ''

const getPreview = (html) => html.match(/<pre\b[^>]*>([\s\S]*?)<\/pre>/)?.[1] ?? ''

const stripEditableControls = (html) => html
  .replace(/<input\b[^>]*>/g, '')
  .replace(/<textarea\b[^>]*>[\s\S]*?<\/textarea>/g, '')

test('API connector masks secrets in inputs and preview while keeping safe values visible', () => {
  const html = renderForm('api', {
    base_url: 'https://api.example.test',
    endpoint: '/records',
    auth_type: 'api_key',
    api_key_header: 'X-API-Key',
    api_key: 'api-secret-value',
    client_secret: 'oauth-secret-value',
    refresh_token: 'refresh-secret-value',
    headers: {
      Authorization: 'Bearer header-secret-value',
      'Content-Type': 'application/json',
    },
  })
  const apiKeyInput = getInputTag(html, 'config-api_key')
  const headersInput = getInputTag(html, 'config-headers')
  const preview = getPreview(html)
  const visibleOutsideControls = stripEditableControls(html)

  assert.match(apiKeyInput, /type="password"/)
  assert.match(apiKeyInput, /value="api-secret-value"/)
  assert.match(headersInput, /type="password"/)
  assert.match(headersInput, /header-secret-value/)
  assert.match(preview, /endpoint/)
  assert.match(preview, /\/records/)
  assert.match(preview, /Content-Type/)
  assert.match(preview, /application\/json/)
  assert.match(preview, /\[configurado\]/)
  assert.doesNotMatch(preview, /api-secret-value|oauth-secret-value|refresh-secret-value|header-secret-value/)
  assert.doesNotMatch(
    visibleOutsideControls,
    /api-secret-value|oauth-secret-value|refresh-secret-value|header-secret-value/,
  )
})

test('database password is masked while host and username remain readable', () => {
  const html = renderForm('db', {
    dbType: 'postgresql',
    host: 'db.example.com',
    port: 5432,
    database: 'mconnect',
    username: 'integration_user',
    password: 'database-secret-value',
  })
  const passwordInput = getInputTag(html, 'config-password')
  const preview = getPreview(html)

  assert.match(passwordInput, /type="password"/)
  assert.match(passwordInput, /value="database-secret-value"/)
  assert.match(preview, /db\.example\.com/)
  assert.match(preview, /integration_user/)
  assert.match(preview, /\[configurado\]/)
  assert.doesNotMatch(preview, /database-secret-value/)
})

test('field type fallback is generic for OAuth-like and future connector metadata', () => {
  assert.equal(getConnectorFieldInputType({ id: 'accessToken', type: 'text' }), 'password')
  assert.equal(getConnectorFieldInputType({ id: 'client_secret', type: 'text' }), 'password')
  assert.equal(getConnectorFieldInputType({ id: 'refresh-token', type: 'textarea' }), 'password')
  assert.equal(getConnectorFieldInputType({ id: 'aws_secret_access_key', type: 'text' }), 'password')
  assert.equal(getConnectorFieldInputType({ id: 'custom', type: 'password' }), 'password')
  assert.equal(getConnectorFieldInputType({ id: 'client_id', type: 'text' }), 'text')
  assert.equal(getConnectorFieldInputType({ id: 'token_endpoint', type: 'text' }), 'text')
  assert.equal(getConnectorFieldInputType({ id: 'headers', type: 'json' }), 'password')
  assert.equal(getConnectorFieldInputType({ id: 'customHeaders', type: 'json' }), 'password')
  assert.equal(getConnectorFieldInputType({ id: 'authorization', type: 'checkbox' }), 'checkbox')
  assert.equal(getConnectorFieldInputType({ id: 'token', type: 'select' }), 'select')

  const html = renderForm('api', {
    base_url: 'https://api.example.test',
    endpoint: '/records',
    auth_type: 'none',
    client_id: 'public-client',
    client_secret: 'oauth-client-secret-value',
    refresh_token: 'oauth-refresh-secret-value',
  })
  const preview = getPreview(html)

  assert.match(preview, /public-client/)
  assert.match(preview, /\[configurado\]/)
  assert.doesNotMatch(preview, /oauth-client-secret-value|oauth-refresh-secret-value/)
})

test('field changes and final payload preserve real secrets without mutating input config', () => {
  const originalConfig = {
    endpoint: '/records?access_token=query-secret&page=1',
    api_key: 'original-api-secret',
    headers: {
      Authorization: 'Bearer original-header-secret',
      'Content-Type': 'application/json',
    },
  }
  const updatedConfig = getNextConnectorConfig(
    originalConfig,
    { id: 'api_key', type: 'password' },
    'updated-api-secret',
  )
  const payload = buildBackendIntegrationPayload({
    name: 'Integración genérica',
    source_entity: 'sales_order',
    source_system: 'generic-rest-api',
    connector_type: 'api',
    config: updatedConfig,
    schedule: null,
    is_active: true,
  })

  assert.equal(originalConfig.api_key, 'original-api-secret')
  assert.equal(updatedConfig.api_key, 'updated-api-secret')
  assert.equal(payload.config.api_key, 'updated-api-secret')
  assert.equal(payload.config.headers.Authorization, 'Bearer original-header-secret')
  assert.equal(payload.config.endpoint, '/records?access_token=query-secret&page=1')
  assert.doesNotMatch(JSON.stringify(payload), /\[configurado\]|\[no configurado\]/)
})

test('database and OAuth-like payloads also retain their original secret values', () => {
  const cases = [
    {
      connectorType: 'db',
      config: {
        host: 'db.example.test',
        username: 'integration_user',
        password: 'database-payload-secret',
      },
      expected: {
        password: 'database-payload-secret',
      },
    },
    {
      connectorType: 'api',
      config: {
        endpoint: '/oauth-records',
        client_id: 'public-client',
        client_secret: 'oauth-payload-secret',
        refresh_token: 'refresh-payload-secret',
      },
      expected: {
        client_secret: 'oauth-payload-secret',
        refresh_token: 'refresh-payload-secret',
      },
    },
  ]

  for (const { connectorType, config, expected } of cases) {
    const payload = buildBackendIntegrationPayload({
      name: 'Preserva secretos',
      source_entity: 'customer',
      source_system: 'generic-source',
      connector_type: connectorType,
      config,
    })

    for (const [key, value] of Object.entries(expected)) {
      assert.equal(payload.config[key], value)
    }
    assert.doesNotMatch(JSON.stringify(payload), /\[configurado\]|\[no configurado\]/)
  }
})

test('render, field update, payload build and unavailable connection action do not log secrets', (t) => {
  const consoleCalls = []
  for (const method of ['log', 'debug', 'info', 'warn', 'error']) {
    t.mock.method(console, method, (...args) => consoleCalls.push([method, args]))
  }

  renderForm('webhook', {
    secret: 'webhook-secret-value',
    description: 'Webhook genérico',
  })
  const nextConfig = getNextConnectorConfig(
    { password: 'database-secret-value' },
    { id: 'password', type: 'password' },
    'updated-database-secret-value',
  )
  buildBackendIntegrationPayload({
    name: 'Sin logs',
    source_entity: 'customer',
    source_system: 'postgresql',
    connector_type: 'db',
    config: nextConfig,
  })

  let connectionMessage = ''
  reportConnectionTestUnavailable((message) => {
    connectionMessage = message
  })

  assert.equal(connectionMessage, CONNECTION_TEST_UNAVAILABLE_MESSAGE)
  assert.match(connectionMessage, /no está disponible/i)
  assert.match(connectionMessage, /No se realizó ninguna validación ni solicitud/i)
  assert.deepEqual(consoleCalls, [])
})

test('integration configuration components contain no raw config or Axios error logging', async () => {
  const connectorSource = await readFile(
    new URL('../src/components/integrations/ConnectorConfigForm.jsx', import.meta.url),
    'utf8',
  )
  const integrationsSource = await readFile(
    new URL('../src/pages/integrations/Integrations.jsx', import.meta.url),
    'utf8',
  )
  const reviewAdapterSource = await readFile(
    new URL('../src/services/adapters/integrationReviewAdapter.js', import.meta.url),
    'utf8',
  )

  assert.doesNotMatch(connectorSource, /console\.(?:log|debug|info|warn|error)|\balert\s*\(/)
  assert.doesNotMatch(connectorSource, /JSON\.stringify\(config\b/)
  assert.doesNotMatch(integrationsSource, /console\.(?:log|debug|info|warn|error)/)
  assert.match(connectorSource, /adapters\/sensitiveConfigAdapter/)
  assert.match(integrationsSource, /adapters\/sensitiveConfigAdapter/)
  assert.match(reviewAdapterSource, /\.\/sensitiveConfigAdapter\.js/)
  assert.doesNotMatch(reviewAdapterSource, /tiendaNubeRunReadiness/)
})
