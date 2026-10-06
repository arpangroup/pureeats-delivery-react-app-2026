import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Wallet as WalletIcon, Banknote, ChevronRight, BarChart3, Info, ReceiptText } from 'lucide-react'
import { PageHeader } from '@/components/layout/PageHeader'
import { LoadingBlock, EmptyState } from '@/components/ui/Feedback'
import { earningsService } from '@/services/earningsService'
import { formatCurrency, formatDate } from '@/lib/format'
import { showErrorToast } from '@/lib/errorToast'
import { EarningDetailSheet, SettlementDetailSheet, SettlementStatus, TransactionIcon, directionText } from '@/components/earnings/DetailSheets'
import type { RiderEarning, RiderEarningsSummary, RiderSettlement, RiderWalletTransaction } from '@/types/entities'

type Tab = 'transactions' | 'pending' | 'settlements'

/**
 * The rider's money at a glance. The top card separates what they've EARNED from what's actually
 * been PAID: pending earnings (credited per delivery, not yet paid out) minus the COD cash they're
 * holding = the net the next settlement will pay them (or that they owe, if negative). Every
 * transaction, pending trip and settlement opens its own breakdown.
 */
export default function WalletPage() {
  const [summary, setSummary] = useState<RiderEarningsSummary | null>(null)
  const [transactions, setTransactions] = useState<RiderWalletTransaction[] | null>(null)
  const [pending, setPending] = useState<RiderEarning[] | null>(null)
  const [settlements, setSettlements] = useState<RiderSettlement[] | null>(null)
  const [tab, setTab] = useState<Tab>('transactions')
  const [openOrderId, setOpenOrderId] = useState<number | null>(null)
  const [openSettlementId, setOpenSettlementId] = useState<number | null>(null)

  useEffect(() => {
    let cancelled = false
    earningsService.summary().then((s) => !cancelled && setSummary(s)).catch((err) => !cancelled && showErrorToast(err, 'Could not load your settlement summary.'))
    earningsService
      .walletTransactions()
      .then((t) => !cancelled && setTransactions(t))
      .catch((err) => {
        if (cancelled) return
        setTransactions([])
        showErrorToast(err, 'Could not load your transactions.')
      })
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    let cancelled = false
    if (tab === 'pending' && pending === null) {
      earningsService
        .earnings(true)
        .then((p) => !cancelled && setPending(p))
        .catch((err) => {
          if (cancelled) return
          setPending([])
          showErrorToast(err, 'Could not load pending trips.')
        })
    }
    if (tab === 'settlements' && settlements === null) {
      earningsService
        .settlements()
        .then((s) => !cancelled && setSettlements(s))
        .catch((err) => {
          if (cancelled) return
          setSettlements([])
          showErrorToast(err, 'Could not load settlements.')
        })
    }
    return () => {
      cancelled = true
    }
  }, [tab, pending, settlements])

  function openTransaction(t: RiderWalletTransaction) {
    if (t.kind === 'EARNING' && t.orderId != null) setOpenOrderId(t.orderId)
    else if (t.kind === 'SETTLEMENT' && t.settlementId != null) setOpenSettlementId(t.settlementId)
  }

  const net = summary?.netPending ?? 0
  const netTitle = summary?.netDirection === 'COLLECTED_FROM_RIDER' ? 'You owe the platform' : 'Next settlement pays you'

  return (
    <div>
      <PageHeader
        title="Wallet & settlement"
        actions={
          <Link to="/earnings" className="flex items-center gap-1 rounded-full px-2.5 py-1.5 text-xs font-semibold text-brand-600 hover:bg-brand-50 dark:hover:bg-brand-500/10">
            <BarChart3 size={15} /> Analytics
          </Link>
        }
      />
      <div className="px-4 py-4">
        {/* Brand green only when the rider is owed money - owing the platform shouldn't read as good news. */}
        <div className={`card p-5 text-white ${summary?.netDirection === 'COLLECTED_FROM_RIDER' ? 'bg-slate-800 dark:bg-slate-800' : 'bg-brand-600'}`}>
          <div className="flex items-center gap-3">
            <span className="flex h-11 w-11 items-center justify-center rounded-full bg-white/15">
              <WalletIcon size={20} />
            </span>
            <div>
              <p className="text-xs text-white/75">{netTitle}</p>
              <p className="text-2xl font-bold">{summary ? formatCurrency(Math.abs(net)) : '...'}</p>
            </div>
          </div>
          <div className="mt-4 grid grid-cols-2 gap-2 text-xs">
            <div className="rounded-xl bg-white/10 p-2.5">
              <p className="text-white/70">Earnings not yet paid</p>
              <p className="mt-0.5 text-sm font-bold">{summary ? formatCurrency(summary.pendingEarnings) : '...'}</p>
              <p className="text-white/60">{summary ? `${summary.unsettledTrips} trip(s)` : ''}</p>
            </div>
            <div className="rounded-xl bg-white/10 p-2.5">
              <p className="flex items-center gap-1 text-white/70">
                <Banknote size={12} /> COD cash in hand
              </p>
              <p className="mt-0.5 text-sm font-bold">{summary ? `- ${formatCurrency(summary.cashInHand)}` : '...'}</p>
              <p className="text-white/60">deducted at settlement</p>
            </div>
          </div>
        </div>

        {summary && (
          <div className="mt-3 grid grid-cols-2 gap-3">
            <div className="card p-3">
              <p className="text-[11px] text-slate-400">Lifetime earnings</p>
              <p className="text-sm font-bold text-slate-800 dark:text-slate-100">{formatCurrency(summary.lifetimeEarnings)}</p>
              <p className="text-[11px] text-slate-400">{summary.lifetimeTrips} trips</p>
            </div>
            <button
              className="card p-3 text-left disabled:cursor-default"
              disabled={!summary.lastSettlement}
              onClick={() => summary.lastSettlement && setOpenSettlementId(summary.lastSettlement.id)}
            >
              <p className="text-[11px] text-slate-400">Last settlement</p>
              {summary.lastSettlement ? (
                <>
                  <p className="text-sm font-bold text-slate-800 dark:text-slate-100">{formatCurrency(Math.abs(summary.lastSettlement.netAmount))}</p>
                  <p className="text-[11px] text-slate-400">{formatDate(summary.lastSettlement.createdAt, false)}</p>
                </>
              ) : (
                <p className="text-sm font-semibold text-slate-500">None yet</p>
              )}
            </button>
          </div>
        )}

        <p className="mt-3 flex items-start gap-1.5 text-[11px] text-slate-400">
          <Info size={12} className="mt-0.5 shrink-0" />
          Earnings are added to your wallet as soon as you deliver. They're paid out when the platform settles with you; cash you collected on COD orders is deducted at that point.
        </p>

        <div className="mt-5 flex rounded-xl bg-slate-100 p-1 text-xs font-semibold dark:bg-slate-800">
          {(
            [
              ['transactions', 'Transactions'],
              ['pending', 'Pending trips'],
              ['settlements', 'Settlements'],
            ] as const
          ).map(([key, label]) => (
            <button
              key={key}
              onClick={() => setTab(key)}
              className={`flex-1 rounded-lg py-2 ${tab === key ? 'bg-white text-slate-800 shadow-sm dark:bg-slate-900 dark:text-slate-100' : 'text-slate-500 dark:text-slate-400'}`}
            >
              {label}
            </button>
          ))}
        </div>

        <div className="mt-3">
          {tab === 'transactions' && (
            <>
              {transactions === null && <LoadingBlock label="Loading transactions..." />}
              {transactions && transactions.length === 0 && (
                <EmptyState title="No transactions yet" description="Earnings from your deliveries will show up here." icon={<WalletIcon size={22} />} />
              )}
              {transactions && transactions.length > 0 && (
                <div className="card divide-y divide-slate-100 overflow-hidden dark:divide-slate-800">
                  {transactions.map((t) => {
                    const clickable = (t.kind === 'EARNING' && t.orderId != null) || (t.kind === 'SETTLEMENT' && t.settlementId != null)
                    return (
                      <button key={t.id} className="flex w-full items-center gap-3 px-4 py-3.5 text-left disabled:cursor-default" onClick={() => openTransaction(t)} disabled={!clickable}>
                        <TransactionIcon type={t.type} />
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium text-slate-800 dark:text-slate-100">
                            {t.kind === 'EARNING' ? `Delivery · ${t.uniqueOrderId ?? ''}` : t.kind === 'SETTLEMENT' ? `Settlement #${t.settlementId}` : t.note ?? 'Adjustment'}
                          </p>
                          <p className="text-xs text-slate-400">{formatDate(t.createdAt)}</p>
                        </div>
                        <span className={`shrink-0 text-sm font-semibold ${t.type === 'credit' ? 'text-emerald-600' : 'text-slate-700 dark:text-slate-200'}`}>
                          {t.type === 'credit' ? '+' : '-'}
                          {formatCurrency(t.amount)}
                        </span>
                        {clickable && <ChevronRight size={16} className="shrink-0 text-slate-300" />}
                      </button>
                    )
                  })}
                </div>
              )}
            </>
          )}

          {tab === 'pending' && (
            <>
              {pending === null && <LoadingBlock label="Loading pending trips..." />}
              {pending && pending.length === 0 && <EmptyState title="All settled" description="You have no trips waiting for settlement." icon={<ReceiptText size={22} />} />}
              {pending && pending.length > 0 && (
                <div className="card divide-y divide-slate-100 overflow-hidden dark:divide-slate-800">
                  {pending.map((e) => (
                    <button key={e.tripId} className="flex w-full items-center gap-3 px-4 py-3 text-left" onClick={() => setOpenOrderId(e.orderId)}>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-slate-800 dark:text-slate-100">{e.restaurantName}</p>
                        <p className="text-xs text-slate-400">
                          {e.uniqueOrderId} · {formatDate(e.deliveredAt)}
                          {e.codCollected > 0 ? ` · COD ${formatCurrency(e.codCollected)}` : ''}
                        </p>
                      </div>
                      <span className="shrink-0 text-sm font-semibold text-slate-800 dark:text-slate-100">{formatCurrency(e.earning)}</span>
                      <ChevronRight size={16} className="shrink-0 text-slate-300" />
                    </button>
                  ))}
                </div>
              )}
            </>
          )}

          {tab === 'settlements' && (
            <>
              {settlements === null && <LoadingBlock label="Loading settlements..." />}
              {settlements && settlements.length === 0 && (
                <EmptyState title="No settlements yet" description="When the platform settles with you, it will show up here." icon={<ReceiptText size={22} />} />
              )}
              {settlements && settlements.length > 0 && (
                <div className="card divide-y divide-slate-100 overflow-hidden dark:divide-slate-800">
                  {settlements.map((s) => (
                    <button key={s.id} className="flex w-full items-center gap-3 px-4 py-3 text-left" onClick={() => setOpenSettlementId(s.id)}>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-slate-800 dark:text-slate-100">{directionText(s)}</p>
                        <p className="text-xs text-slate-400">
                          #{s.id} · {formatDate(s.createdAt, false)} · {s.tripCount} trip(s)
                        </p>
                      </div>
                      <SettlementStatus settled />
                      <ChevronRight size={16} className="shrink-0 text-slate-300" />
                    </button>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {openOrderId !== null && (
        <EarningDetailSheet
          orderId={openOrderId}
          onClose={() => setOpenOrderId(null)}
          onOpenSettlement={(id) => {
            setOpenOrderId(null)
            setOpenSettlementId(id)
          }}
        />
      )}
      {openSettlementId !== null && (
        <SettlementDetailSheet
          settlementId={openSettlementId}
          onClose={() => setOpenSettlementId(null)}
          onOpenEarning={(orderId) => {
            setOpenSettlementId(null)
            setOpenOrderId(orderId)
          }}
        />
      )}
    </div>
  )
}
