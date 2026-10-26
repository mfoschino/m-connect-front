import test from 'node:test'
import assert from 'node:assert/strict'
import { decideInviteScreen, readInviteToken } from '../src/services/invitationAcceptFlow.js'

// Un token de 43 caracteres, como los reales
const VALID_TOKEN = 'a'.repeat(43)

// ---------- readInviteToken ----------

test('readInviteToken: devuelve el token cuando viene en el hash', () => {
  const result = readInviteToken(`#token=${VALID_TOKEN}`)
  assert.equal(result, VALID_TOKEN)
})

test('readInviteToken: devuelve vacío si el hash está vacío', () => {
  assert.equal(readInviteToken(''), '')
})

test('readInviteToken: devuelve vacío si el hash no tiene token', () => {
  assert.equal(readInviteToken('#otra=cosa'), '')
})

test('readInviteToken: rechaza un token demasiado corto', () => {
  assert.equal(readInviteToken('#token=corto'), '')
})

test('readInviteToken: rechaza un token demasiado largo', () => {
  const longToken = 'a'.repeat(129)
  assert.equal(readInviteToken(`#token=${longToken}`), '')
})

test('readInviteToken: devuelve vacío si no recibe un texto', () => {
  assert.equal(readInviteToken(undefined), '')
})

// ---------- decideInviteScreen ----------

// Arma una invitación de prueba. Con "overrides" cambiás solo lo que necesites.
const buildPreview = (overrides = {}) => ({
  email: 'ana@empresa.com',
  tenant_name: 'Acme Corp',
  role: 'viewer',
  invited_by: null,
  expires_at: '2026-10-20T12:00:00Z',
  account_exists: false,
  ...overrides,
})

test('decideInviteScreen: sin cuenta y sin sesión → create', () => {
  const screen = decideInviteScreen({
    preview: buildPreview({ account_exists: false }),
    authenticated: false,
    user: null,
  })
  assert.equal(screen, 'create')
})

test('decideInviteScreen: con cuenta y sin sesión → login_required', () => {
  const screen = decideInviteScreen({
    preview: buildPreview({ account_exists: true }),
    authenticated: false,
    user: null,
  })
  assert.equal(screen, 'login_required')
})

test('decideInviteScreen: sin cuenta, otra sesión abierta → create_other_session', () => {
  const screen = decideInviteScreen({
    preview: buildPreview({ account_exists: false }),
    authenticated: true,
    user: { email: 'otra@empresa.com', platform_role: null },
  })
  assert.equal(screen, 'create_other_session')
})

test('decideInviteScreen: con cuenta, superadmin logueado → superadmin', () => {
  const screen = decideInviteScreen({
    preview: buildPreview({ account_exists: true }),
    authenticated: true,
    user: { email: 'root@morganatec.com', platform_role: 'superadmin' },
  })
  assert.equal(screen, 'superadmin')
})

test('decideInviteScreen: con cuenta, otra cuenta logueada → wrong_account', () => {
  const screen = decideInviteScreen({
    preview: buildPreview({ account_exists: true }),
    authenticated: true,
    user: { email: 'otra@empresa.com', platform_role: null },
  })
  assert.equal(screen, 'wrong_account')
})

test('decideInviteScreen: con cuenta, cuenta correcta → accept_with_session', () => {
  const screen = decideInviteScreen({
    preview: buildPreview({ account_exists: true }),
    authenticated: true,
    user: { email: 'ana@empresa.com', platform_role: null },
  })
  assert.equal(screen, 'accept_with_session')
})

test('decideInviteScreen: con cuenta, mismo email con mayúsculas → accept_with_session', () => {
  const screen = decideInviteScreen({
    preview: buildPreview({ account_exists: true }),
    authenticated: true,
    user: { email: 'Ana@Empresa.com', platform_role: null },
  })
  assert.equal(screen, 'accept_with_session')
})