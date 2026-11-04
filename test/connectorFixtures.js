export const definition = (id = 'definition-a', extra = {}) => ({
  id, owner_tenant_id: null, visibility: 'public', code: null, name: `Conector ${id}`,
  driver: 'api', kind: 'input', description: 'Conexión de entrada', is_active: true,
  active_version: { id: 'version-a', version: '1.0.0', installation_form: [], integration_form: [] },
  created_at: '2026-10-05T10:00:00Z', updated_at: '2026-10-06T10:00:00Z', ...extra,
})

export const installation = (id = 'installation-a', extra = {}) => ({
  id, tenant_id: 'tenant-a', definition_version_id: 'version-a', version: '1.0.0',
  connector: { id: 'definition-a', code: null, name: 'API de pedidos', kind: 'input', driver: 'api' },
  name: `Conexión ${id}`, config: {}, secret_fields: ['auth_token'], integration_form: [],
  is_active: true, created_at: '2026-10-05T10:00:00Z', updated_at: '2026-10-06T10:00:00Z', ...extra,
})

export const deferred = () => {
  let resolve
  let reject
  const promise = new Promise((resolvePromise, rejectPromise) => {
    resolve = resolvePromise
    reject = rejectPromise
  })
  return { promise, resolve, reject }
}
