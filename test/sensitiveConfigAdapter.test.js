import assert from 'node:assert/strict'
import test from 'node:test'
import {
  isSensitiveConfigField,
  isSensitiveConfigKey,
  redactSensitiveConfig,
} from '../src/services/adapters/sensitiveConfigAdapter.js'

test('detects common sensitive keys across naming conventions and casing', () => {
  const sensitiveKeys = [
    'access_token',
    'accessToken',
    'ACCESS-TOKEN',
    'refresh_token',
    'refreshToken',
    'token',
    'api_key',
    'apiKey',
    'apikey',
    'password',
    'passwd',
    'secret',
    'client_secret',
    'clientSecret',
    'authorization',
    'authentication',
    'proxy_authorization',
    'bearer',
    'credential',
    'credentials',
    'private_key',
    'privateKey',
    'webhook_secret',
    'webhookSecret',
    'secret_key',
    'aws_secret_access_key',
    'AWSSecretAccessKey',
    'password_value',
    'credential_value',
  ]

  for (const key of sensitiveKeys) {
    assert.equal(isSensitiveConfigKey(key), true, `${key} should be sensitive`)
  }
})

test('keeps identifiers and credential descriptor fields non-sensitive', () => {
  const safeKeys = [
    'store_id',
    'tenant_id',
    'integration_id',
    'username',
    'endpoint',
    'data_path',
    'pagination',
    'content_type',
    'client_id',
    'token_endpoint',
    'oauthTokenEndpoint',
    'token_type',
    'api_key_header',
    'auth_type',
    'password_policy',
    'passwordless_enabled',
    'tokenizer_model',
    'secretary_email',
    'credential_status',
    'cookie_name',
    'api_key_rotation_enabled',
    'authentication_enabled',
    'authorization_scheme',
    'requires_authentication',
    'supports_authorization',
    'enable_cookie',
  ]

  for (const key of safeKeys) {
    assert.equal(isSensitiveConfigKey(key), false, `${key} should remain visible`)
  }
})

test('redacts simple secrets while preserving useful configuration', () => {
  const sanitized = redactSensitiveConfig({
    access_token: 'token-real',
    apiKey: 'key-real',
    password: 'password-real',
    clientSecret: 'secret-real',
    refreshToken: '',
    store_id: '123',
    endpoint: '/orders',
    data_path: 'items',
    pagination: {
      page: 1,
      per_page: 200,
    },
    token_endpoint: 'https://auth.example.test/oauth/token',
    description: 'Basic plan',
    token_help: 'Token endpoint',
    authentication_help: 'Basic authentication',
    bearer_help: 'Bearer authentication',
  })

  assert.deepEqual(sanitized, {
    access_token: '[configurado]',
    apiKey: '[configurado]',
    password: '[configurado]',
    clientSecret: '[configurado]',
    refreshToken: '[no configurado]',
    store_id: '123',
    endpoint: '/orders',
    data_path: 'items',
    pagination: {
      page: 1,
      per_page: 200,
    },
    token_endpoint: 'https://auth.example.test/oauth/token',
    description: 'Basic plan',
    token_help: 'Token endpoint',
    authentication_help: 'Basic authentication',
    bearer_help: 'Bearer authentication',
  })
})

test('redacts nested credential containers and secrets inside arrays', () => {
  const sanitized = redactSensitiveConfig({
    auth: {
      username: 'user',
      password: 'nested-password',
    },
    credentials: {
      client_id: 'public-id',
      client_secret: 'nested-secret',
    },
    accounts: [
      { store_id: 'one', accessToken: 'array-token-one' },
      { store_id: 'two', password: 'array-password-two' },
    ],
  })

  assert.deepEqual(sanitized, {
    auth: '[configurado]',
    credentials: '[configurado]',
    accounts: [
      { store_id: 'one', accessToken: '[configurado]' },
      { store_id: 'two', password: '[configurado]' },
    ],
  })
})

test('redacts sensitive and unknown headers but preserves explicitly safe headers', () => {
  const sanitized = redactSensitiveConfig({
    headers: {
      Authorization: 'Bearer authorization-secret',
      'Proxy-Authorization': 'Basic proxy-secret',
      Authentication: 'bearer authentication-secret',
      'X-API-Key': 'header-api-key',
      'Api-Key': 'second-header-api-key',
      Cookie: 'session=secret-cookie',
      'Set-Cookie': 'session=another-cookie',
      'X-Custom-Header': 'unknown-value',
      'Content-Type': 'application/json',
      Accept: 'application/json',
      'User-Agent': 'M-Connect',
    },
    custom_headers: {
      'X-Custom-Auth': 'custom-secret',
      Accept: 'application/json',
    },
    requestHeaders: {
      'X-Shop-Key': 'shop-secret',
      'Content-Type': 'application/json',
    },
    headersConfig: {
      'X-Subscription-Key': 'subscription-secret',
      Accept: 'application/json',
    },
    headers_map: {
      'X-Tenant-Key': 'tenant-secret',
      'User-Agent': 'M-Connect',
    },
    customHeaderMap: {
      'X-Partner-Key': 'partner-secret',
      Accept: 'application/json',
    },
    headers_enabled: true,
  })

  assert.deepEqual(sanitized.headers, {
    Authorization: '[configurado]',
    'Proxy-Authorization': '[configurado]',
    Authentication: '[configurado]',
    'X-API-Key': '[configurado]',
    'Api-Key': '[configurado]',
    Cookie: '[configurado]',
    'Set-Cookie': '[configurado]',
    'X-Custom-Header': '[configurado]',
    'Content-Type': 'application/json',
    Accept: 'application/json',
    'User-Agent': 'M-Connect',
  })

  assert.deepEqual(sanitized.custom_headers, {
    'X-Custom-Auth': '[configurado]',
    Accept: 'application/json',
  })
  assert.deepEqual(sanitized.requestHeaders, {
    'X-Shop-Key': '[configurado]',
    'Content-Type': 'application/json',
  })
  assert.deepEqual(sanitized.headersConfig, {
    'X-Subscription-Key': '[configurado]',
    Accept: 'application/json',
  })
  assert.deepEqual(sanitized.headers_map, {
    'X-Tenant-Key': '[configurado]',
    'User-Agent': 'M-Connect',
  })
  assert.deepEqual(sanitized.customHeaderMap, {
    'X-Partner-Key': '[configurado]',
    Accept: 'application/json',
  })
  assert.equal(sanitized.headers_enabled, true)

  assert.equal(redactSensitiveConfig({ headers: 'Authorization: Bearer raw-secret' }).headers, '[configurado]')
  assert.equal(redactSensitiveConfig({ authorization_header: 'Bearer raw-secret' }).authorization_header, '[configurado]')
  assert.equal(redactSensitiveConfig({ description: 'Basic plan' }).description, 'Basic plan')
})

test('redacts URL userinfo and sensitive query parameters without hiding safe parameters', () => {
  const originalUrl = 'https://user:password@example.com/orders?access_token=secret&page=1&status=paid'
  const sanitized = redactSensitiveConfig({
    base_url: originalUrl,
    callback: '//user:password@example.com/callback?client_secret=secret&per_page=200',
    signed_url: 'https://files.example.test/object?X-Amz-Signature=signed-secret&download=1',
  })

  assert.equal(
    sanitized.base_url,
    'https://[configurado]@example.com/orders?access_token=[configurado]&page=1&status=paid',
  )
  assert.equal(
    sanitized.callback,
    '//[configurado]@example.com/callback?client_secret=[configurado]&per_page=200',
  )
  assert.equal(
    sanitized.signed_url,
    'https://files.example.test/object?X-Amz-Signature=[configurado]&download=1',
  )
  assert.doesNotMatch(JSON.stringify(sanitized), /password|=secret/)
})

test('sanitization creates a deep copy without mutating the original', () => {
  const original = {
    endpoint: '/records?api_key=real-key&page=1',
    headers: {
      Authorization: 'Bearer real-token',
      Accept: 'application/json',
    },
    nested: [{ password: 'real-password' }],
  }
  const snapshot = structuredClone(original)
  const sanitized = redactSensitiveConfig(original)

  assert.deepEqual(original, snapshot)
  assert.notEqual(sanitized, original)
  assert.notEqual(sanitized.headers, original.headers)
  assert.notEqual(sanitized.nested, original.nested)
})

test('sensitive field detection respects metadata and falls back to field names', () => {
  assert.equal(isSensitiveConfigField({ id: 'plain_value', type: 'password' }), true)
  assert.equal(isSensitiveConfigField({ id: 'plain_value', input_type: 'password' }), true)
  assert.equal(isSensitiveConfigField({ id: 'plain_value', sensitive: true, type: 'text' }), true)
  assert.equal(isSensitiveConfigField({ id: 'plain_value', writeOnly: true, type: 'text' }), true)
  assert.equal(isSensitiveConfigField({ id: 'plain_value', format: 'secret' }), true)
  assert.equal(isSensitiveConfigField({ id: 'client_secret', type: 'text' }), true)
  assert.equal(isSensitiveConfigField({ id: 'secret_key', type: 'text' }), true)
  assert.equal(isSensitiveConfigField({ id: 'aws_secret_access_key', type: 'text' }), true)
  assert.equal(isSensitiveConfigField({ id: 'password_value', type: 'text' }), true)
  assert.equal(isSensitiveConfigField({ id: 'credential_value', type: 'text' }), true)
  assert.equal(isSensitiveConfigField({ id: 'refreshToken', type: 'textarea' }), true)
  assert.equal(isSensitiveConfigField({ id: 'headers', type: 'json' }), true)
  assert.equal(isSensitiveConfigField({ id: 'customHeaders', type: 'json' }), true)
  assert.equal(isSensitiveConfigField({ id: 'headersConfig', type: 'json' }), true)
  assert.equal(isSensitiveConfigField({ id: 'headers_map', type: 'json' }), true)
  assert.equal(isSensitiveConfigField({ id: 'customHeaderMap', type: 'json' }), true)
  assert.equal(isSensitiveConfigField({ id: 'client_id', type: 'text' }), false)
  assert.equal(isSensitiveConfigField({ id: 'token_endpoint', type: 'text' }), false)
  assert.equal(isSensitiveConfigField({ id: 'authentication_enabled', type: 'checkbox' }), false)
  assert.equal(isSensitiveConfigField({ id: 'requires_authentication', type: 'checkbox' }), false)
  assert.equal(isSensitiveConfigField({ id: 'supports_authorization', type: 'checkbox' }), false)
  assert.equal(isSensitiveConfigField({ id: 'enable_cookie', type: 'checkbox' }), false)
  assert.equal(isSensitiveConfigField({ id: 'headers_enabled', type: 'checkbox' }), false)
})
