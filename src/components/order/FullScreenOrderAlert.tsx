import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { MapPin, Store, Package, Wallet, Route } from 'lucide-react'
import { useIncomingOrder } from '@/context/IncomingOrderContext'
import { deliveryOrderService } from '@/services/deliveryOrderService'
import { SwipeToAcceptButton } from '@/components/ui/SwipeToAcceptButton'
import { formatCurrency } from '@/lib/format'

const ALERT_DURATION_S = 20
const RING_RADIUS = 26
const RING_CIRCUMFERENCE = 2 * Math.PI * RING_RADIUS

/**
 * The centerpiece of the app: a full-viewport, always-on-top new-order popup - mounted once at the
 * app root (outside routing, see App.tsx) so it overlays regardless of what page the rider is on.
 * Reads IncomingOrderContext, the single place a new-order alert gets surfaced (both the polling
 * hook and the push handler write into it - nothing else shows a competing UI for this). Modeled
 * after a real Zomato/Swiggy order popup: bold typography, a restaurant-to-customer route row, a
 * countdown ring that auto-dismisses back to the available-orders list, and swipe-to-accept.
 */
export function FullScreenOrderAlert() {
  const { incomingOrder, clearIncomingOrder } = useIncomingOrder()
  const navigate = useNavigate()
  const [secondsLeft, setSecondsLeft] = useState(ALERT_DURATION_S)
  const [accepting, setAccepting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!incomingOrder) return
    setSecondsLeft(ALERT_DURATION_S)
    setAccepting(false)
    setError(null)
    const timer = setInterval(() => {
      setSecondsLeft((s) => Math.max(0, s - 1))
    }, 1000)
    return () => clearInterval(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [incomingOrder?.id])

  useEffect(() => {
    if (incomingOrder && secondsLeft === 0) {
      clearIncomingOrder()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [secondsLeft])

  if (!incomingOrder) return null

  async function handleAccept() {
    setAccepting(true)
    setError(null)
    try {
      await deliveryOrderService.accept(incomingOrder!.id)
      clearIncomingOrder()
      navigate('/deliveries/active')
    } catch (err) {
      setError((err as { message?: string })?.message ?? 'Could not accept this order - it may have just been taken.')
      setAccepting(false)
    }
  }

  const progress = secondsLeft / ALERT_DURATION_S
  const dashOffset = RING_CIRCUMFERENCE * (1 - progress)

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-slate-900 px-5 pb-safe pt-safe text-white animate-fade-in">
      <div className="flex items-center justify-between pt-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-brand-400">New order</p>
          <p className="text-2xl font-bold">{incomingOrder.uniqueOrderId}</p>
        </div>
        <div className="relative flex h-16 w-16 items-center justify-center">
          <svg viewBox="0 0 64 64" className="absolute inset-0 -rotate-90">
            <circle cx="32" cy="32" r={RING_RADIUS} fill="none" stroke="rgba(255,255,255,0.15)" strokeWidth="5" />
            <circle
              cx="32"
              cy="32"
              r={RING_RADIUS}
              fill="none"
              stroke="#4ade80"
              strokeWidth="5"
              strokeLinecap="round"
              strokeDasharray={RING_CIRCUMFERENCE}
              strokeDashoffset={dashOffset}
              style={{ transition: 'stroke-dashoffset 1s linear' }}
            />
          </svg>
          <span className="text-lg font-bold">{secondsLeft}</span>
        </div>
      </div>

      <div className="mt-8 flex-1">
        <div className="rounded-2xl bg-white/5 p-4">
          <div className="flex gap-3">
            <div className="flex flex-col items-center pt-1">
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-brand-500/20 text-brand-400">
                <Store size={16} />
              </span>
              <span className="my-1 h-8 w-px border-l border-dashed border-white/25" />
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-rose-500/20 text-rose-300">
                <MapPin size={16} />
              </span>
            </div>
            <div className="flex-1 space-y-5">
              <div>
                <p className="text-[11px] font-medium uppercase tracking-wide text-white/50">Pickup</p>
                <p className="text-base font-semibold leading-snug">{incomingOrder.restaurantName}</p>
                <p className="text-sm text-white/60">{incomingOrder.restaurantAddress}</p>
              </div>
              <div>
                <p className="text-[11px] font-medium uppercase tracking-wide text-white/50">Drop</p>
                <p className="text-sm text-white/85">{incomingOrder.customerAddress}</p>
              </div>
            </div>
          </div>
        </div>

        <div className="mt-4 grid grid-cols-3 gap-2">
          <div className="rounded-xl bg-white/5 p-3 text-center">
            <Route size={16} className="mx-auto mb-1 text-brand-400" />
            <p className="text-sm font-bold">{incomingOrder.distanceKm} km</p>
            <p className="text-[11px] text-white/50">Distance</p>
          </div>
          <div className="rounded-xl bg-white/5 p-3 text-center">
            <Package size={16} className="mx-auto mb-1 text-brand-400" />
            <p className="text-sm font-bold">{incomingOrder.itemsCount}</p>
            <p className="text-[11px] text-white/50">Items</p>
          </div>
          <div className="rounded-xl bg-white/5 p-3 text-center">
            <Wallet size={16} className="mx-auto mb-1 text-brand-400" />
            <p className="text-sm font-bold">{formatCurrency(incomingOrder.payoutEstimate)}</p>
            <p className="text-[11px] text-white/50">Payout</p>
          </div>
        </div>

        {error && <p className="mt-4 rounded-lg bg-rose-500/15 px-3 py-2 text-sm text-rose-300">{error}</p>}
      </div>

      <div className="pb-4 pt-2">
        <SwipeToAcceptButton label={accepting ? 'Accepting...' : 'Swipe to accept'} onAccept={handleAccept} disabled={accepting} />
        <button
          type="button"
          className="mt-3 w-full py-2 text-center text-sm font-medium text-white/50"
          onClick={clearIncomingOrder}
          disabled={accepting}
        >
          Dismiss
        </button>
      </div>
    </div>
  )
}
