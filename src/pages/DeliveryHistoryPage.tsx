import { useEffect, useState } from 'react'
import { PackageSearch, ChevronRight } from 'lucide-react'
import { PageHeader } from '@/components/layout/PageHeader'
import { LoadingBlock, EmptyState, Badge } from '@/components/ui/Feedback'
import { deliveryOrderService } from '@/services/deliveryOrderService'
import { formatCurrency, formatDate } from '@/lib/format'
import type { DeliveryHistoryEntry, OrderStatus } from '@/types/entities'
import { showErrorToast } from '@/lib/errorToast'
import { EarningDetailSheet, SettlementDetailSheet } from '@/components/earnings/DetailSheets'

const statusTone: Partial<Record<OrderStatus, 'green' | 'red' | 'slate'>> = {
  DELIVERED: 'green',
  SELF_PICKUP_COMPLETED: 'green',
  CANCELLED: 'red',
}

export default function DeliveryHistoryPage() {
  const [history, setHistory] = useState<DeliveryHistoryEntry[] | null>(null)
  const [openOrderId, setOpenOrderId] = useState<number | null>(null)
  const [openSettlementId, setOpenSettlementId] = useState<number | null>(null)

  useEffect(() => {
    let cancelled = false
    deliveryOrderService
      .history()
      .then((list) => {
        if (!cancelled) setHistory(list)
      })
      .catch((err) => {
        if (cancelled) return
        setHistory([])
        showErrorToast(err, 'Could not load your delivery history.')
      })
    return () => {
      cancelled = true
    }
  }, [])

  return (
    <div>
      <PageHeader title="Delivery history" />
      <div className="space-y-3 px-4 py-4">
        {history === null && <LoadingBlock label="Loading your deliveries..." />}
        {history && history.length === 0 && (
          <EmptyState title="No deliveries yet" description="Completed deliveries will show up here." icon={<PackageSearch size={22} />} />
        )}
        {history?.map((entry) => {
          const delivered = entry.status === 'DELIVERED'
          return (
          <button
            key={entry.id}
            className="card block w-full p-4 text-left disabled:cursor-default"
            disabled={!delivered}
            onClick={() => setOpenOrderId(entry.id)}
            aria-label={delivered ? `Earning details for ${entry.uniqueOrderId}` : undefined}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-slate-800 dark:text-slate-100">{entry.restaurantName}</p>
                <p className="mt-0.5 truncate text-xs text-slate-500 dark:text-slate-400">{entry.customerAddress}</p>
              </div>
              <Badge tone={statusTone[entry.status] ?? 'slate'}>{entry.status.replace(/_/g, ' ')}</Badge>
            </div>
            <div className="mt-3 flex items-center justify-between border-t border-slate-100 pt-3 text-xs text-slate-500 dark:border-slate-800 dark:text-slate-400">
              <span>{formatDate(entry.deliveredAt ?? entry.createdAt)}</span>
              <span className="flex items-center gap-1 font-semibold text-slate-800 dark:text-slate-100">
                {formatCurrency(entry.payoutEstimate)}
                {delivered && <ChevronRight size={14} className="text-slate-300" />}
              </span>
            </div>
          </button>
          )
        })}
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
      {openSettlementId !== null && <SettlementDetailSheet settlementId={openSettlementId} onClose={() => setOpenSettlementId(null)} />}
    </div>
  )
}
