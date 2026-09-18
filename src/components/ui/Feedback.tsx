import { Loader2, Inbox } from 'lucide-react'
import type { ReactNode } from 'react'
import { classNames } from '@/lib/format'

export function Spinner({ className }: { className?: string }) {
  return <Loader2 className={classNames('animate-spin text-brand-600', className)} size={20} />
}

export function LoadingBlock({ label = 'Loading...' }: { label?: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 py-16 text-sm text-slate-500 dark:text-slate-400">
      <Spinner />
      <span>{label}</span>
    </div>
  )
}

export function EmptyState({
  title = 'Nothing here yet',
  description,
  icon,
  action,
}: {
  title?: string
  description?: string
  icon?: ReactNode
  action?: ReactNode
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 px-6 py-16 text-center">
      <div className="mb-1 flex h-14 w-14 items-center justify-center rounded-full bg-slate-100 text-slate-400 dark:bg-slate-800 dark:text-slate-500">
        {icon ?? <Inbox size={24} />}
      </div>
      <p className="text-base font-semibold text-slate-700 dark:text-slate-200">{title}</p>
      {description && <p className="max-w-sm text-sm text-slate-500 dark:text-slate-400">{description}</p>}
      {action}
    </div>
  )
}

type BadgeTone = 'slate' | 'green' | 'red' | 'amber' | 'blue' | 'brand'

const badgeTones: Record<BadgeTone, string> = {
  slate: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300',
  green: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-400',
  red: 'bg-rose-100 text-rose-700 dark:bg-rose-500/15 dark:text-rose-400',
  amber: 'bg-amber-100 text-amber-800 dark:bg-amber-500/15 dark:text-amber-400',
  blue: 'bg-sky-100 text-sky-700 dark:bg-sky-500/15 dark:text-sky-400',
  brand: 'bg-brand-100 text-brand-700 dark:bg-brand-500/15 dark:text-brand-400',
}

export function Badge({ tone = 'slate', children, className }: { tone?: BadgeTone; children: ReactNode; className?: string }) {
  return (
    <span className={classNames('inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold', badgeTones[tone], className)}>
      {children}
    </span>
  )
}

/** A pulsing gray block, sized via className - used to build skeleton screens for cards/lists while data loads. */
export function Skeleton({ className }: { className?: string }) {
  return <div className={classNames('animate-pulse rounded-lg bg-slate-200 dark:bg-slate-800', className)} />
}
