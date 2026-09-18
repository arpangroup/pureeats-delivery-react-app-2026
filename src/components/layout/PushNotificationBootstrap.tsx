import { usePushNotifications } from '@/hooks/usePushNotifications'

/** Registers this device's push token app-wide once a confirmed rider is signed in, and wires
 * foreground new-order pushes into IncomingOrderContext. Renders nothing - unlike the customer
 * app's version, there's no general notification toast here; a NEW_ORDER push goes straight to
 * the full-screen alert (see usePushNotifications). Mounted once above the router. */
export function PushNotificationBootstrap() {
  usePushNotifications()
  return null
}
