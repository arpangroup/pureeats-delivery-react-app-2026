import { useEffect, useState } from 'react'
import { LogIn, Power, PowerOff, ShieldAlert, TimerOff } from 'lucide-react'
import { PageHeader } from '@/components/layout/PageHeader'
import { LoadingBlock, EmptyState } from '@/components/ui/Feedback'
import { deliveryOrderService } from '@/services/deliveryOrderService'
import { classNames } from '@/lib/format'
import { showErrorToast } from '@/lib/errorToast'
import type { RiderActivity } from '@/types/entities'

const formatWhen = (iso: string) =>
  new Date(iso).toLocaleString(undefined, { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' })

type Tab = 'status' | 'logins'

/** The partner's own online/offline history - including when the system set them offline for inactivity - and sign-ins. */
export default function ActivityPage() {
  const [activity, setActivity] = useState<RiderActivity | null>(null)
  const [tab, setTab] = useState<Tab>('status')

  useEffect(() => {
    let cancelled = false
    deliveryOrderService
      .activity()
      .then((a) => {
        if (!cancelled) setActivity(a)
      })
      .catch((err) => {
        if (cancelled) return
        showErrorToast(err, 'Could not load your activity.')
        setActivity({ statusHistory: [], loginHistory: [] })
      })
    return () => {
      cancelled = true
    }
  }, [])

  return (
    <div>
      <PageHeader title="Activity" />
      <div className="px-4 py-4">
        <div className="mb-4 grid grid-cols-2 rounded-xl bg-slate-100 p-1 text-sm font-semibold dark:bg-slate-800">
          {(['status', 'logins'] as Tab[]).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={classNames(
                'rounded-lg py-1.5',
                tab === t ? 'bg-white text-slate-800 shadow-sm dark:bg-slate-900 dark:text-slate-100' : 'text-slate-500 dark:text-slate-400',
              )}
            >
              {t === 'status' ? 'Online / offline' : 'Logins'}
            </button>
          ))}
        </div>

        {activity === null && <LoadingBlock />}

        {activity && tab === 'status' &&
          (activity.statusHistory.length === 0 ? (
            <EmptyState title="No status changes yet" description="Going online or offline will show up here." icon={<Power size={22} />} />
          ) : (
            <ul className="card divide-y divide-slate-100 overflow-hidden dark:divide-slate-800">
              {activity.statusHistory.map((s, i) => {
                const forced = !s.online && (s.reason === 'INACTIVITY' || s.reason === 'ADMIN')
                const Icon = s.online ? Power : s.reason === 'INACTIVITY' ? TimerOff : s.reason === 'ADMIN' ? ShieldAlert : PowerOff
                return (
                  <li key={i} className="flex items-start gap-3 px-4 py-3">
                    <span
                      className={classNames(
                        'mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full',
                        s.online
                          ? 'bg-emerald-100 text-emerald-600 dark:bg-emerald-500/15 dark:text-emerald-400'
                          : forced
                            ? 'bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-400'
                            : 'bg-rose-100 text-rose-600 dark:bg-rose-500/15 dark:text-rose-400',
                      )}
                    >
                      <Icon size={15} />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">{s.online ? 'Online' : 'Offline'}</p>
                      <p className={classNames('text-xs', forced ? 'text-amber-700 dark:text-amber-400' : 'text-slate-500 dark:text-slate-400')}>{s.message}</p>
                    </div>
                    <span className="shrink-0 text-[11px] text-slate-400">{formatWhen(s.at)}</span>
                  </li>
                )
              })}
            </ul>
          ))}

        {activity && tab === 'logins' &&
          (activity.loginHistory.length === 0 ? (
            <EmptyState title="No sign-ins recorded" icon={<LogIn size={22} />} />
          ) : (
            <ul className="card divide-y divide-slate-100 overflow-hidden dark:divide-slate-800">
              {activity.loginHistory.map((l, i) => {
                const ok = l.status?.toUpperCase() === 'SUCCESS'
                return (
                  <li key={i} className="flex items-start gap-3 px-4 py-3">
                    <span
                      className={classNames(
                        'mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full',
                        ok ? 'bg-brand-100 text-brand-600 dark:bg-brand-500/15 dark:text-brand-400' : 'bg-rose-100 text-rose-600 dark:bg-rose-500/15 dark:text-rose-400',
                      )}
                    >
                      <LogIn size={15} />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">
                        {ok ? 'Signed in' : 'Sign-in failed'}
                        {l.method && <span className="ml-1 text-xs font-normal text-slate-400">via {l.method.toLowerCase()}</span>}
                      </p>
                      {l.device && <p className="truncate text-xs text-slate-500 dark:text-slate-400">{l.device}</p>}
                      {l.location && <p className="text-xs text-slate-400">{l.location}</p>}
                    </div>
                    <span className="shrink-0 text-[11px] text-slate-400">{formatWhen(l.at)}</span>
                  </li>
                )
              })}
            </ul>
          ))}
      </div>
    </div>
  )
}
