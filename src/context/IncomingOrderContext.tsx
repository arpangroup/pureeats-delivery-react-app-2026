import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from 'react'
import type { AvailableOrder } from '@/types/entities'

/** How long the full-screen alert stays up before auto-dismissing. */
export const INCOMING_ORDER_ALERT_MS = 20_000

interface IncomingOrderContextValue {
  incomingOrder: AvailableOrder | null
  /** Wall-clock ms when the current alert was raised - the countdown is derived from this rather than
   * from interval ticks, so it stays correct after the tab was backgrounded (timers get throttled). */
  shownAt: number | null
  showIncomingOrder: (order: AvailableOrder) => void
  clearIncomingOrder: () => void
}

/** One offer of one order - the same order offered again is a different key. */
function offerKey(order: Pick<AvailableOrder, 'id' | 'offerRound'>): string {
  return `${order.id}:${order.offerRound ?? 1}`
}

const IncomingOrderContext = createContext<IncomingOrderContextValue | undefined>(undefined)

/**
 * The single place a new-order alert gets surfaced. Both the available-orders poll (RiderSession)
 * and the foreground push handler in `usePushNotifications` write into this - nothing else in the
 * app shows a competing "new order" UI. `FullScreenOrderAlert` (mounted once at the app root,
 * outside routing) is the only reader.
 *
 * Because push and polling now BOTH run (push alone misses everything that arrives while the app
 * is backgrounded), each offer of an order is alerted once per session - whichever path sees it first
 * wins, the other is ignored. An order nobody took is offered again by the server (a new `offerRound`),
 * which alerts again.
 */
export function IncomingOrderProvider({ children }: { children: ReactNode }) {
  const [incomingOrder, setIncomingOrder] = useState<AvailableOrder | null>(null)
  const [shownAt, setShownAt] = useState<number | null>(null)
  const alertedIds = useRef<Set<string>>(new Set())

  const showIncomingOrder = useCallback((order: AvailableOrder) => {
    const key = offerKey(order)
    if (alertedIds.current.has(key)) return
    alertedIds.current.add(key)
    // Only ever one at a time - a second alert arriving while one is already showing just replaces
    // it with whichever is newest, it never stacks.
    setIncomingOrder(order)
    setShownAt(Date.now())
  }, [])

  const clearIncomingOrder = useCallback(() => {
    setIncomingOrder(null)
    setShownAt(null)
  }, [])

  const value = useMemo<IncomingOrderContextValue>(
    () => ({ incomingOrder, shownAt, showIncomingOrder, clearIncomingOrder }),
    [incomingOrder, shownAt, showIncomingOrder, clearIncomingOrder],
  )

  return <IncomingOrderContext.Provider value={value}>{children}</IncomingOrderContext.Provider>
}

export function useIncomingOrder(): IncomingOrderContextValue {
  const ctx = useContext(IncomingOrderContext)
  if (!ctx) throw new Error('useIncomingOrder must be used within IncomingOrderProvider')
  return ctx
}
