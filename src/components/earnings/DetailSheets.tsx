import { useEffect, useState, type ReactNode } from 'react'
import { X, Store, MapPin, CheckCircle2, Clock, Banknote, ArrowDownLeft, ArrowUpRight } from 'lucide-react'
import { earningsService } from '@/services/earningsService'
import { formatCurrency, formatDate } from '@/lib/format'
import { showErrorToast } from '@/lib/errorToast'
import { LoadingBlock } from '@/components/ui/Feedback'
import type { RiderEarning, RiderSettlement } from '@/types/entities'

function Sheet({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  useEffect(() => {
    const onKey = (e: { key: string }) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])
  return (
    <div className="fixed inset-0 z-40 flex items-end justify-center bg-slate-900/50 animate-fade-in" onClick={onClose}>
      <div
        className="max-h-[85dvh] w-full max-w-md overflow-y-auto rounded-t-2xl bg-white pb-safe dark:bg-slate-900"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label={title}
      >
        <div className="sticky top-0 flex items-center justify-between border-b border-slate-100 bg-white px-4 py-3 dark:border-slate-800 dark:bg-slate-900">
          <h2 className="text-base font-semibold text-slate-800 dark:text-slate-100">{title}</h2>
          <button onClick={onClose} className="rounded-full p-1.5 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800" aria-label="Close">
            <X size={18} />
          </button>
        </div>
        <div className="px-4 py-4">{children}</div>
      </div>
    </div>
  )
}

function Row({ label, value, strong, hint }: { label: string; value: ReactNode; strong?: boolean; hint?: string }) {
  return (
    <div className="flex items-start justify-between gap-3 py-2">
      <div className="min-w-0">
        <p className={`text-sm ${strong ? 'font-semibold text-slate-800 dark:text-slate-100' : 'text-slate-500 dark:text-slate-400'}`}>{label}</p>
        {hint && <p className="text-[11px] text-slate-400">{hint}</p>}
      </div>
      <p className={`shrink-0 text-right text-sm ${strong ? 'font-bold text-slate-800 dark:text-slate-100' : 'text-slate-700 dark:text-slate-200'}`}>{value}</p>
    </div>
  )
}

export function SettlementStatus({ settled, settledAt }: { settled: boolean; settledAt?: string | null }) {
  return settled ? (
    <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400">
      <CheckCircle2 size={12} /> Settled{settledAt ? ` ${formatDate(settledAt, false)}` : ''}
    </span>
  ) : (
    <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-semibold text-amber-700 dark:bg-amber-500/10 dark:text-amber-400">
      <Clock size={12} /> Pending settlement
    </span>
  )
}

function paymentLabel(mode: string | null): string {
  if (!mode) return '-'
  if (mode === 'COD') return 'Cash on delivery'
  if (mode === 'WALLET') return 'Customer wallet'
  return `Online (${mode.charAt(0)}${mode.slice(1).toLowerCase()})`
}

const basisLabel = (basis: string | null) => (basis === 'DELIVERY_CHARGE_ONLY' ? 'delivery charge' : 'order total')

/** Earning breakdown for one delivered order. */
export function EarningDetailSheet({ orderId, onClose, onOpenSettlement }: { orderId: number; onClose: () => void; onOpenSettlement?: (id: number) => void }) {
  const [earning, setEarning] = useState<RiderEarning | null>(null)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    let cancelled = false
    earningsService
      .earningForOrder(orderId)
      .then((e) => !cancelled && setEarning(e))
      .catch((err) => {
        if (cancelled) return
        setFailed(true)
        showErrorToast(err, 'Could not load this earning.')
      })
    return () => {
      cancelled = true
    }
  }, [orderId])

  return (
    <Sheet title="Earning details" onClose={onClose}>
      {!earning && !failed && <LoadingBlock />}
      {failed && <p className="py-6 text-center text-sm text-slate-500">This earning couldn't be loaded.</p>}
      {earning && (
        <div>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-2xl font-bold text-slate-800 dark:text-slate-100">{formatCurrency(earning.earning)}</p>
              <p className="text-xs text-slate-500 dark:text-slate-400">Order {earning.uniqueOrderId} · {formatDate(earning.deliveredAt)}</p>
            </div>
            <SettlementStatus settled={earning.settled} settledAt={earning.settledAt} />
          </div>

          <div className="mt-4 space-y-2 rounded-xl bg-slate-50 p-3 dark:bg-slate-800/60">
            <p className="flex items-start gap-2 text-sm text-slate-700 dark:text-slate-200">
              <Store size={15} className="mt-0.5 shrink-0 text-brand-600" /> {earning.restaurantName}
            </p>
            {earning.customerAddress && (
              <p className="flex items-start gap-2 text-xs text-slate-500 dark:text-slate-400">
                <MapPin size={14} className="mt-0.5 shrink-0 text-rose-500" /> {earning.customerAddress}
              </p>
            )}
          </div>

          <p className="mb-1 mt-5 text-xs font-semibold uppercase tracking-wide text-slate-400">How it was calculated</p>
          <div className="divide-y divide-slate-100 dark:divide-slate-800">
            {earning.orderTotal != null && <Row label="Order total" value={formatCurrency(earning.orderTotal)} />}
            {earning.deliveryCharge != null && <Row label="Delivery charge" value={formatCurrency(earning.deliveryCharge)} />}
            {earning.commissionRate != null && (
              <Row
                label={`Your commission (${earning.commissionRate}% of ${basisLabel(earning.commissionBasis)})`}
                value={earning.commissionBase != null ? `${earning.commissionRate}% × ${formatCurrency(earning.commissionBase)}` : `${earning.commissionRate}%`}
                hint={earning.rateIsCurrent ? 'Shown at your current rate - this trip predates rate snapshots.' : undefined}
              />
            )}
            {earning.tipAmount > 0 && <Row label="Customer tip" value={`+ ${formatCurrency(earning.tipAmount)}`} />}
            <Row label="You earned" value={formatCurrency(earning.earning)} strong />
            <Row label="Distance" value={`${earning.distanceKm.toFixed(1)} km`} />
            <Row label="Payment" value={paymentLabel(earning.paymentMode)} />
          </div>

          {earning.codCollected > 0 && (
            <div className="mt-4 flex gap-2 rounded-xl bg-amber-50 p-3 text-xs text-amber-800 dark:bg-amber-500/10 dark:text-amber-300">
              <Banknote size={16} className="shrink-0" />
              <p>
                You collected <span className="font-semibold">{formatCurrency(earning.codCollected)}</span> in cash from the customer.
                {earning.settled ? ' This was squared up in your settlement.' : ' It is deducted from what the platform pays you at your next settlement.'}
              </p>
            </div>
          )}

          {earning.settled && earning.settlementId != null && onOpenSettlement && (
            <button className="btn-secondary mt-4 w-full" onClick={() => onOpenSettlement(earning.settlementId!)}>
              View settlement #{earning.settlementId}
            </button>
          )}
        </div>
      )}
    </Sheet>
  )
}

/**
 * Settlements collect COD cash and pay earnings separately (never netted). Older settlements netted the two
 * into one transfer - those (both amounts set, single direction) still read as the net that changed hands.
 */
function isLegacyNetted(s: Pick<RiderSettlement, 'direction' | 'earningsAmount' | 'codAmount'>): boolean {
  return s.direction !== 'BOTH' && s.earningsAmount > 0 && s.codAmount > 0
}

export function directionText(s: Pick<RiderSettlement, 'direction' | 'netAmount' | 'earningsAmount' | 'codAmount' | 'status'>): string {
  if (s.status === 'REQUESTED') return `Withdrawal of ${formatCurrency(s.earningsAmount)} requested`
  if (s.status === 'REJECTED') return `Withdrawal of ${formatCurrency(s.earningsAmount)} rejected`
  if (isLegacyNetted(s)) {
    if (s.direction === 'PAID_TO_RIDER') return `Paid to you: ${formatCurrency(Math.abs(s.netAmount))}`
    if (s.direction === 'COLLECTED_FROM_RIDER') return `You paid in: ${formatCurrency(Math.abs(s.netAmount))}`
    return 'Settled even - nothing changed hands'
  }
  const parts = [
    s.codAmount > 0 ? `You handed over ${formatCurrency(s.codAmount)}` : null,
    s.earningsAmount > 0 ? `paid to you ${formatCurrency(s.earningsAmount)}` : null,
  ].filter(Boolean) as string[]
  if (parts.length === 0) return 'Nothing changed hands'
  const text = parts.join(' · ')
  return text.charAt(0).toUpperCase() + text.slice(1)
}

/** One settlement, with the trips it covered. */
export function SettlementDetailSheet({ settlementId, onClose, onOpenEarning }: { settlementId: number; onClose: () => void; onOpenEarning?: (orderId: number) => void }) {
  const [settlement, setSettlement] = useState<RiderSettlement | null>(null)
  const [trips, setTrips] = useState<RiderEarning[] | null>(null)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    let cancelled = false
    Promise.all([earningsService.settlement(settlementId), earningsService.tripsForSettlement(settlementId)])
      .then(([s, t]) => {
        if (cancelled) return
        setSettlement(s)
        setTrips(t)
      })
      .catch((err) => {
        if (cancelled) return
        setFailed(true)
        showErrorToast(err, 'Could not load this settlement.')
      })
    return () => {
      cancelled = true
    }
  }, [settlementId])

  return (
    <Sheet title={`Settlement #${settlementId}`} onClose={onClose}>
      {!settlement && !failed && <LoadingBlock />}
      {failed && <p className="py-6 text-center text-sm text-slate-500">This settlement couldn't be loaded.</p>}
      {settlement && (
        <div>
          <p className="text-xl font-bold text-slate-800 dark:text-slate-100">{directionText(settlement)}</p>
          <p className="text-xs text-slate-500 dark:text-slate-400">{formatDate(settlement.createdAt)} · {settlement.tripCount} trip(s)</p>

          <div className="mt-4 divide-y divide-slate-100 dark:divide-slate-800">
            <Row label="COD cash handed over" value={formatCurrency(settlement.codAmount)} />
            <Row label="Earnings paid to you" value={formatCurrency(settlement.earningsAmount)} />
            {isLegacyNetted(settlement) && <Row label="Net (older settlements were netted)" value={formatCurrency(settlement.netAmount)} strong />}
            {settlement.transactionMode && <Row label="Paid via" value={settlement.transactionMode.replace(/_/g, ' ')} />}
            {settlement.transactionReference && <Row label="Reference" value={<span className="font-mono text-xs">{settlement.transactionReference}</span>} />}
            {settlement.note && <Row label="Note" value={settlement.note} />}
          </div>

          {trips && trips.length > 0 && (
            <>
              <p className="mb-1 mt-5 text-xs font-semibold uppercase tracking-wide text-slate-400">Trips in this settlement</p>
              <ul className="divide-y divide-slate-100 dark:divide-slate-800">
                {trips.map((t) => (
                  <li key={t.tripId}>
                    <button className="flex w-full items-center justify-between gap-3 py-2.5 text-left" onClick={() => onOpenEarning?.(t.orderId)}>
                      <div className="min-w-0">
                        <p className="truncate text-sm text-slate-700 dark:text-slate-200">{t.restaurantName}</p>
                        <p className="text-[11px] text-slate-400">{t.uniqueOrderId} · {formatDate(t.deliveredAt)}</p>
                      </div>
                      <span className="shrink-0 text-sm font-semibold text-slate-800 dark:text-slate-100">{formatCurrency(t.earning)}</span>
                    </button>
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>
      )}
    </Sheet>
  )
}

/** Icon for a wallet entry - credit (money in) vs debit (paid out / deducted). */
export function TransactionIcon({ type }: { type: 'credit' | 'debit' }) {
  return (
    <span
      className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${
        type === 'credit' ? 'bg-emerald-100 text-emerald-600 dark:bg-emerald-500/15' : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300'
      }`}
    >
      {type === 'credit' ? <ArrowDownLeft size={16} /> : <ArrowUpRight size={16} />}
    </span>
  )
}
