import { useEffect } from 'react'
import { useAuth } from '@/hooks/useAuth'
import { useIncomingOrder } from '@/context/IncomingOrderContext'
import { onForegroundMessage, requestPushToken } from '@/lib/firebaseMessaging'
import { notificationService } from '@/services/notificationService'
import { deliveryOrderService } from '@/services/deliveryOrderService'
import type { AvailableOrder } from '@/types/entities'

/**
 * Best-effort parse of an AvailableOrder out of a push payload's `data` map (all FCM data values
 * arrive as strings). The backend's PushNotificationSender.java only guarantees `type` and
 * `orderId` land on the wire today - everything else here is optional, so this returns null the
 * moment a required numeric field is missing/unparseable rather than showing a broken alert; the
 * caller falls back to a fresh listAvailable() fetch in that case.
 */
function tryParseAvailableOrder(data: Record<string, string>): AvailableOrder | null {
  const id = Number(data.orderId)
  if (!Number.isFinite(id)) return null
  const distanceKm = Number(data.distanceKm)
  const payoutEstimate = Number(data.payoutEstimate)
  const restaurantLat = Number(data.restaurantLat)
  const restaurantLng = Number(data.restaurantLng)
  const customerLat = Number(data.customerLat)
  const customerLng = Number(data.customerLng)
  const itemsCount = Number(data.itemsCount)
  if (![distanceKm, payoutEstimate, restaurantLat, restaurantLng, customerLat, customerLng, itemsCount].every(Number.isFinite)) return null
  if (!data.restaurantName || !data.customerAddress) return null
  return {
    id,
    uniqueOrderId: data.uniqueOrderId ?? String(id),
    restaurantName: data.restaurantName,
    restaurantAddress: data.restaurantAddress ?? '',
    restaurantLat,
    restaurantLng,
    customerAddress: data.customerAddress,
    customerLat,
    customerLng,
    distanceKm,
    payoutEstimate,
    itemsCount,
    createdAt: data.createdAt ?? new Date().toISOString(),
  }
}

/**
 * App-wide push registration + foreground new-order handling - mounted once via
 * PushNotificationBootstrap, independent of any one page. Registers this device's FCM token
 * whenever a confirmed rider (role DELIVERY) is signed in. The critical payload contract: the
 * backend sends a "category" internally but it arrives on the wire as `payload.data.type`
 * (PushNotificationSender.java does `data.put("type", category)`), NOT `payload.data.category`.
 *
 * For `type === 'NEW_ORDER'` this goes STRAIGHT to the full-screen alert via
 * IncomingOrderContext - no toast, unlike the customer app's general notification toast. Any other
 * category is ignored entirely; this app has no general notification-center UI to feed.
 */
export function usePushNotifications() {
  const { user, isRider } = useAuth()
  const { showIncomingOrder } = useIncomingOrder()

  useEffect(() => {
    if (!user || !isRider) return
    let cancelled = false

    requestPushToken().then((token) => {
      if (cancelled || !token) return
      notificationService
        .registerPushToken(token)
        .then(() => console.info('[push] token registered with backend'))
        .catch((err) => console.error('[push] POST /notifications/push-token failed', err))
    })

    const unsubscribe = onForegroundMessage((payload) => {
      if (payload.data?.type !== 'NEW_ORDER') return
      const parsed = payload.data ? tryParseAvailableOrder(payload.data as Record<string, string>) : null
      if (parsed) {
        showIncomingOrder(parsed)
        return
      }
      // Payload didn't carry enough to build a full order - fetch fresh and show whatever's newest.
      deliveryOrderService
        .listAvailable()
        .then((orders) => {
          if (cancelled || orders.length === 0) return
          const newest = [...orders].sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))[0]
          showIncomingOrder(newest)
        })
        .catch(() => undefined)
    })

    return () => {
      cancelled = true
      unsubscribe()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, isRider])
}
