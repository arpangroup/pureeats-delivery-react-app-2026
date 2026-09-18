import { Outlet } from 'react-router-dom'
import { BottomTabBar } from './BottomTabBar'

/**
 * The one layout component behind every authenticated route. Mobile-only, per the spec - there is
 * no `md:` desktop branch anywhere in this app; the bottom-tab chrome is the only chrome.
 */
export function AppShell() {
  return (
    <div className="min-h-[100dvh] bg-slate-50 dark:bg-slate-950">
      <main className="mx-auto max-w-md pb-24">
        <Outlet />
      </main>
      <BottomTabBar />
    </div>
  )
}
