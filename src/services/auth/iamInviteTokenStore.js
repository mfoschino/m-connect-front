import { normalizeApiScope } from './iamStorage.js'

// Token del link /invite mientras el usuario pasa por el login; vive sólo en la pestaña.
export const createIamInviteTokenStore = ({ apiBaseUrl, storage = null }) => {
  const key = `mconnect:iam:v1:${encodeURIComponent(normalizeApiScope(apiBaseUrl))}:invite-token`
  const area = () => storage ?? globalThis.sessionStorage
  return {
    get() {
      try { return area().getItem(key) || null } catch { return null }
    },
    save(token) {
      if (typeof token !== 'string' || !token) return false
      try { area().setItem(key, token); return true } catch { return false }
    },
    clear() {
      try { area().removeItem(key); return true } catch { return false }
    },
  }
}
