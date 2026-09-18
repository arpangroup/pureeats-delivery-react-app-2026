import axios, { AxiosError, type InternalAxiosRequestConfig } from 'axios'
import { API_BASE_URL, AUTH_REFRESH_TOKEN_STORAGE_KEY, AUTH_TOKEN_STORAGE_KEY, AUTH_USER_STORAGE_KEY, IS_MOCK } from '@/config/env'
import { getDeviceId } from '@/lib/deviceId'
import { readStorage, removeStorage, writeStorage } from '@/lib/storage'
import type { ApiError } from '@/types/common'
import type { AuthTokenResponse } from '@/types/auth'

// This is the ONLY place that knows how to talk to the real backend - the same Spring Boot app the
// customer and admin apps talk to. Every service in src/services/* calls through here when
// DATA_SOURCE === 'live'.
export const apiClient = axios.create({
  baseURL: API_BASE_URL,
  timeout: 15000,
  headers: {
    'Content-Type': 'application/json',
  },
})

apiClient.interceptors.request.use((config) => {
  const token = readStorage<string | null>(AUTH_TOKEN_STORAGE_KEY, null)
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  config.headers['X-Device-Id'] = getDeviceId()
  // The instance-level default 'Content-Type: application/json' header (set above) sticks even
  // for a FormData body, which stops the browser from setting its own multipart boundary - a
  // profile-photo upload would otherwise silently go out as an empty/invalid JSON-typed request.
  if (typeof FormData !== 'undefined' && config.data instanceof FormData) {
    delete config.headers['Content-Type']
  }
  return config
})

interface RetriableConfig extends InternalAxiosRequestConfig {
  _retry?: boolean
}

let refreshInFlight: Promise<string | null> | null = null

/** Rotates the refresh token once, sharing the in-flight request across concurrent 401s. */
function refreshAccessToken(): Promise<string | null> {
  if (!refreshInFlight) {
    refreshInFlight = (async () => {
      const refreshToken = readStorage<string | null>(AUTH_REFRESH_TOKEN_STORAGE_KEY, null)
      if (!refreshToken) return null
      try {
        const { data } = await apiClient.post<{ data: AuthTokenResponse }>('/auth/refresh', { refreshToken })
        writeStorage(AUTH_TOKEN_STORAGE_KEY, data.data.accessToken)
        writeStorage(AUTH_REFRESH_TOKEN_STORAGE_KEY, data.data.refreshToken)
        return data.data.accessToken
      } catch {
        return null
      }
    })().finally(() => {
      refreshInFlight = null
    })
  }
  return refreshInFlight
}

apiClient.interceptors.response.use(
  (response) => response,
  async (error: AxiosError<{ message?: string; errors?: Record<string, string> }>) => {
    const config = error.config as RetriableConfig | undefined
    const isRefreshCall = config?.url === '/auth/refresh'

    if (!IS_MOCK && error.response?.status === 401 && config && !config._retry && !isRefreshCall) {
      config._retry = true
      const newAccessToken = await refreshAccessToken()
      if (newAccessToken) {
        config.headers.Authorization = `Bearer ${newAccessToken}`
        return apiClient(config)
      }
      removeStorage(AUTH_TOKEN_STORAGE_KEY)
      removeStorage(AUTH_REFRESH_TOKEN_STORAGE_KEY)
      removeStorage(AUTH_USER_STORAGE_KEY)
    }

    const apiError: ApiError = {
      message: error.response?.data?.message ?? error.message ?? 'Something went wrong',
      status: error.response?.status,
      fieldErrors: error.response?.data?.errors,
    }
    return Promise.reject(apiError)
  },
)
