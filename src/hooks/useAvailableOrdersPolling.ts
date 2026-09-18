import { useEffect, useRef } from 'react'
import { HAS_FIREBASE_CONFIG } from '@/config/env'
import { useIncomingOrder } from '@/context/IncomingOrderContext'
import { deliveryOrderService } from '@/services/deliveryOrderService'

const POLL_INTERVAL_MS = 9000

/**
 * Fallback new-order detection for when push isn't available - polls
 * `deliveryOrderService.listAvailable()` and diffs against the PREVIOUS poll's snapshot of order
 * ids (not an ever-growing "ever seen" set - the mock fixture pool is small and orders age in/out,
 * so an id that was visible, then aged out, then got re-admitted later must be able to surface
 * again), surfacing whichever new order is newest via IncomingOrderContext (never more than one at
 * a time; see that context's own comment). Only runs when push genuinely can't do the job: no
 * Firebase config, or the browser hasn't granted notification permission - the exact same orders
 * would otherwise be double-announced by both this and the push handler in usePushNotifications.
 * Also gated on the rider actually being online and not already mid-delivery.
 */
export function useAvailableOrdersPolling(params: { isOnline: boolean; hasActiveDelivery: boolean }) {
  const { isOnline, hasActiveDelivery } = params
  const { showIncomingOrder } = useIncomingOrder()
  const previousIds = useRef<Set<number> | null>(null)

  useEffect(() => {
    const pushCanHandleIt = HAS_FIREBASE_CONFIG && typeof Notification !== 'undefined' && Notification.permission === 'granted'
    const shouldPoll = isOnline && !hasActiveDelivery && !pushCanHandleIt
    if (!shouldPoll) return

    let cancelled = false

    async function poll() {
      try {
        const orders = await deliveryOrderService.listAvailable()
        if (cancelled) return
        const previous = previousIds.current
        // First poll after (re)starting establishes the baseline silently - only orders that
        // appear on a LATER poll than the one that first saw them count as "new".
        const freshOnes = previous ? orders.filter((o) => !previous.has(o.id)) : []
        previousIds.current = new Set(orders.map((o) => o.id))
        if (freshOnes.length > 0) {
          // Only ever surface one alert at a time - whichever fresh order is newest.
          const newest = [...freshOnes].sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))[0]
          showIncomingOrder(newest)
        }
      } catch {
        // transient network error - just try again next tick
      }
    }

    poll()
    const intervalId = setInterval(poll, POLL_INTERVAL_MS)
    return () => {
      cancelled = true
      clearInterval(intervalId)
    }
  }, [isOnline, hasActiveDelivery, showIncomingOrder])
}
