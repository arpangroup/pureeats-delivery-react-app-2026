import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react'
import type { AvailableOrder } from '@/types/entities'

interface IncomingOrderContextValue {
  incomingOrder: AvailableOrder | null
  showIncomingOrder: (order: AvailableOrder) => void
  clearIncomingOrder: () => void
}

const IncomingOrderContext = createContext<IncomingOrderContextValue | undefined>(undefined)

/**
 * The single place a new-order alert gets surfaced. Both `useAvailableOrdersPolling` (the fallback
 * path when push isn't configured/permitted) and the foreground push handler in
 * `usePushNotifications` write into this - nothing else in the app shows a competing "new order"
 * UI. `FullScreenOrderAlert` (mounted once at the app root, outside routing) is the only reader.
 */
export function IncomingOrderProvider({ children }: { children: ReactNode }) {
  const [incomingOrder, setIncomingOrder] = useState<AvailableOrder | null>(null)

  const showIncomingOrder = useCallback((order: AvailableOrder) => {
    // Only ever one at a time - a second alert arriving while one is already showing just replaces
    // it with whichever is newest, it never stacks.
    setIncomingOrder(order)
  }, [])

  const clearIncomingOrder = useCallback(() => setIncomingOrder(null), [])

  const value = useMemo<IncomingOrderContextValue>(
    () => ({ incomingOrder, showIncomingOrder, clearIncomingOrder }),
    [incomingOrder, showIncomingOrder, clearIncomingOrder],
  )

  return <IncomingOrderContext.Provider value={value}>{children}</IncomingOrderContext.Provider>
}

export function useIncomingOrder(): IncomingOrderContextValue {
  const ctx = useContext(IncomingOrderContext)
  if (!ctx) throw new Error('useIncomingOrder must be used within IncomingOrderProvider')
  return ctx
}
