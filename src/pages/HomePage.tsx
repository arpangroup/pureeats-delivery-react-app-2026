import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Power, ListChecks, Bike, Wallet as WalletIcon, Star, Wrench, AlertTriangle, X } from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'
import { useRiderSession } from '@/context/RiderSessionContext'
import { riderProfileService } from '@/services/riderProfileService'
import { walletService } from '@/services/walletService'
import { formatCurrency } from '@/lib/format'
import { Skeleton } from '@/components/ui/Feedback'
import type { RiderProfile } from '@/types/entities'

export default function HomePage() {
  const { user } = useAuth()
  // Online status, GPS pings and new-order polling all live app-wide in RiderSessionProvider now, so
  // they keep running when the rider switches to another tab - this page only renders them.
  const {
    isOnline,
    isSaving,
    toggle,
    statusNotice,
    dismissStatusNotice,
    locationTrackingEnabled,
    platformSettingsLoaded,
    lastPosition,
    permissionState,
    locationError,
    activeDeliveries,
  } = useRiderSession()
  const activeDelivery = activeDeliveries?.[0] ?? null
  const [profile, setProfile] = useState<RiderProfile | null>(null)
  const [balance, setBalance] = useState<number | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!user) return
    let cancelled = false
    Promise.all([riderProfileService.getMyProfile(user.id), walletService.balance(user.id)]).then(([prof, bal]) => {
      if (cancelled) return
      setProfile(prof)
      setBalance(bal)
      setLoading(false)
    })
    return () => {
      cancelled = true
    }
  }, [user?.id])

  return (
    <div>
      <div className="px-5 pb-4 pt-safe">
        <p className="text-sm text-slate-500 dark:text-slate-400">Welcome back,</p>
        <h1 className="text-xl font-bold text-slate-800 dark:text-slate-100">{user?.name}</h1>
      </div>

      {/* The most visible instantiation of the online/offline requirement - deliberately not buried in settings. */}
      <div className="mx-4 mb-4">
        {statusNotice && (
          <div className="mb-3 flex items-start gap-2 rounded-xl bg-amber-50 p-3 text-xs text-amber-800 dark:bg-amber-500/10 dark:text-amber-300">
            <AlertTriangle size={16} className="mt-0.5 shrink-0" />
            <p className="flex-1">{statusNotice}</p>
            <button onClick={dismissStatusNotice} aria-label="Dismiss" className="shrink-0 text-amber-700 dark:text-amber-400">
              <X size={14} />
            </button>
          </div>
        )}
        {platformSettingsLoaded && !locationTrackingEnabled ? (
          <div className="flex w-full items-center gap-3 rounded-2xl bg-amber-50 p-4 shadow-card dark:bg-amber-500/10">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-400">
              <Wrench size={20} />
            </span>
            <div className="min-w-0">
              <p className="text-base font-bold text-amber-800 dark:text-amber-300">Maintenance mode</p>
              <p className="mt-0.5 text-xs text-amber-700 dark:text-amber-400">
                Location tracking is temporarily paused platform-wide. You can't go online right now - check back shortly.
              </p>
            </div>
          </div>
        ) : (
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
        )}
        {locationTrackingEnabled && isOnline && permissionState === 'denied' && (
          <p className="mt-2 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-700 dark:bg-amber-500/10 dark:text-amber-400">
            Location permission is denied - enable it in your browser settings so the app can report your position while you deliver.
          </p>
        )}
        {locationTrackingEnabled && locationError && <p className="mt-2 text-xs text-rose-500">{locationError}</p>}
      </div>

      {activeDelivery && (
        <div className="mx-4 mb-4 rounded-2xl border border-brand-200 bg-brand-50 p-4 dark:border-brand-500/30 dark:bg-brand-500/10">
          <p className="text-xs font-semibold uppercase tracking-wide text-brand-700 dark:text-brand-400">
            {activeDeliveries && activeDeliveries.length > 1 ? `${activeDeliveries.length} deliveries in progress` : 'Delivery in progress'}
            {activeDelivery.assignedBy === 'ADMIN' && ' - assigned by admin'}
          </p>
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
