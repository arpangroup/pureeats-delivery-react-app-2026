import { useNavigate } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import type { ReactNode } from 'react'

/** Per-screen title: a sticky bar with a back button - mobile-only, no desktop chrome to defer to. */
export function PageHeader({ title, onBack, actions }: { title: string; onBack?: () => void; actions?: ReactNode }) {
  const navigate = useNavigate()
  return (
    <div className="sticky top-0 z-20 flex items-center gap-3 border-b border-slate-200 bg-white/95 px-4 py-3 pt-safe backdrop-blur dark:border-slate-800 dark:bg-slate-900/95">
      <button
        onClick={() => (onBack ? onBack() : navigate(-1))}
        className="rounded-full p-1.5 text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
        aria-label="Back"
      >
        <ArrowLeft size={20} />
      </button>
      <h1 className="flex-1 truncate text-base font-semibold text-slate-800 dark:text-slate-100">{title}</h1>
      {actions}
    </div>
  )
}
