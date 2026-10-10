import { useEffect, useState } from 'react'
import { ChefHat, Navigation, Store } from 'lucide-react'
import { usePickupDistance } from '@/hooks/usePickupDistance'
import { deliveryOrderService } from '@/services/deliveryOrderService'
import { classNames } from '@/lib/format'
import type { ActiveDelivery, OrderStatus } from '@/types/entities'

/** Within this distance of the restaurant counts as "arrived" (GPS is rarely better than ~50m). */
const AT_RESTAURANT_KM = 0.2
/** How often the live drop-off ETA is refreshed after pickup. */
const LIVE_ETA_REFRESH_MS = 30_000
const OUT_FOR_DELIVERY: OrderStatus[] = ['PICKED_UP', 'ON_THE_WAY', 'ARRIVED']

function useNow() {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(id)
  }, [])
  return now
}

function clock(ms: number): string {
  const total = Math.floor(Math.abs(ms) / 1000)
  const m = Math.floor(total / 60)
  const s = total % 60
  return `${m}:${String(s).padStart(2, '0')}`
}

function Row({ icon: Icon, title, value, late, sub }: { icon: typeof Store; title: string; value: string; late?: boolean; sub?: string }) {
  return (
    <div className="flex items-center gap-3">
      <span className={classNames('flex h-9 w-9 shrink-0 items-center justify-center rounded-full', late ? 'bg-rose-100 text-rose-600 dark:bg-rose-500/15' : 'bg-brand-100 text-brand-600 dark:bg-brand-500/15')}>
        <Icon size={17} />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-xs font-medium text-slate-500 dark:text-slate-400">{title}</p>
        {sub && <p className="text-[11px] text-slate-400">{sub}</p>}
      </div>
      <span className={classNames('text-lg font-bold tabular-nums', late ? 'text-rose-600 dark:text-rose-400' : 'text-slate-800 dark:text-slate-100')}>{value}</span>
    </div>
  )
}

/**
 * Real-time timing for the partner (no slowdown - unlike the customer's buffered countdown):
 * 1. Countdown to reach the restaurant (T2, from acceptance).
 * 2. At the restaurant (GPS within ~200m, or T2 used up) and the food isn't ready: live wait for the remaining
 *    preparation time (T1) - negative once the kitchen is late.
 * 3. After pickup: live drop-off ETA from the partner's position to the customer (Google Maps when the server
 *    is configured for it), refreshed every 30 seconds and counted down in between.
 */
export function DeliveryTimingPanel({ delivery }: { delivery: ActiveDelivery }) {
  const now = useNow()
  const pickupKm = usePickupDistance({ restaurantLat: delivery.restaurantLat, restaurantLng: delivery.restaurantLng, pickupDistanceKm: null })
  const pickedUp = OUT_FOR_DELIVERY.includes(delivery.status)
  const [liveEta, setLiveEta] = useState<{ minutes: number; distanceKm: number; at: number } | null>(null)

  useEffect(() => {
    if (!pickedUp) return
    let cancelled = false
    const load = () =>
      deliveryOrderService
        .liveEta(delivery.id)
        .then((e) => !cancelled && setLiveEta({ minutes: e.minutes, distanceKm: e.distanceKm, at: Date.now() }))
        .catch(() => undefined)
    load()
    const id = setInterval(load, LIVE_ETA_REFRESH_MS)
    return () => {
      cancelled = true
      clearInterval(id)
    }
  }, [pickedUp, delivery.id])

  if (pickedUp) {
    if (delivery.status === 'ARRIVED') return null
    if (!liveEta) return null
    const leftMs = liveEta.minutes * 60_000 - (now - liveEta.at)
    return (
      <div className="card p-4">
        <Row icon={Navigation} title="Drop-off ETA (live)" sub={`${liveEta.distanceKm.toFixed(1)} km to the customer`} value={leftMs > 0 ? clock(leftMs) : 'Arriving'} />
      </div>
    )
  }

  const reachBy = delivery.reachRestaurantBy ? new Date(delivery.reachRestaurantBy).getTime() : null
  const reachLeft = reachBy != null ? reachBy - now : null
  const atRestaurant = (pickupKm != null && pickupKm <= AT_RESTAURANT_KM) || (reachLeft != null && reachLeft <= 0)
  const prepDue = delivery.pickupDueAt ? new Date(delivery.pickupDueAt).getTime() : null
  const prepLeft = prepDue != null ? prepDue - now : null

  return (
    <div className="card space-y-3 p-4">
      {!atRestaurant && reachLeft != null && (
        <Row
          icon={Store}
          title="Reach the restaurant in"
          sub={pickupKm != null ? `${pickupKm.toFixed(1)} km away` : undefined}
          value={clock(reachLeft)}
        />
      )}
      {atRestaurant && !delivery.foodReady && prepLeft != null && (
        <Row
          icon={ChefHat}
          title={prepLeft >= 0 ? 'Food ready in' : 'Kitchen is running late by'}
          sub="Wait at the counter - you can pick up once the store marks it ready"
          value={prepLeft >= 0 ? clock(prepLeft) : `-${clock(prepLeft)}`}
          late={prepLeft < 0}
        />
      )}
      {atRestaurant && delivery.foodReady && <Row icon={ChefHat} title="Food is ready" sub="Take the pickup photo and slide to pick up" value="Ready" />}
      {!atRestaurant && prepLeft != null && (
        <p className="text-xs text-slate-500 dark:text-slate-400">
          Food {prepLeft >= 0 ? `ready in ${clock(prepLeft)}` : `late by ${clock(prepLeft)}`}
        </p>
      )}
    </div>
  )
}
