import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowDownRight, ArrowUpRight, Minus, Wallet, Trophy, Store, CalendarRange } from 'lucide-react'
import { PageHeader } from '@/components/layout/PageHeader'
import { LoadingBlock, Skeleton } from '@/components/ui/Feedback'
import { BarChart } from '@/components/earnings/BarChart'
import { earningsService, isoDate } from '@/services/earningsService'
import { formatCurrency } from '@/lib/format'
import { showErrorToast } from '@/lib/errorToast'
import type { AnalyticsPeriod, RiderEarningsAnalytics } from '@/types/entities'

const PERIODS: { key: AnalyticsPeriod; label: string }[] = [
  { key: 'DAY', label: 'Today' },
  { key: 'WEEK', label: 'This week' },
  { key: 'MONTH', label: 'This month' },
  { key: 'CUSTOM', label: 'Custom' },
]

const PREVIOUS_LABEL: Record<AnalyticsPeriod, string> = {
  DAY: 'yesterday',
  WEEK: 'last week',
  MONTH: 'last month',
  CUSTOM: 'the previous period',
}

const TREND_TITLE: Record<AnalyticsPeriod, string> = {
  DAY: 'Last 7 days',
  WEEK: 'Last 8 weeks',
  MONTH: 'Last 6 months',
  CUSTOM: 'Selected range',
}

function daysAgo(n: number): string {
  const d = new Date()
  d.setDate(d.getDate() - n)
  return isoDate(d)
}

function fmtRange(from: string, to: string): string {
  const f = new Date(from + 'T00:00:00')
  const t = new Date(to + 'T00:00:00')
  const opts: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'short' }
  return from === to ? f.toLocaleDateString('en-IN', { ...opts, year: 'numeric' }) : `${f.toLocaleDateString('en-IN', opts)} – ${t.toLocaleDateString('en-IN', { ...opts, year: 'numeric' })}`
}

function hourLabel(h: number): string {
  const suffix = h < 12 ? 'am' : 'pm'
  const hour = h % 12 === 0 ? 12 : h % 12
  return `${hour}${suffix}`
}

/** Whole km once it's 100+ so the value never wraps inside a narrow stat tile. */
function fmtKm(km: number): string {
  return km >= 100 ? `${Math.round(km).toLocaleString('en-IN')} km` : `${km.toFixed(1)} km`
}

function Stat({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-xl bg-slate-50 p-3 dark:bg-slate-800/60">
      <p className="text-[11px] text-slate-500 dark:text-slate-400">{label}</p>
      <p className="mt-0.5 text-base font-bold text-slate-800 dark:text-slate-100">{value}</p>
      {sub && <p className="text-[11px] text-slate-400">{sub}</p>}
    </div>
  )
}

/**
 * Earnings analytics, Zomato/Swiggy-partner style: pick Today / This week / This month or any custom
 * date range, see the headline total with the change vs the previous equally long period, trip and
 * distance stats, the trend chart, busiest hours, weekday pattern, COD vs online split and the
 * restaurants that paid best.
 */
export default function EarningsPage() {
  const [period, setPeriod] = useState<AnalyticsPeriod>('DAY')
  const [customFrom, setCustomFrom] = useState(daysAgo(6))
  const [customTo, setCustomTo] = useState(daysAgo(0))
  const [data, setData] = useState<RiderEarningsAnalytics | null>(null)
  const [loading, setLoading] = useState(true)
  const today = daysAgo(0)
  const customInvalid = period === 'CUSTOM' && (!customFrom || !customTo || customTo < customFrom)

  useEffect(() => {
    if (customInvalid) return
    let cancelled = false
    setLoading(true)
    earningsService
      .analytics(period, period === 'CUSTOM' ? customFrom : undefined, period === 'CUSTOM' ? customTo : undefined)
      .then((a) => !cancelled && setData(a))
      .catch((err) => !cancelled && showErrorToast(err, 'Could not load your earnings analytics.'))
      .finally(() => !cancelled && setLoading(false))
    return () => {
      cancelled = true
    }
  }, [period, customFrom, customTo, customInvalid])

  const hourData = useMemo(() => {
    if (!data) return []
    // Trim to the hours that actually have deliveries (plus one hour of padding) so the chart isn't mostly empty night hours.
    const active = data.byHour.filter((h) => h.trips > 0).map((h) => h.hour)
    const first = active.length ? Math.max(0, Math.min(...active) - 1) : 9
    const last = active.length ? Math.min(23, Math.max(...active) + 1) : 23
    return data.byHour
      .filter((h) => h.hour >= first && h.hour <= last)
      .map((h) => ({ key: String(h.hour), label: hourLabel(h.hour), value: h.earnings, detail: `${h.trips} trip${h.trips === 1 ? '' : 's'}` }))
  }, [data])

  const busiestHour = data?.byHour.reduce((best, h) => (h.trips > (best?.trips ?? 0) ? h : best), null as RiderEarningsAnalytics['byHour'][number] | null)
  const change = data?.changePercent ?? null
  const totalTrips = data ? data.paymentSplit.codTrips + data.paymentSplit.onlineTrips : 0
  const codShare = totalTrips ? Math.round((data!.paymentSplit.codTrips / totalTrips) * 100) : 0

  return (
    <div>
      <PageHeader
        title="Earnings"
        actions={
          <Link to="/profile/wallet" className="flex items-center gap-1 rounded-full px-2.5 py-1.5 text-xs font-semibold text-brand-600 hover:bg-brand-50 dark:hover:bg-brand-500/10">
            <Wallet size={15} /> Wallet
          </Link>
        }
      />
      <div className="space-y-4 px-4 py-4">
        <div className="flex gap-2 overflow-x-auto pb-1">
          {PERIODS.map((p) => (
            <button
              key={p.key}
              onClick={() => setPeriod(p.key)}
              className={`shrink-0 rounded-full px-3.5 py-1.5 text-xs font-semibold ${
                period === p.key ? 'bg-brand-600 text-white' : 'bg-white text-slate-600 shadow-card dark:bg-slate-900 dark:text-slate-300'
              }`}
              aria-pressed={period === p.key}
            >
              {p.label}
            </button>
          ))}
        </div>

        {period === 'CUSTOM' && (
          <div className="card space-y-3 p-3">
            <div className="flex items-center gap-2 text-xs font-semibold text-slate-500 dark:text-slate-400">
              <CalendarRange size={14} /> Date range
            </div>
            <div className="grid grid-cols-2 gap-2">
              <label className="text-[11px] text-slate-500 dark:text-slate-400">
                From
                <input
                  type="date"
                  value={customFrom}
                  max={customTo || today}
                  onChange={(e) => setCustomFrom(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-sm text-slate-800 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                />
              </label>
              <label className="text-[11px] text-slate-500 dark:text-slate-400">
                To
                <input
                  type="date"
                  value={customTo}
                  min={customFrom}
                  max={today}
                  onChange={(e) => setCustomTo(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-sm text-slate-800 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                />
              </label>
            </div>
            <div className="flex flex-wrap gap-2">
              {[
                ['Last 7 days', 6],
                ['Last 30 days', 29],
                ['Last 90 days', 89],
              ].map(([label, n]) => (
                <button
                  key={label}
                  onClick={() => {
                    setCustomFrom(daysAgo(n as number))
                    setCustomTo(today)
                  }}
                  className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-medium text-slate-600 dark:bg-slate-800 dark:text-slate-300"
                >
                  {label}
                </button>
              ))}
            </div>
            {customInvalid && <p className="text-xs text-rose-600">The end date must be on or after the start date.</p>}
          </div>
        )}

        {!data && loading && <LoadingBlock label="Crunching your numbers..." />}

        {data && (
          <div className={loading ? 'opacity-60 transition-opacity' : 'transition-opacity'}>
            <div className="card p-4">
              <p className="text-xs text-slate-500 dark:text-slate-400">{fmtRange(data.currentFrom, data.currentTo)}</p>
              <p className="mt-1 text-3xl font-bold text-slate-800 dark:text-slate-100">{formatCurrency(data.current.earnings)}</p>
              <p className="mt-1 flex items-center gap-1 text-xs text-slate-500 dark:text-slate-400">
                {change === null ? (
                  <>
                    <Minus size={13} /> No earnings {PREVIOUS_LABEL[data.period]} to compare
                  </>
                ) : (
                  <>
                    {change >= 0 ? <ArrowUpRight size={13} className="text-emerald-600" /> : <ArrowDownRight size={13} className="text-rose-600" />}
                    <span className="font-semibold text-slate-700 dark:text-slate-200">
                      {change >= 0 ? 'Up' : 'Down'} {Math.abs(change)}%
                    </span>{' '}
                    vs {PREVIOUS_LABEL[data.period]} ({formatCurrency(data.previous.earnings)})
                  </>
                )}
              </p>

              <div className="mt-4 grid grid-cols-3 gap-2">
                <Stat label="Trips" value={String(data.current.trips)} sub={`${data.previous.trips} before`} />
                <Stat label="Avg / trip" value={formatCurrency(data.current.averagePerTrip)} />
                <Stat label="Distance" value={fmtKm(data.current.distanceKm)} sub={data.current.trips ? `${data.current.averageDistanceKm.toFixed(1)} km/trip` : undefined} />
                <Stat label="Active days" value={String(data.current.activeDays)} sub={data.current.activeDays ? `${formatCurrency(data.current.earnings / data.current.activeDays)}/day` : undefined} />
                <Stat label="COD collected" value={formatCurrency(data.current.codCollected)} />
                <Stat label="Busiest hour" value={busiestHour && busiestHour.trips > 0 ? hourLabel(busiestHour.hour) : '-'} sub={busiestHour && busiestHour.trips > 0 ? `${busiestHour.trips} trips` : undefined} />
              </div>
            </div>

            <div className="card mt-4 p-4">
              <p className="mb-2 text-sm font-semibold text-slate-800 dark:text-slate-100">Earnings · {TREND_TITLE[data.period]}</p>
              <BarChart
                key={`${data.period}-${data.currentFrom}-${data.currentTo}`}
                data={data.buckets.map((b) => ({ key: b.from, label: b.label, value: b.earnings, detail: `${b.trips} trip${b.trips === 1 ? '' : 's'}` }))}
                formatValue={formatCurrency}
                ariaLabel={`Earnings by ${data.bucketSize.toLowerCase()}`}
                highlightKey={data.period === 'CUSTOM' ? undefined : data.buckets[data.buckets.length - 1]?.from}
              />
              {data.bestBucket && (
                <p className="mt-3 flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
                  <Trophy size={13} className="text-amber-500" />
                  Best {data.bucketSize.toLowerCase()}: <span className="font-semibold text-slate-700 dark:text-slate-200">{data.bestBucket.label}</span> ·{' '}
                  {formatCurrency(data.bestBucket.earnings)} from {data.bestBucket.trips} trips
                </p>
              )}
            </div>

            {data.current.trips > 0 && (
              <div className="card mt-4 p-4">
                <p className="mb-2 text-sm font-semibold text-slate-800 dark:text-slate-100">When you earn · by hour</p>
                <BarChart key={`h-${data.currentFrom}-${data.currentTo}`} data={hourData} formatValue={formatCurrency} ariaLabel="Earnings by hour of day" maxLabels={6} />
              </div>
            )}

            {data.period !== 'DAY' && data.current.trips > 0 && (
              <div className="card mt-4 p-4">
                <p className="mb-2 text-sm font-semibold text-slate-800 dark:text-slate-100">By day of week</p>
                <BarChart
                  key={`w-${data.currentFrom}-${data.currentTo}`}
                  data={data.byWeekday.map((d) => ({ key: d.label, label: d.label, value: d.earnings, detail: `${d.trips} trip${d.trips === 1 ? '' : 's'}` }))}
                  formatValue={formatCurrency}
                  ariaLabel="Earnings by day of week"
                />
              </div>
            )}

            {totalTrips > 0 && (
              <div className="card mt-4 p-4">
                <p className="mb-3 text-sm font-semibold text-slate-800 dark:text-slate-100">Payment type</p>
                <div className="h-2 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800" role="meter" aria-valuenow={codShare} aria-valuemin={0} aria-valuemax={100} aria-label="Share of cash-on-delivery trips">
                  <div className="h-full rounded-full bg-brand-600 dark:bg-brand-500" style={{ width: `${codShare}%` }} />
                </div>
                <div className="mt-2 flex justify-between text-xs text-slate-500 dark:text-slate-400">
                  <span>
                    <span className="font-semibold text-slate-700 dark:text-slate-200">Cash (COD)</span> · {data.paymentSplit.codTrips} trips · {codShare}%
                  </span>
                  <span>
                    <span className="font-semibold text-slate-700 dark:text-slate-200">Online</span> · {data.paymentSplit.onlineTrips} trips
                  </span>
                </div>
                {data.paymentSplit.codCollected > 0 && (
                  <p className="mt-2 text-[11px] text-slate-400">{formatCurrency(data.paymentSplit.codCollected)} cash collected in this period.</p>
                )}
              </div>
            )}

            {data.topRestaurants.length > 0 && (
              <div className="card mt-4 p-4">
                <p className="mb-2 text-sm font-semibold text-slate-800 dark:text-slate-100">Top restaurants</p>
                <ul className="divide-y divide-slate-100 dark:divide-slate-800">
                  {data.topRestaurants.map((r) => (
                    <li key={r.restaurantId} className="flex items-center gap-3 py-2">
                      <Store size={15} className="shrink-0 text-slate-400" />
                      <span className="min-w-0 flex-1 truncate text-sm text-slate-700 dark:text-slate-200">{r.restaurantName}</span>
                      <span className="shrink-0 text-xs text-slate-400">{r.trips} trips</span>
                      <span className="w-20 shrink-0 text-right text-sm font-semibold text-slate-800 dark:text-slate-100">{formatCurrency(r.earnings)}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {data.current.trips === 0 && (
              <p className="mt-4 text-center text-sm text-slate-500 dark:text-slate-400">No deliveries in this period yet.</p>
            )}
          </div>
        )}

        {!data && !loading && (
          <div className="space-y-3">
            <Skeleton className="h-32" />
            <Skeleton className="h-40" />
          </div>
        )}
      </div>
    </div>
  )
}
