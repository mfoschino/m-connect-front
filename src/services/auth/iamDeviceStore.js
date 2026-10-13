import { normalizeApiScope } from './iamStorage.js'

export const createIamDeviceStore = ({ apiBaseUrl, storage = null }) => {
  const prefix = `mconnect:iam:v1:${encodeURIComponent(normalizeApiScope(apiBaseUrl))}:device:`
  const keyFor = (email) => `${prefix}${encodeURIComponent(email.trim().toLowerCase())}`
  const area = () => storage ?? globalThis.localStorage
  return {
    get(email) {
      try { return area().getItem(keyFor(email)) || null } catch { return null }
    },
    save(email, token) {
      if (typeof token !== 'string' || !token) return false
      try { area().setItem(keyFor(email), token); return true } catch { return false }
    },
    remove(email) {
      try { area().removeItem(keyFor(email)); return true } catch { return false }
    },
  }
}
