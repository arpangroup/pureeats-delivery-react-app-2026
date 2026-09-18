/**
 * Single source of truth for "where does data come from".
 *
 * Everything in src/services/* reads DATA_SOURCE and either returns the organized mock fixtures
 * (src/mocks) or calls the real API through src/lib/apiClient.ts. No component ever branches on
 * this itself - the branch lives once, here, and in each service file's `if` at the top of each
 * function. Flipping VITE_DATA_SOURCE=live in .env (or `npm run dev:uat`) is the only change
 * needed to point the whole app at the same Spring Boot backend the customer/admin apps talk to.
 */

export type DataSource = 'mock' | 'live'

export const DATA_SOURCE: DataSource = (import.meta.env.VITE_DATA_SOURCE as DataSource) || 'mock'

export const IS_MOCK = DATA_SOURCE === 'mock'

// Note: the backend's real base path is /api/v1 (not /api) - this differs from the customer app's
// own default, which currently points at :8080/api.
export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8081/api/v1'

export const MOCK_DELAY_MS = Number(import.meta.env.VITE_MOCK_DELAY_MS ?? 350)

/** True for `vite dev`/`dev:uat` (any local dev server), false for a real `vite build`. */
export const IS_DEV = import.meta.env.DEV

/** This build's own version (from package.json, injected by vite.config.ts). */
export const APP_VERSION = __APP_VERSION__

/**
 * Firebase project config for push notifications (new-order alerts) - every field defaults to
 * empty since no Firebase project exists yet locally. `src/lib/firebaseMessaging.ts` checks
 * `HAS_FIREBASE_CONFIG` before doing anything; with it unset, new-order alerts fall back entirely
 * to `useAvailableOrdersPolling`'s polling. Fill these in (gitignored .env.local) once a real
 * Firebase project is created - no code change needed after.
 */
export const FIREBASE_CONFIG = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || '',
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || '',
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || '',
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || '',
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || '',
  appId: import.meta.env.VITE_FIREBASE_APP_ID || '',
}
export const FIREBASE_VAPID_KEY = import.meta.env.VITE_FIREBASE_VAPID_KEY || ''
export const HAS_FIREBASE_CONFIG = !!(FIREBASE_CONFIG.apiKey && FIREBASE_CONFIG.projectId && FIREBASE_CONFIG.appId && FIREBASE_VAPID_KEY)

export const AUTH_TOKEN_STORAGE_KEY = 'pureeats.rider.auth.token'
export const AUTH_USER_STORAGE_KEY = 'pureeats.rider.auth.user'
export const AUTH_REFRESH_TOKEN_STORAGE_KEY = 'pureeats.rider.auth.refreshToken'
