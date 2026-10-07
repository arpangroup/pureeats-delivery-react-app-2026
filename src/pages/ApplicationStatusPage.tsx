import { useState } from 'react'
import { Clock, LogOut, RefreshCw, XCircle } from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'
import { riderProfileService } from '@/services/riderProfileService'
import { PartnerApplicationForm } from '@/components/onboarding/PartnerApplicationForm'
import type { RiderProfile } from '@/types/entities'

const VEHICLE_LABEL = { BIKE: 'Bike', CYCLE: 'Cycle', EV: 'EV' } as const

function Row({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div className="flex justify-between gap-3 py-1.5 text-sm">
      <span className="text-slate-500 dark:text-slate-400">{label}</span>
      <span className="text-right font-medium text-slate-800 dark:text-slate-100">{value || '-'}</span>
    </div>
  )
}

/**
 * What a delivery partner sees until an admin approves them: "under review" with what they submitted, or
 * the rejection reason with a form to fix and resubmit. No orders, no going online - the server enforces
 * that too. Approval is re-checked periodically, so the app unlocks on its own once approved.
 */
export function ApplicationStatusPage({ profile, onChanged, onRefresh }: { profile: RiderProfile; onChanged: (p: RiderProfile) => void; onRefresh: () => void }) {
  const { user, logout } = useAuth()
  const [editing, setEditing] = useState(false)
  const rejected = profile.approvalStatus === 'REJECTED'

  if (editing && user) {
    return (
      <div className="mx-auto max-w-md px-5 py-8 pb-safe">
        <h1 className="text-xl font-bold text-slate-800 dark:text-slate-100">Update your application</h1>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Fix what was flagged and resubmit - we'll review it again.</p>
        <div className="card mt-6 p-4">
          <PartnerApplicationForm
            userId={user.id}
            defaultName={profile.name}
            phone={profile.phone || user.phone || ''}
            existing={profile}
            submitLabel="Resubmit application"
            onSubmit={async (application, licensePhoto, profilePhoto) => {
              onChanged(await riderProfileService.submitApplication(user.id, application, licensePhoto, true, profilePhoto))
              setEditing(false)
            }}
          />
        </div>
        <button className="mt-3 w-full py-2 text-sm font-medium text-slate-500" onClick={() => setEditing(false)}>
          Cancel
        </button>
      </div>
    )
  }

  return (
    <div className="mx-auto flex min-h-[100dvh] max-w-md flex-col px-5 py-10 pb-safe">
      <div className="flex flex-col items-center text-center">
        <span
          className={`flex h-16 w-16 items-center justify-center rounded-full ${
            rejected ? 'bg-rose-100 text-rose-600 dark:bg-rose-500/15' : 'bg-amber-100 text-amber-600 dark:bg-amber-500/15'
          }`}
        >
          {rejected ? <XCircle size={32} /> : <Clock size={32} />}
        </span>
        <h1 className="mt-4 text-lg font-bold text-slate-800 dark:text-slate-100">{rejected ? 'Application not approved' : 'Application under review'}</h1>
        <p className="mt-1 max-w-xs text-sm text-slate-500 dark:text-slate-400">
          {rejected
            ? 'Please fix the details below and resubmit.'
            : "We're verifying your details - usually within a day. You'll get a notification, and this screen unlocks the app once you're approved."}
        </p>
      </div>

      {rejected && profile.rejectionReason && (
        <p className="mt-5 rounded-xl bg-rose-50 px-4 py-3 text-sm text-rose-700 dark:bg-rose-500/10 dark:text-rose-300">
          <span className="font-semibold">Reason:</span> {profile.rejectionReason}
        </p>
      )}

      <div className="card mt-5 divide-y divide-slate-100 px-4 py-2 dark:divide-slate-800">
        <Row label="Name" value={profile.name} />
        <Row label="Mobile" value={profile.phone} />
        <Row label="Driving licence" value={profile.licenseNumber} />
        <Row label={profile.idProofType === 'PAN' ? 'PAN' : 'Aadhaar'} value={profile.idProofNumberMasked} />
        <Row label="Vehicle" value={[profile.vehicleType ? VEHICLE_LABEL[profile.vehicleType] : null, profile.vehicleNumber].filter(Boolean).join(' · ')} />
        <Row label="Payout" value={profile.payoutMethod === 'BANK' ? `Bank ${profile.bankAccountNumberMasked ?? ''}` : profile.upiId} />
      </div>
      {profile.licensePhotoUrl && <img src={profile.licensePhotoUrl} alt="Driving licence" className="mt-3 max-h-40 w-full rounded-xl object-cover" />}

      <div className="mt-auto space-y-2 pt-8">
        {rejected ? (
          <button className="btn-primary w-full" onClick={() => setEditing(true)}>
            Update & resubmit
          </button>
        ) : (
          <button className="btn-secondary flex w-full items-center justify-center gap-2" onClick={onRefresh}>
            <RefreshCw size={16} /> Check status
          </button>
        )}
        <button className="flex w-full items-center justify-center gap-2 py-2 text-sm font-medium text-slate-500" onClick={() => logout()}>
          <LogOut size={15} /> Sign out
        </button>
      </div>
    </div>
  )
}
