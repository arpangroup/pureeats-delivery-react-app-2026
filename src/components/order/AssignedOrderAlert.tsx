import { useNavigate } from 'react-router-dom'
import { MapPin, Store, ShieldCheck } from 'lucide-react'
import { useRiderSession } from '@/context/RiderSessionContext'
import { formatCurrency } from '@/lib/format'
import { useDriverSettings } from '@/hooks/useDriverSettings'
import { OrderStatusBadge, PaymentBadge, PickupCountdown } from '@/components/order/OrderMeta'

/**
 * Shown (with the order sound ringing - see RiderSessionProvider) when an admin assigns an order to
 * this rider directly. Such an order never passes through the rider's own accept flow, so without
 * this it would silently sit in their queue. Mounted once at the app root next to FullScreenOrderAlert.
 */
export function AssignedOrderAlert() {
  const { assignedAlert, acknowledgeAssignedAlert } = useRiderSession()
  const navigate = useNavigate()
  const { showPayout } = useDriverSettings()

  if (!assignedAlert) return null

  function handleView() {
    acknowledgeAssignedAlert()
    navigate('/deliveries/active')
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/70 px-4 pb-safe animate-fade-in sm:items-center">
      <div className="mb-4 w-full max-w-md rounded-2xl bg-white p-5 shadow-xl dark:bg-slate-900">
        <div className="flex items-center gap-3">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-brand-100 text-brand-600 dark:bg-brand-500/15 dark:text-brand-400">
            <ShieldCheck size={22} />
          </span>
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-wide text-brand-600 dark:text-brand-400">Assigned to you</p>
            <p className="truncate font-mono text-lg font-bold text-slate-800 dark:text-slate-100">#{assignedAlert.uniqueOrderId}</p>
          </div>
        </div>
        <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">An admin has assigned this delivery to you.</p>
        <div className="mt-2 flex flex-wrap items-center gap-1.5">
          <PaymentBadge mode={assignedAlert.paymentMode} />
          <OrderStatusBadge status={assignedAlert.status} />
          {!assignedAlert.pickedUpAt && <PickupCountdown dueAt={assignedAlert.pickupDueAt} compact />}
        </div>

        <div className="mt-4 space-y-3 rounded-xl bg-slate-50 p-3 dark:bg-slate-800/60">
          <div className="flex gap-2">
            <Store size={16} className="mt-0.5 shrink-0 text-brand-600" />
            <div className="min-w-0">
              <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">{assignedAlert.restaurantName}</p>
              <p className="truncate text-xs text-slate-500 dark:text-slate-400">{assignedAlert.restaurantAddress}</p>
            </div>
          </div>
          <div className="flex gap-2">
            <MapPin size={16} className="mt-0.5 shrink-0 text-rose-500" />
            <p className="min-w-0 truncate text-xs text-slate-600 dark:text-slate-300">{assignedAlert.customerAddress}</p>
          </div>
          {showPayout && (
            <div className="flex justify-between text-sm">
              <span className="text-slate-500 dark:text-slate-400">Your payout</span>
              <span className="font-bold text-slate-800 dark:text-slate-100">{formatCurrency(assignedAlert.payoutEstimate)}</span>
            </div>
          )}
        </div>

        <button className="btn-primary mt-4 w-full" onClick={handleView}>
          View delivery
        </button>
        <button className="mt-2 w-full py-2 text-center text-sm font-medium text-slate-500 dark:text-slate-400" onClick={acknowledgeAssignedAlert}>
          Got it
        </button>
      </div>
    </div>
  )
}
