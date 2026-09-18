import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Store, MapPin, Package } from 'lucide-react'
import { PageHeader } from '@/components/layout/PageHeader'
import { LoadingBlock, EmptyState } from '@/components/ui/Feedback'
import { SwipeToAcceptButton } from '@/components/ui/SwipeToAcceptButton'
import { deliveryOrderService } from '@/services/deliveryOrderService'
import { formatCurrency, timeAgo } from '@/lib/format'
import type { AvailableOrder } from '@/types/entities'

const REFRESH_INTERVAL_MS = 10000

/** Manual browse view of available orders - for a rider who'd rather scan a list than wait for the
 * full-screen alert. Each row gets its own smaller swipe-to-accept control. */
export default function AvailableOrdersPage() {
  const navigate = useNavigate()
  const [orders, setOrders] = useState<AvailableOrder[] | null>(null)
  const [acceptingId, setAcceptingId] = useState<number | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    async function load() {
      try {
        const list = await deliveryOrderService.listAvailable()
        if (!cancelled) setOrders(list)
      } catch (err) {
        if (!cancelled) setError((err as { message?: string })?.message ?? 'Could not load available orders.')
      }
    }
    load()
    const intervalId = setInterval(load, REFRESH_INTERVAL_MS)
    return () => {
      cancelled = true
      clearInterval(intervalId)
    }
  }, [])

  async function handleAccept(orderId: number) {
    setAcceptingId(orderId)
    setError(null)
    try {
      await deliveryOrderService.accept(orderId)
      navigate('/deliveries/active')
    } catch (err) {
      setError((err as { message?: string })?.message ?? 'Could not accept this order - it may have just been taken.')
      setAcceptingId(null)
    }
  }

  return (
    <div>
      <PageHeader title="Available orders" />
      <div className="space-y-3 px-4 py-4">
        {orders === null && <LoadingBlock label="Finding orders near you..." />}
        {orders && orders.length === 0 && (
          <EmptyState title="No orders right now" description="New orders will show up here as they come in nearby." icon={<Package size={22} />} />
        )}
        {error && <p className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-600 dark:bg-rose-500/10 dark:text-rose-400">{error}</p>}
        {orders?.map((order) => (
          <div key={order.id} className="card p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="flex items-center gap-1.5 text-sm font-semibold text-slate-800 dark:text-slate-100">
                  <Store size={14} className="shrink-0 text-brand-600" />
                  <span className="truncate">{order.restaurantName}</span>
                </div>
                <p className="mt-0.5 truncate pl-[22px] text-xs text-slate-500 dark:text-slate-400">{order.restaurantAddress}</p>
                <div className="mt-1.5 flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
                  <MapPin size={12} className="shrink-0 text-rose-500" />
                  <span className="truncate">{order.customerAddress}</span>
                </div>
              </div>
              <span className="shrink-0 text-[11px] text-slate-400">{timeAgo(order.createdAt)}</span>
            </div>

            <div className="mt-3 grid grid-cols-3 gap-2 text-center">
              <div className="rounded-lg bg-slate-50 py-1.5 dark:bg-slate-800/60">
                <p className="text-xs font-bold text-slate-800 dark:text-slate-100">{order.distanceKm} km</p>
                <p className="text-[10px] text-slate-400">Distance</p>
              </div>
              <div className="rounded-lg bg-slate-50 py-1.5 dark:bg-slate-800/60">
                <p className="text-xs font-bold text-slate-800 dark:text-slate-100">{order.itemsCount}</p>
                <p className="text-[10px] text-slate-400">Items</p>
              </div>
              <div className="rounded-lg bg-slate-50 py-1.5 dark:bg-slate-800/60">
                <p className="text-xs font-bold text-slate-800 dark:text-slate-100">{formatCurrency(order.payoutEstimate)}</p>
                <p className="text-[10px] text-slate-400">Payout</p>
              </div>
            </div>

            <div className="mt-3">
              <SwipeToAcceptButton
                label={acceptingId === order.id ? 'Accepting...' : 'Swipe to accept'}
                onAccept={() => handleAccept(order.id)}
                disabled={acceptingId !== null}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
