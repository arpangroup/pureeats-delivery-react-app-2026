import { useEffect, useState } from 'react'
import { Banknote, CreditCard, Timer } from 'lucide-react'
import { classNames } from '@/lib/format'
import { paymentLabel } from '@/services/deliveryOrderService'
import type { OrderStatus } from '@/types/entities'

const STATUS_LABELS: Partial<Record<OrderStatus, string>> = {
  PLACED: 'Placed',
  RESTAURANT_ACCEPTED: 'Accepted by store',
  PREPARING: 'Preparing',
  READY_FOR_PICKUP: 'Ready for pickup',
  RIDER_ASSIGNED: 'Ready for pickup',
  PICKED_UP: 'Picked up',
  ON_THE_WAY: 'On the way',
  ARRIVED: 'Arrived at customer',
  DELIVERED: 'Delivered',
  CANCELLED: 'Cancelled',
  RETURNED: 'Returned',
}

/** Human label for an order status. RIDER_ASSIGNED only happens once the food is ready, so it reads "Ready for pickup". */
export function orderStatusLabel(status: OrderStatus | null | undefined): string {
  if (!status) return 'Unknown'
  return STATUS_LABELS[status] ?? status.replace(/_/g, ' ').toLowerCase()
}

const READY: OrderStatus[] = ['READY_FOR_PICKUP', 'RIDER_ASSIGNED']
const KITCHEN: OrderStatus[] = ['PLACED', 'RESTAURANT_ACCEPTED', 'PREPARING']

export function OrderStatusBadge({ status, dark = false }: { status: OrderStatus | null | undefined; dark?: boolean }) {
  const tone =
    status && READY.includes(status)
      ? dark
        ? 'bg-emerald-400/20 text-emerald-300'
        : 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-400'
      : status && KITCHEN.includes(status)
        ? dark
          ? 'bg-amber-400/20 text-amber-300'
          : 'bg-amber-100 text-amber-800 dark:bg-amber-500/15 dark:text-amber-400'
        : dark
          ? 'bg-white/10 text-white/80'
          : 'bg-brand-100 text-brand-700 dark:bg-brand-500/15 dark:text-brand-400'
  return <span className={classNames('inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold', tone)}>{orderStatusLabel(status)}</span>
}

/** COD (collect cash) vs Prepaid - prominent, since it changes what the partner does at the door. */
export function PaymentBadge({ mode, dark = false }: { mode: string | null | undefined; dark?: boolean }) {
  const label = paymentLabel(mode)
  if (!label) return null
  const cod = label === 'COD'
  const tone = cod
    ? dark
      ? 'bg-amber-400 text-slate-900'
      : 'bg-amber-100 text-amber-800 dark:bg-amber-500/15 dark:text-amber-300'
    : dark
      ? 'bg-sky-400/20 text-sky-200'
      : 'bg-sky-100 text-sky-700 dark:bg-sky-500/15 dark:text-sky-300'
  return (
    <span className={classNames('inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-bold', tone)}>
      {cod ? <Banknote size={12} /> : <CreditCard size={12} />} {cod ? 'COD' : 'Prepaid'}
    </span>
  )
}

function useNow(intervalMs = 1000): number {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), intervalMs)
    return () => clearInterval(id)
  }, [intervalMs])
  return now
}

function formatSpan(ms: number): string {
  const total = Math.floor(Math.abs(ms) / 1000)
  const h = Math.floor(total / 3600)
  const m = Math.floor((total % 3600) / 60)
  const s = total % 60
  const mmss = `${String(m).padStart(h > 0 ? 2 : 1, '0')}:${String(s).padStart(2, '0')}`
  return h > 0 ? `${h}:${mmss}` : mmss
}

/**
 * Live countdown to when the food should be ready for pickup (restaurant acceptance + prep time).
 * Once overdue it keeps counting as a negative delay ("-03:12 late") instead of stopping at zero.
 */
export function PickupCountdown({ dueAt, dark = false, compact = false }: { dueAt: string | null | undefined; dark?: boolean; compact?: boolean }) {
  const now = useNow()
  if (!dueAt) return null
  const due = new Date(dueAt).getTime()
  if (Number.isNaN(due)) return null
  const left = due - now
  const late = left < 0
  const tone = late
    ? dark
      ? 'bg-rose-500/20 text-rose-300'
      : 'bg-rose-50 text-rose-700 dark:bg-rose-500/10 dark:text-rose-400'
    : dark
      ? 'bg-white/10 text-white'
      : 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200'
  return (
    <span
      className={classNames('inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold tabular-nums', tone)}
      title={late ? 'Pickup is overdue' : 'Time until the food should be ready'}
    >
      <Timer size={12} />
      {late ? `-${formatSpan(left)}` : formatSpan(left)}
      {!compact && <span className="font-medium opacity-80">{late ? 'late' : 'to pickup'}</span>}
    </span>
  )
}

/** Big, readable order id - partners read it out at the counter. */
export function OrderIdTag({ id, dark = false }: { id: string; dark?: boolean }) {
  return (
    <span
      className={classNames(
        'inline-flex items-center rounded-lg px-2 py-0.5 font-mono text-sm font-bold tracking-wide',
        dark ? 'bg-white/10 text-white' : 'bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900',
      )}
    >
      #{id}
    </span>
  )
}
