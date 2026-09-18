import type { ReactNode } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '@/hooks/useAuth'
import { LoadingBlock } from '@/components/ui/Feedback'

/**
 * Route guard for everything behind AppShell. Unlike the customer app's RequireAuth (which wraps
 * otherwise-public pages and shows an inline "sign in" prompt, since browsing never requires
 * login there), this whole app requires an active rider account - there's no guest/browsing mode -
 * so this redirects instead of rendering inline: unauthenticated -> /login (remembering where to
 * return), authenticated but not yet role DELIVERY -> /onboarding (see RiderOnboardingPage).
 */
export function RequireAuth({ children }: { children: ReactNode }) {
  const { isAuthenticated, isRider, isLoading } = useAuth()
  const location = useLocation()

  if (isLoading) return <LoadingBlock label="Checking your session..." />
  if (!isAuthenticated) return <Navigate to="/login" replace state={{ from: location.pathname }} />
  if (!isRider) return <Navigate to="/onboarding" replace />
  return <>{children}</>
}
