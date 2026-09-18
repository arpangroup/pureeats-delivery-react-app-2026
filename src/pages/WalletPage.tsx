import { useEffect, useState } from 'react'
import { ArrowDownLeft, ArrowUpRight, Wallet as WalletIcon } from 'lucide-react'
import { PageHeader } from '@/components/layout/PageHeader'
import { LoadingBlock, EmptyState } from '@/components/ui/Feedback'
import { useAuth } from '@/hooks/useAuth'
import { walletService } from '@/services/walletService'
import { formatCurrency, formatDate } from '@/lib/format'
import type { WalletTransaction } from '@/types/entities'

export default function WalletPage() {
  const { user } = useAuth()
  const [balance, setBalance] = useState<number | null>(null)
  const [transactions, setTransactions] = useState<WalletTransaction[] | null>(null)

  useEffect(() => {
    if (!user) return
    let cancelled = false
    Promise.all([walletService.balance(user.id), walletService.transactions(user.id)]).then(([bal, txns]) => {
      if (cancelled) return
      setBalance(bal)
      setTransactions(txns)
    })
    return () => {
      cancelled = true
    }
  }, [user?.id])

  return (
    <div>
      <PageHeader title="Wallet" />
      <div className="px-4 py-4">
        <div className="card flex items-center gap-4 bg-brand-600 p-5 text-white">
          <span className="flex h-12 w-12 items-center justify-center rounded-full bg-white/15">
            <WalletIcon size={22} />
          </span>
          <div>
            <p className="text-xs text-white/70">Available balance</p>
            <p className="text-2xl font-bold">{balance === null ? '...' : formatCurrency(balance)}</p>
          </div>
        </div>

        <p className="mb-2 mt-6 text-xs font-semibold uppercase tracking-wide text-slate-400">Transactions</p>
        {transactions === null && <LoadingBlock label="Loading transactions..." />}
        {transactions && transactions.length === 0 && (
          <EmptyState title="No transactions yet" description="Your payouts and withdrawals will show up here." icon={<WalletIcon size={22} />} />
        )}
        <div className="card divide-y divide-slate-100 overflow-hidden dark:divide-slate-800">
          {transactions?.map((txn) => (
            <div key={txn.id} className="flex items-center gap-3 px-4 py-3.5">
              <span
                className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${
                  txn.type === 'credit' ? 'bg-emerald-100 text-emerald-600 dark:bg-emerald-500/15' : 'bg-rose-100 text-rose-600 dark:bg-rose-500/15'
                }`}
              >
                {txn.type === 'credit' ? <ArrowDownLeft size={16} /> : <ArrowUpRight size={16} />}
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-slate-800 dark:text-slate-100">{txn.note ?? (txn.type === 'credit' ? 'Payout' : 'Debit')}</p>
                <p className="text-xs text-slate-400">{formatDate(txn.createdAt)}</p>
              </div>
              <span className={`shrink-0 text-sm font-semibold ${txn.type === 'credit' ? 'text-emerald-600' : 'text-rose-600'}`}>
                {txn.type === 'credit' ? '+' : '-'}
                {formatCurrency(txn.amount)}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
