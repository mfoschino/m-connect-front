export class IamStorageError extends Error {
  constructor(code) {
    super(code)
    this.name = 'IamStorageError'
    this.code = code
  }
}

const hasText = (value) => typeof value === 'string' && value.length > 0

export const normalizeApiScope = (apiBaseUrl) => {
  let url
  try {
    url = new URL(apiBaseUrl)
  } catch {
    throw new IamStorageError('invalid_api_scope')
  }
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password
    || url.search || url.hash) {
    throw new IamStorageError('invalid_api_scope')
  }
  return `${url.origin}${url.pathname.replace(/\/$/, '')}`
}

const parseStored = (raw, valid, area, key) => {
  if (raw === null) return null
  try {
    const value = JSON.parse(raw)
    if (valid(value)) return value
  } catch {
    // La clave propia corrupta se descarta; nunca se toca la sesión legacy.
  }
  try {
    area.removeItem(key)
  } catch {
    throw new IamStorageError('storage_unavailable')
  }
  throw new IamStorageError('corrupt_storage')
}

const validCredential = (value) => value?.version === 1
  && ['temporary', 'persistent'].includes(value.mode)
  && hasText(value.contextId) && hasText(value.revision)
  && hasText(value.refreshToken)

const validMarker = (value) => value?.version === 1
  && hasText(value.contextId) && hasText(value.revision)
  && ['ready', 'inflight'].includes(value.phase)
  && (value.phase !== 'inflight' || hasText(value.attemptId))

export const createIamStorage = ({ apiBaseUrl, temporaryStorage, persistentStorage }) => {
  const scope = normalizeApiScope(apiBaseUrl)
  const prefix = `mconnect:iam:v1:${encodeURIComponent(scope)}`
  const credentialKey = `${prefix}:refresh`
  const markerKey = `${prefix}:rotation`
  const probeKey = `${prefix}:capability-probe:${Math.random().toString(36).slice(2)}`

  const area = (kind) => {
    try {
      const result = kind === 'temporary'
        ? (temporaryStorage ?? globalThis.sessionStorage)
        : (persistentStorage ?? globalThis.localStorage)
      if (!result) throw new Error('missing storage')
      return result
    } catch {
      throw new IamStorageError('storage_unavailable')
    }
  }

  const readOne = (kind) => {
    const target = area(kind)
    try {
      return parseStored(target.getItem(credentialKey), validCredential, target, credentialKey)
    } catch (error) {
      if (error instanceof IamStorageError) throw error
      throw new IamStorageError('storage_unavailable')
    }
  }

  const readCredentials = () => {
    const temporary = readOne('temporary')
    const persistent = readOne('persistent')
    if (temporary && persistent) throw new IamStorageError('ambiguous_storage')
    const value = temporary ?? persistent
    if (value && value.mode !== (temporary ? 'temporary' : 'persistent')) {
      throw new IamStorageError('corrupt_storage')
    }
    return value
  }

  const writeCredentials = (record) => {
    if (!validCredential(record)) throw new IamStorageError('invalid_credential_record')
    const chosen = area(record.mode)
    const other = area(record.mode === 'temporary' ? 'persistent' : 'temporary')
    try {
      chosen.setItem(credentialKey, JSON.stringify(record))
      other.removeItem(credentialKey)
    } catch {
      try { chosen.removeItem(credentialKey) } catch { /* Se informará el fallo. */ }
      throw new IamStorageError('storage_unavailable')
    }
  }

  const readMarker = () => {
    const target = area('persistent')
    try {
      return parseStored(target.getItem(markerKey), validMarker, target, markerKey)
    } catch (error) {
      if (error instanceof IamStorageError) throw error
      throw new IamStorageError('storage_unavailable')
    }
  }

  const writeMarker = (marker) => {
    if (!validMarker(marker)) throw new IamStorageError('invalid_marker')
    try {
      area('persistent').setItem(markerKey, JSON.stringify(marker))
    } catch {
      throw new IamStorageError('storage_unavailable')
    }
  }

  const clearContext = (contextId) => {
    // El orden deja primero una marca no utilizable si el borrado se interrumpe.
    const marker = readMarker()
    if (marker?.contextId === contextId) {
      writeMarker({ ...marker, phase: 'inflight', attemptId: 'closed' })
    }
    for (const kind of ['temporary', 'persistent']) {
      const record = readOne(kind)
      if (record?.contextId === contextId) {
        try { area(kind).removeItem(credentialKey) } catch {
          throw new IamStorageError('storage_unavailable')
        }
      }
    }
    if (marker?.contextId === contextId) {
      try { area('persistent').removeItem(markerKey) } catch {
        throw new IamStorageError('storage_unavailable')
      }
    }
  }

  const assertAvailable = () => {
    for (const kind of ['temporary', 'persistent']) {
      const target = area(kind)
      let previous
      try {
        previous = target.getItem(probeKey)
        target.setItem(probeKey, 'available')
        if (target.getItem(probeKey) !== 'available') {
          throw new IamStorageError('storage_unavailable')
        }
        if (previous === null) target.removeItem(probeKey)
        else target.setItem(probeKey, previous)
      } catch {
        try {
          if (previous === null) target.removeItem(probeKey)
          else if (previous !== undefined) target.setItem(probeKey, previous)
        } catch { /* La capacidad ya se informa como no disponible. */ }
        throw new IamStorageError('storage_unavailable')
      }
    }
  }

  const observeMarker = (listener, eventTarget = globalThis) => {
    if (typeof eventTarget?.addEventListener !== 'function'
      || typeof eventTarget?.removeEventListener !== 'function') {
      throw new IamStorageError('context_events_unavailable')
    }
    const persistent = area('persistent')
    const onStorage = (event) => {
      if (event.key === markerKey
        && (!event.storageArea || event.storageArea === persistent)) listener()
    }
    try { eventTarget.addEventListener('storage', onStorage) } catch {
      throw new IamStorageError('context_events_unavailable')
    }
    return () => eventTarget.removeEventListener('storage', onStorage)
  }

  return { scope, assertAvailable, readCredentials, writeCredentials,
    readMarker, writeMarker, clearContext, observeMarker }
}
