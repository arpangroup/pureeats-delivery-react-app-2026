import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { CheckCircle2 } from 'lucide-react'
import { LoadingBlock } from '@/components/ui/Feedback'
import type { RiderProfile } from '@/types/entities'
import { useAuth } from '@/hooks/useAuth'
import { riderProfileService } from '@/services/riderProfileService'
import { PartnerApplicationForm } from '@/components/onboarding/PartnerApplicationForm'

/**
 * Shown when authenticated but the JWT role isn't yet DELIVERY (see RequireAuth): the delivery partner
 * application - verified mobile, driving licence, ID proof, vehicle and payout details. Submitting creates
 * the partner as PENDING (it appears under Admin -> Delivery partners -> Approvals). The DELIVERY role only
 * appears in a FRESH token, so the partner signs in again; until an admin approves them the app shows
 * their application status instead of orders (see ApplicationStatusPage).
 */
export default function RiderOnboardingPage() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const [done, setDone] = useState(false)
  /**
   * An application saved by an earlier attempt (e.g. its photo upload failed): continue it - prefilled, with
   * the mobile number already verified - instead of starting over (which used to fail with "already exists").
   */
  const [existing, setExisting] = useState<RiderProfile | null | undefined>(undefined)

  useEffect(() => {
    if (!user) return
    riderProfileService
      .getMyProfile(user.id)
      .then((p) => setExisting(p))
      .catch(() => setExisting(null))
  }, [user])

  if (!user) {
    navigate('/login', { replace: true })
    return null
  }

  async function handleReturnToLogin() {
    await logout()
    navigate('/login', { replace: true })
  }

  if (done) {
    return (
      <div className="flex min-h-[100dvh] flex-col items-center justify-center gap-4 bg-gradient-to-b from-brand-50 to-white px-6 text-center dark:from-slate-950 dark:to-slate-950">
        <span className="flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100 text-emerald-600 dark:bg-emerald-500/15">
          <CheckCircle2 size={32} />
        </span>
        <h2 className="text-lg font-semibold text-slate-800 dark:text-slate-100">Application submitted</h2>
        <p className="max-w-xs text-sm text-slate-500 dark:text-slate-400">
          Our team will verify your details - usually within a day. Sign in again to check your status; you can start taking orders once you're approved.
        </p>
        <button className="btn-primary w-full max-w-xs" onClick={handleReturnToLogin}>
          Back to sign in
        </button>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-md px-5 py-8 pb-safe">
      <h1 className="text-xl font-bold text-slate-800 dark:text-slate-100">Become a delivery partner</h1>
      <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">We need a few details to verify you. Your ID and bank details are only seen by the PureEats team.</p>
      {existing === undefined ? (
        <LoadingBlock />
      ) : (
        <div className="card mt-6 p-4">
          {existing && <p className="mb-4 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:bg-amber-500/10 dark:text-amber-300">We saved your details earlier - finish and submit again.</p>}
          <PartnerApplicationForm
            userId={user.id}
            defaultName={existing?.name ?? user.name}
            phone={existing?.phone || user.phone || ''}
            existing={existing}
            submitLabel="Submit application"
            onSubmit={async (application, licensePhoto) => {
              await riderProfileService.submitApplication(user.id, application, licensePhoto, !!existing)
              setDone(true)
            }}
          />
        </div>
      )}
    </div>
  )
}
