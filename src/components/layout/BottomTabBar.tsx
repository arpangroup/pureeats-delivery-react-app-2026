import { NavLink } from 'react-router-dom'
import { Home, ListChecks, Bike, Wallet, User } from 'lucide-react'
import { classNames } from '@/lib/format'

const tabs = [
  { to: '/', label: 'Home', icon: Home, end: true },
  { to: '/orders/available', label: 'Available', icon: ListChecks, end: false },
  { to: '/deliveries/active', label: 'Deliveries', icon: Bike, end: false },
  { to: '/profile/wallet', label: 'Wallet', icon: Wallet, end: false },
  { to: '/profile', label: 'Profile', icon: User, end: false },
] as const

export function BottomTabBar() {
  return (
    <nav className="fixed inset-x-0 bottom-0 z-30 mx-auto flex max-w-md border-t border-slate-200 bg-white pb-safe pt-1.5 dark:border-slate-800 dark:bg-slate-900">
      {tabs.map(({ to, label, icon: Icon, end }) => (
        <NavLink
          key={to}
          to={to}
          end={end}
          className={({ isActive }) =>
            classNames(
              'relative flex flex-1 flex-col items-center gap-0.5 rounded-lg py-1.5 text-[11px] font-medium transition-colors',
              isActive ? 'text-brand-600' : 'text-slate-400 dark:text-slate-500',
            )
          }
        >
          <Icon size={22} strokeWidth={2.25} />
          {label}
        </NavLink>
      ))}
    </nav>
  )
}
