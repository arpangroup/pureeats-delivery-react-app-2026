import { Bike, Flag, Store, Gift } from 'lucide-react'
import { formatCurrency } from '@/lib/format'
import { usePickupDistance } from '@/hooks/usePickupDistance'
import { useDriverSettings } from '@/hooks/useDriverSettings'
import type { AvailableOrder } from '@/types/entities'

const km = (v: number | null) => (v == null ? '—' : `${v.toFixed(1)} km`)

/**
 * Pickup / drop distance and what the rider earns (payout + tip) for a not-yet-accepted order -
 * shared by the full-screen new-order popup (`variant="dark"`) and the Available Orders card.
 */
export function OrderTripMetrics({ order, variant = 'light' }: { order: AvailableOrder; variant?: 'light' | 'dark' }) {
  const pickup = usePickupDistance(order)
  const drop = order.dropDistanceKm ?? order.distanceKm
  const tip = order.tipAmount ?? 0
  const total = order.payoutEstimate + tip
  const dark = variant === 'dark'
  // Payout is hidden unless Settings -> Delivery Application -> Order screens -> "Show payout" is on.
  const { showPayout } = useDriverSettings()

  const tile = dark ? 'rounded-xl bg-white/5 p-3 text-center' : 'rounded-lg bg-slate-50 py-1.5 text-center dark:bg-slate-800/60'
  const value = dark ? 'text-sm font-bold' : 'text-xs font-bold text-slate-800 dark:text-slate-100'
  const label = dark ? 'text-[11px] text-white/50' : 'text-[10px] text-slate-400'
  const icon = dark ? 'mx-auto mb-1 text-brand-400' : 'mx-auto mb-0.5 text-brand-600'

  return (
    <div className="space-y-2">
      <div className="grid grid-cols-3 gap-2">
        <div className={tile}>
          <Bike size={dark ? 16 : 13} className={icon} />
          <p className={value}>{km(pickup)}</p>
          <p className={label}>Pickup</p>
        </div>
        <div className={tile}>
          <Flag size={dark ? 16 : 13} className={icon} />
          <p className={value}>{km(drop)}</p>
          <p className={label}>Drop</p>
        </div>
        <div className={tile}>
          <Store size={dark ? 16 : 13} className={icon} />
          <p className={value}>{order.itemsCount}</p>
          <p className={label}>Items</p>
        </div>
      </div>

      {!showPayout && tip > 0 && (
        <p
          className={
            dark
              ? 'flex items-center justify-center gap-1 rounded-xl bg-amber-400/15 px-4 py-2 text-sm font-semibold text-amber-300'
              : 'flex items-center justify-center gap-1 rounded-lg bg-amber-50 px-3 py-1.5 text-xs font-semibold text-amber-800 dark:bg-amber-500/10 dark:text-amber-300'
          }
        >
          <Gift size={dark ? 14 : 12} /> Customer tip {formatCurrency(tip)} - yours in full
        </p>
      )}

      {showPayout && (
        <div
          className={
            dark
              ? 'flex items-center justify-between rounded-xl bg-brand-500/15 px-4 py-3'
              : 'flex items-center justify-between rounded-lg bg-brand-50 px-3 py-2 dark:bg-brand-500/10'
          }
        >
          <div className="min-w-0">
            <p
              className={
                dark
                  ? 'text-[11px] uppercase tracking-wide text-white/60'
                  : 'text-[10px] font-semibold uppercase tracking-wide text-brand-700 dark:text-brand-400'
              }
            >
              You earn
            </p>
            <p className={dark ? 'text-xs text-white/70' : 'text-[11px] text-slate-500 dark:text-slate-400'}>
              {formatCurrency(order.payoutEstimate)} payout
              {tip > 0 ? ` + ${formatCurrency(tip)} tip` : ''}
            </p>
          </div>
          <div className="flex items-center gap-2">
            {tip > 0 && (
              <span
                className={
                  dark
                    ? 'inline-flex items-center gap-1 rounded-full bg-amber-400 px-2 py-0.5 text-[11px] font-bold text-slate-900'
                    : 'inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-800 dark:bg-amber-500/15 dark:text-amber-300'
                }
              >
                <Gift size={11} /> {formatCurrency(tip)} tip
              </span>
            )}
            <span className={dark ? 'text-xl font-bold' : 'text-base font-bold text-slate-800 dark:text-slate-100'}>{formatCurrency(total)}</span>
          </div>
        </div>
      )}
    </div>
  )
}
