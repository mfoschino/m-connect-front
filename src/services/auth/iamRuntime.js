import axios from 'axios'
import apiClient from '../api/client.js'
import { createIamTransport } from './iamTransport.js'
import { createIamStorage } from './iamStorage.js'
import { createIamSession } from './iamSession.js'
import { installIamAxios } from './installIamAxios.js'
import { createIamDeviceStore } from './iamDeviceStore.js'
import { createIamInviteTokenStore } from './iamInviteTokenStore.js'
import { createIamAccountService } from './iamAccountService.js'
import { createIamAuthController } from './iamAuthController.js'

const apiBaseUrl = new URL(apiClient.defaults.baseURL, globalThis.location?.origin).href
const transportClient = axios.create({
  baseURL: apiClient.defaults.baseURL,
  headers: { 'Content-Type': 'application/json' },
  timeout: apiClient.defaults.timeout,
})
const transport = createIamTransport(transportClient)
const storage = createIamStorage({ apiBaseUrl })
const manager = createIamSession({ transport, storage })
const deviceStore = createIamDeviceStore({ apiBaseUrl })
const clearLegacy = () => {
  try { globalThis.localStorage?.removeItem('mconnect_session') } catch { /* Sin fallback legacy. */ }
}

export const iamInviteToken = createIamInviteTokenStore({ apiBaseUrl })
export const iamAuth = createIamAuthController({ manager, transport, deviceStore,
  inviteTokenStore: iamInviteToken, clearLegacy })
export const iamAccount = createIamAccountService(apiClient)

let references = 0
let uninstall = null
let disposeTimer = null
export const acquireIamRuntime = () => {
  if (disposeTimer) clearTimeout(disposeTimer)
  disposeTimer = null
  if (!uninstall) uninstall = installIamAxios(apiClient, { manager, apiBaseUrl,
    onForbidden: iamAuth.revalidateAfterForbidden,
    isBusinessReady: iamAuth.isBusinessReady })
  references += 1
  return () => {
    references -= 1
    if (references > 0) return
    // StrictMode desmonta y monta efectos inmediatamente en desarrollo.
    disposeTimer = setTimeout(() => {
      if (references > 0) return
      iamAuth.suspend()
      uninstall?.()
      uninstall = null
      manager.stopSync()
      disposeTimer = null
    }, 0)
  }
}
