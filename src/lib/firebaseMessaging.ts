import type { FirebaseApp } from 'firebase/app'
import type { Messaging, MessagePayload } from 'firebase/messaging'
import { FIREBASE_CONFIG, FIREBASE_VAPID_KEY, HAS_FIREBASE_CONFIG } from '@/config/env'

/**
 * Firebase Cloud Messaging wiring for push notifications (new-order-assignment alerts) - entirely
 * inert until real Firebase project config exists via VITE_FIREBASE_* env vars (see
 * src/config/env.ts). Every export here is a safe no-op without that config, so the rest of the
 * app can call these unconditionally - `useAvailableOrdersPolling` is always the fallback.
 *
 * Note: this only covers *foreground* messaging (the tab is open). The background handler
 * (public/firebase-messaging-sw.js) is a plain static file outside Vite's build, so it can't read
 * the env vars this module does at runtime - it has its own values filled in by hand.
 *
 * The `firebase` package itself is dynamically imported (only reached past the config-completeness
 * check) so it never lands in the main bundle for the default polling-only case.
 */

let app: FirebaseApp | null = null
let messaging: Messaging | null = null
let initialized = false

async function getMessagingInstance(): Promise<Messaging | null> {
  if (!HAS_FIREBASE_CONFIG) {
    return null
  }
  if (typeof window === 'undefined' || !('serviceWorker' in navigator)) {
    console.warn('[push] service workers unsupported in this browser/context')
    return null
  }
  if (!messaging || !initialized) {
    const [{ initializeApp }, { getMessaging }] = await Promise.all([import('firebase/app'), import('firebase/messaging')])
    app = initializeApp(FIREBASE_CONFIG)
    messaging = getMessaging(app)
    initialized = true
  }
  return messaging
}

/**
 * Registers the messaging service worker, asks for notification permission, and returns this
 * device's FCM registration token (or null if unsupported, unconfigured, or denied) - the caller is
 * responsible for sending it to `notificationService.registerPushToken`.
 */
export async function requestPushToken(): Promise<string | null> {
  const instance = await getMessagingInstance()
  if (!instance) return null
  try {
    const permission = await Notification.requestPermission()
    if (permission !== 'granted') {
      console.warn(`[push] notification permission not granted (browser returned "${permission}")`)
      return null
    }
    const { getToken } = await import('firebase/messaging')
    const registration = await navigator.serviceWorker.register('/firebase-messaging-sw.js')
    const token = await getToken(instance, { vapidKey: FIREBASE_VAPID_KEY, serviceWorkerRegistration: registration })
    console.info('[push] got FCM token', token)
    return token
  } catch (err) {
    // Any failure (blocked permission, no service worker support, network error registering with
    // FCM, ...) just means push isn't available on this device right now - polling still works.
    console.error('[push] requestPushToken failed', err)
    return null
  }
}

/**
 * Subscribes to messages that arrive while the app is in the foreground. Returns an unsubscribe
 * function synchronously (a no-op one until the async subscribe resolves, and permanently a no-op
 * without Firebase configured) so callers can treat it uniformly regardless of config state.
 */
export function onForegroundMessage(callback: (payload: MessagePayload) => void): () => void {
  let unsubscribe: (() => void) | null = null
  let cancelled = false

  getMessagingInstance().then(async (instance) => {
    if (!instance || cancelled) return
    const { onMessage } = await import('firebase/messaging')
    if (cancelled) return
    unsubscribe = onMessage(instance, callback)
  })

  return () => {
    cancelled = true
    unsubscribe?.()
  }
}
