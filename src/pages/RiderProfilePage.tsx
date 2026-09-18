import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ChevronRight, LogOut, ShieldOff, Wallet, Star, Bike } from 'lucide-react'
import { PageHeader } from '@/components/layout/PageHeader'
import { useAuth } from '@/hooks/useAuth'
import { riderProfileService } from '@/services/riderProfileService'
import { initials } from '@/lib/format'
import { IS_MOCK } from '@/config/env'
import type { RiderProfile } from '@/types/entities'

const menuItems = [
  { to: '/profile/edit', label: 'Edit profile', icon: Bike },
  { to: '/profile/wallet', label: 'Wallet', icon: Wallet },
]

export default function RiderProfilePage() {
  const { user, logout, logoutAll } = useAuth()
  const navigate = useNavigate()
  const [profile, setProfile] = useState<RiderProfile | null>(null)

  useEffect(() => {
    if (!user) return
    let cancelled = false
    riderProfileService.getMyProfile(user.id).then((p) => {
      if (!cancelled) setProfile(p)
    })
    return () => {
      cancelled = true
    }
  }, [user?.id])

  async function handleLogout() {
    await logout()
    navigate('/login')
  }

  async function handleLogoutAll() {
    await logoutAll()
    navigate('/login')
  }

  return (
    <div>
      <PageHeader title="Profile" />
      <div className="px-4 py-4">
        <div className="card flex items-center gap-3 p-4">
          <span className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-full bg-brand-100 text-lg font-semibold text-brand-700 dark:bg-brand-500/15 dark:text-brand-400">
            {profile?.photo ? <img src={profile.photo} alt={user?.name} className="h-full w-full object-cover" /> : user ? initials(user.name) : '?'}
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-base font-semibold text-slate-800 dark:text-slate-100">{user?.name}</p>
            <p className="truncate text-sm text-slate-500 dark:text-slate-400">{user?.email}</p>
            {profile?.vehicleNumber && <p className="truncate text-xs text-slate-400 dark:text-slate-500">{profile.vehicleNumber}</p>}
          </div>
          {profile && (
            <span className="flex shrink-0 items-center gap-1 rounded-full bg-amber-100 px-2 py-1 text-xs font-semibold text-amber-700 dark:bg-amber-500/15 dark:text-amber-400">
              <Star size={12} /> {profile.rating.toFixed(1)}
            </span>
          )}
        </div>

        <div className="card mt-4 divide-y divide-slate-100 overflow-hidden dark:divide-slate-800">
          {menuItems.map(({ to, label, icon: Icon }) => (
            <Link key={to} to={to} className="flex items-center gap-3 px-4 py-3.5 hover:bg-slate-50 dark:hover:bg-slate-800/60">
              <Icon size={18} className="text-slate-500 dark:text-slate-400" />
              <span className="flex-1 text-sm font-medium text-slate-700 dark:text-slate-200">{label}</span>
              <ChevronRight size={16} className="text-slate-300" />
            </Link>
          ))}
        </div>

        <div className="card mt-4 divide-y divide-slate-100 overflow-hidden dark:divide-slate-800">
          <button onClick={handleLogout} className="flex w-full items-center gap-3 px-4 py-3.5 text-left hover:bg-rose-50 dark:hover:bg-rose-500/10">
            <LogOut size={18} className="text-rose-600 dark:text-rose-400" />
            <span className="text-sm font-medium text-rose-600 dark:text-rose-400">Sign out</span>
          </button>
          {!IS_MOCK && (
            <button onClick={handleLogoutAll} className="flex w-full items-center gap-3 px-4 py-3.5 text-left hover:bg-rose-50 dark:hover:bg-rose-500/10">
              <ShieldOff size={18} className="text-rose-600 dark:text-rose-400" />
              <span className="text-sm font-medium text-rose-600 dark:text-rose-400">Sign out of all devices</span>
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
