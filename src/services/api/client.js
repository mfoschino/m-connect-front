import axios from 'axios'

const apiClient = axios.create({
  baseURL: import.meta.env.VITE_API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 10000,
})

apiClient.interceptors.request.use((config) => {
  try {
    const session = JSON.parse(localStorage.getItem('mconnect_session') || '{}')

    if (session?.token) {
      config.headers.Authorization = `Bearer ${session.token}`
    }
  } catch {
    // Keep requests usable if local storage contains malformed session data.
  }

  return config
})

export default apiClient
