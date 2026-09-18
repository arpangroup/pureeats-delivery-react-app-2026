import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Power, ListChecks, Bike, Wallet as WalletIcon, Star } from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'
import { useOnlineStatus } from '@/hooks/useOnlineStatus'
import { useLocationReporting } from '@/hooks/useLocationReporting'
import { useAvailableOrdersPolling } from '@/hooks/useAvailableOrdersPolling'
import { deliveryOrderService } from '@/services/deliveryOrderService'
import { riderProfileService } from '@/services/riderProfileService'
import { walletService } from '@/services/walletService'
import { formatCurrency } from '@/lib/format'
import { Skeleton } from '@/components/ui/Feedback'
import type { ActiveDelivery, RiderProfile } from '@/types/entities'

export default function HomePage() {
  const { user } = useAuth()
  const { isOnline, isSaving, toggle } = useOnlineStatus()
  const { lastPosition, permissionState, error: locationError } = useLocationReporting(isOnline)
  const [activeDelivery, setActiveDelivery] = useState<ActiveDelivery | null>(null)
  const [profile, setProfile] = useState<RiderProfile | null>(null)
  const [balance, setBalance] = useState<number | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!user) return
    let cancelled = false
    Promise.all([deliveryOrderService.getActiveDelivery(), riderProfileService.getMyProfile(user.id), walletService.balance(user.id)]).then(
      ([active, prof, bal]) => {
        if (cancelled) return
        setActiveDelivery(active)
        setProfile(prof)
        setBalance(bal)
        setLoading(false)
      },
    )
    return () => {
      cancelled = true
    }
  }, [user?.id])

  // The full-screen alert (mounted at the app root) is the ONLY thing that renders a new-order
  // popup - this hook just feeds it when push notifications aren't doing the job.
  useAvailableOrdersPolling({ isOnline, hasActiveDelivery: !!activeDelivery })

  return (
    <div>
      <div className="px-5 pb-4 pt-safe">
        <p className="text-sm text-slate-500 dark:text-slate-400">Welcome back,</p>
        <h1 className="text-xl font-bold text-slate-800 dark:text-slate-100">{user?.name}</h1>
      </div>

      {/* The most visible instantiation of the online/offline requirement - deliberately not buried in settings. */}
      <div className="mx-4 mb-4">
        <button
          onClick={toggle}
          disabled={isSaving || !!activeDelivery}
          className={`flex w-full items-center justify-between rounded-2xl p-4 text-left shadow-card transition-colors ${
            isOnline ? 'bg-brand-600 text-white' : 'bg-white text-slate-800 dark:bg-slate-900 dark:text-slate-100'
          } disabled:cursor-not-allowed disabled:opacity-80`}
        >
          <div className="min-w-0">
            <p className="text-base font-bold">{isOnline ? "You're online" : "You're offline"}</p>
            <p className={`mt-0.5 truncate text-xs ${isOnline ? 'text-white/80' : 'text-slate-500 dark:text-slate-400'}`}>
              {activeDelivery
                ? 'Finish your current delivery to go offline'
                : isOnline
                  ? lastPosition
                    ? `Sending your location - ${lastPosition.latitude.toFixed(4)}, ${lastPosition.longitude.toFixed(4)}`
                    : 'Sending your location...'
                  : 'Go online to start receiving orders'}
            </p>
          </div>
          <span className={`ml-3 flex h-11 w-11 shrink-0 items-center justify-center rounded-full ${isOnline ? 'bg-white/20' : 'bg-brand-100 text-brand-600 dark:bg-brand-500/15'}`}>
            <Power size={20} />
          </span>
        </button>
        {isOnline && permissionState === 'denied' && (
          <p className="mt-2 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-700 dark:bg-amber-500/10 dark:text-amber-400">
            Location permission is denied - enable it in your browser settings so the app can report your position while you deliver.
          </p>
        )}
        {locationError && <p className="mt-2 text-xs text-rose-500">{locationError}</p>}
      </div>

      {activeDelivery && (
        <div className="mx-4 mb-4 rounded-2xl border border-brand-200 bg-brand-50 p-4 dark:border-brand-500/30 dark:bg-brand-500/10">
          <p className="text-xs font-semibold uppercase tracking-wide text-brand-700 dark:text-brand-400">Delivery in progress</p>
          <p className="mt-1 text-sm font-medium text-slate-800 dark:text-slate-100">
            {activeDelivery.restaurantName} &rarr; {activeDelivery.customerAddress}
          </p>
          <Link to="/deliveries/active" className="btn-primary mt-3 inline-flex">
            Continue delivery
          </Link>
        </div>
      )}

      <div className="mx-4 grid grid-cols-2 gap-3">
        <Link to="/orders/available" className="card flex flex-col items-start gap-2 p-4">
          <span className="flex h-9 w-9 items-center justify-center rounded-full bg-brand-100 text-brand-600 dark:bg-brand-500/15">
            <ListChecks size={18} />
          </span>
          <span className="text-sm font-semibold text-slate-800 dark:text-slate-100">Browse orders</span>
        </Link>
        <Link to="/deliveries/history" className="card flex flex-col items-start gap-2 p-4">
          <span className="flex h-9 w-9 items-center justify-center rounded-full bg-brand-100 text-brand-600 dark:bg-brand-500/15">
            <Bike size={18} />
          </span>
          <span className="text-sm font-semibold text-slate-800 dark:text-slate-100">Delivery history</span>
        </Link>
      </div>

      <div className="mx-4 mt-4 card p-4">
        <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-400">Your stats</p>
        {loading ? (
          <div className="flex gap-3">
            <Skeleton className="h-14 flex-1" />
            <Skeleton className="h-14 flex-1" />
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            <Link to="/profile/wallet" className="flex items-center gap-3 rounded-xl bg-slate-50 p-3 dark:bg-slate-800/60">
              <span className="flex h-9 w-9 items-center justify-center rounded-full bg-emerald-100 text-emerald-600 dark:bg-emerald-500/15">
                <WalletIcon size={16} />
              </span>
              <div className="min-w-0">
                <p className="truncate text-sm font-bold text-slate-800 dark:text-slate-100">{formatCurrency(balance ?? 0)}</p>
                <p className="text-[11px] text-slate-500 dark:text-slate-400">Wallet balance</p>
              </div>
            </Link>
            <div className="flex items-center gap-3 rounded-xl bg-slate-50 p-3 dark:bg-slate-800/60">
              <span className="flex h-9 w-9 items-center justify-center rounded-full bg-amber-100 text-amber-600 dark:bg-amber-500/15">
                <Star size={16} />
              </span>
              <div className="min-w-0">
                <p className="truncate text-sm font-bold text-slate-800 dark:text-slate-100">{profile?.rating?.toFixed(1) ?? '-'}</p>
                <p className="text-[11px] text-slate-500 dark:text-slate-400">Rider rating</p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
