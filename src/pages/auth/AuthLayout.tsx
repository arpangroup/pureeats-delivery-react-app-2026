import { Outlet } from 'react-router-dom'
import { Bike } from 'lucide-react'

export default function AuthLayout() {
  return (
    <div className="flex min-h-[100dvh] flex-col bg-gradient-to-b from-brand-50 to-white dark:from-slate-950 dark:to-slate-950">
      <div className="flex flex-1 flex-col items-center justify-center px-5 py-10">
        <div className="mb-8 flex flex-col items-center gap-3">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-600 text-white shadow-card">
            <Bike size={26} />
          </div>
          <div className="text-center">
            <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-50">PureEats Rider</h1>
            <p className="text-sm text-slate-500 dark:text-slate-400">Deliver on your schedule.</p>
          </div>
        </div>
        <div className="w-full max-w-sm">
          <Outlet />
        </div>
      </div>
    </div>
  )
}
