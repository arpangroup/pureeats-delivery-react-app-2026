import { useState } from 'react'
import { Banknote, Wallet, X } from 'lucide-react'
import { TextInput } from '@/components/ui/FormControls'
import { formatCurrency, classNames } from '@/lib/format'

/** Same cap as the server (DeliveryOrderService.MAX_COD_CHANGE): more than this over the bill is almost certainly a typo. */
const MAX_CHANGE = 2000

/**
 * Cash on delivery, after the handover photo and before the PIN: "Do you want to collect the cash?" The partner
 * confirms what the customer actually handed over - the exact amount, or more (e.g. ₹500 for a ₹480 bill), in
 * which case the extra is credited to the customer's PureEats wallet when the delivery is confirmed.
 */
export function CashCollectionDialog({ due, initial, onConfirm, onClose }: { due: number; initial: number | null; onConfirm: (amount: number) => void; onClose: () => void }) {
  const [mode, setMode] = useState<'exact' | 'more'>(initial != null && initial > due ? 'more' : 'exact')
  const [amount, setAmount] = useState(initial != null && initial > due ? String(initial) : '')

  const entered = Number(amount)
  const collected = mode === 'exact' ? due : entered
  const change = Math.round((collected - due) * 100) / 100
  const error =
    mode === 'more'
      ? !amount
        ? 'Enter the amount the customer gave you.'
        : !Number.isFinite(entered) || entered <= due
          ? `Enter more than ${formatCurrency(due)} - or choose "Exact amount".`
          : change > MAX_CHANGE
            ? `That's ${formatCurrency(change)} over the bill - check the amount.`
            : null
      : null

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/50 sm:items-center" role="dialog" aria-modal="true" aria-labelledby="cash-title">
      <div className="w-full max-w-md rounded-t-2xl bg-white p-5 shadow-xl dark:bg-slate-900 sm:rounded-2xl">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-full bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300">
              <Banknote size={20} />
            </span>
            <div>
              <h2 id="cash-title" className="text-base font-semibold text-slate-800 dark:text-slate-100">
                Do you want to collect the cash?
              </h2>
              <p className="text-sm text-slate-500 dark:text-slate-400">
                Amount due: <span className="font-semibold text-slate-800 dark:text-slate-100">{formatCurrency(due)}</span>
              </p>
            </div>
          </div>
          <button onClick={onClose} className="rounded-full p-1 text-slate-400 hover:text-slate-600" aria-label="Close">
            <X size={18} />
          </button>
        </div>

        <p className="mt-4 text-sm font-medium text-slate-700 dark:text-slate-200">How much did the customer give you?</p>
        <div className="mt-2 grid grid-cols-2 gap-2">
          {(
            [
              { value: 'exact', label: `Exact amount`, sub: formatCurrency(due) },
              { value: 'more', label: 'More than the bill', sub: 'Extra goes to their wallet' },
            ] as const
          ).map((o) => (
            <button
              key={o.value}
              type="button"
              onClick={() => setMode(o.value)}
              className={classNames(
                'rounded-xl border px-3 py-2.5 text-left',
                mode === o.value ? 'border-brand-500 bg-brand-50 ring-1 ring-brand-500 dark:bg-brand-500/10' : 'border-slate-200 dark:border-slate-700',
              )}
            >
              <span className="block text-sm font-semibold text-slate-800 dark:text-slate-100">{o.label}</span>
              <span className="block text-xs text-slate-500 dark:text-slate-400">{o.sub}</span>
            </button>
          ))}
        </div>

        {mode === 'more' && (
          <div className="mt-3">
            <label className="text-xs font-medium text-slate-500 dark:text-slate-400" htmlFor="cash-amount">
              Cash collected (₹)
            </label>
            <TextInput
              id="cash-amount"
              value={amount}
              onChange={(e) => setAmount(e.target.value.replace(/[^\d.]/g, ''))}
              inputMode="decimal"
              placeholder={`e.g. ${Math.ceil(due / 100) * 100 || 500}`}
              className="mt-1 text-lg font-semibold"
              autoFocus
            />
            {error ? (
              <p className="mt-1 text-xs text-rose-500">{error}</p>
            ) : (
              <p className="mt-2 flex items-center gap-1.5 rounded-lg bg-emerald-50 px-3 py-2 text-xs font-medium text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400">
                <Wallet size={14} /> {formatCurrency(change)} will be added to the customer's wallet.
              </p>
            )}
          </div>
        )}

        <button className="btn-primary mt-5 w-full" disabled={!!error} onClick={() => onConfirm(collected)}>
          Confirm {formatCurrency(collected)} collected
        </button>
        <p className="mt-2 text-center text-[11px] text-slate-400">Then ask the customer for their delivery PIN.</p>
      </div>
    </div>
  )
}
