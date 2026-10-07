import { useCallback, useEffect, useState, type ReactNode } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '@/hooks/useAuth'
import { LoadingBlock } from '@/components/ui/Feedback'
import { riderProfileService } from '@/services/riderProfileService'
import { ApplicationStatusPage } from '@/pages/ApplicationStatusPage'
import type { RiderProfile } from '@/types/entities'

const APPROVAL_RECHECK_MS = 60_000

/**
 * Route guard for everything behind AppShell. Unlike the customer app's RequireAuth (which wraps
 * otherwise-public pages and shows an inline "sign in" prompt, since browsing never requires
 * login there), this whole app requires an active rider account - there's no guest/browsing mode -
 * so this redirects instead of rendering inline: unauthenticated -> /login (remembering where to
 * return), authenticated but not yet role DELIVERY -> /onboarding (see RiderOnboardingPage), and a
 * partner whose application isn't approved yet -> their application status instead of the app.
 */
export function RequireAuth({ children }: { children: ReactNode }) {
  const { isAuthenticated, isRider, isLoading, user } = useAuth()
  const location = useLocation()
  const [profile, setProfile] = useState<RiderProfile | null | undefined>(undefined)

  const load = useCallback(async () => {
    if (!user) return
    try {
      setProfile(await riderProfileService.getMyProfile(user.id))
    } catch {
      // network blip - keep the last known state (and don't lock an approved partner out)
      setProfile((p) => (p === undefined ? null : p))
    }
  }, [user])

  useEffect(() => {
    if (!isAuthenticated || !isRider) return
    load()
  }, [isAuthenticated, isRider, load])

  const awaitingApproval = !!profile && !!profile.approvalStatus && profile.approvalStatus !== 'APPROVED'
  // While waiting, re-check so the app unlocks on its own once an admin approves.
  useEffect(() => {
    if (!awaitingApproval) return
    const id = setInterval(load, APPROVAL_RECHECK_MS)
    const onVisible = () => document.visibilityState === 'visible' && load()
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      clearInterval(id)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [awaitingApproval, load])

  if (isLoading) return <LoadingBlock label="Checking your session..." />
  if (!isAuthenticated) return <Navigate to="/login" replace state={{ from: location.pathname }} />
  if (!isRider) return <Navigate to="/onboarding" replace />
  if (profile === undefined) return <LoadingBlock label="Loading your account..." />
  if (awaitingApproval) return <ApplicationStatusPage profile={profile!} onChanged={setProfile} onRefresh={load} />
  return <>{children}</>
}
