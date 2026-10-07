import { useRef, useState, type ChangeEvent, type ReactNode } from 'react'
import { Lock, Loader2 } from 'lucide-react'
import { TextInput } from '@/components/ui/FormControls'
import { useDriverSettings } from '@/hooks/useDriverSettings'
import { riderProfileService, type DocumentChanges } from '@/services/riderProfileService'
import { compressImage } from '@/lib/imageCompress'
import type { IdProofType, PayoutMethod, RiderProfile, VehicleType } from '@/types/entities'

type Group = 'license' | 'idProof' | 'vehicleType' | 'payout'
const VEHICLE = { BIKE: 'Bike', CYCLE: 'Cycle', EV: 'EV' } as const

function Row({ label, value, editable, onEdit }: { label: string; value: ReactNode; editable: boolean; onEdit: () => void }) {
  return (
    <div className="flex items-center justify-between gap-3 py-3">
      <div className="min-w-0">
        <p className="text-xs font-medium text-slate-500 dark:text-slate-400">{label}</p>
        <div className="truncate text-sm font-medium text-slate-800 dark:text-slate-100">{value || '-'}</div>
      </div>
      {editable ? (
        <button type="button" className="shrink-0 text-xs font-semibold text-brand-600" onClick={onEdit}>
          Change
        </button>
      ) : (
        <span className="flex shrink-0 items-center gap-1 text-[11px] text-slate-400" title="Contact support to change it">
          <Lock size={12} /> View only
        </span>
      )}
    </div>
  )
}

/**
 * Driving licence, Aadhaar/PAN, vehicle type and payout details on the partner's Edit profile screen. Each is
 * view-only unless Settings -> Delivery Application -> Profile editing allows it (all off by default); the
 * server enforces the same rule. Admins can always change them from the partner's page.
 */
export function PartnerDocumentsCard({ profile, onChanged }: { profile: RiderProfile; onChanged: (p: RiderProfile) => void }) {
  const { profileEditable: can } = useDriverSettings()
  const fileRef = useRef<HTMLInputElement>(null)
  const [editing, setEditing] = useState<Group | null>(null)
  const [draft, setDraft] = useState<DocumentChanges>({})
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function start(group: Group) {
    setError(null)
    setEditing(group)
    setDraft(
      group === 'license'
        ? { licenseNumber: profile.licenseNumber ?? '' }
        : group === 'idProof'
          ? { idProofType: profile.idProofType ?? 'AADHAAR', idProofNumber: '' }
          : group === 'vehicleType'
            ? { vehicleType: profile.vehicleType ?? 'BIKE' }
            : { payoutMethod: profile.payoutMethod ?? 'UPI', upiId: profile.upiId ?? '', bankAccountHolder: profile.bankAccountHolder ?? '', bankAccountNumber: '', bankIfsc: profile.bankIfsc ?? '' },
    )
  }

  async function save() {
    setBusy(true)
    setError(null)
    try {
      onChanged(await riderProfileService.updateDocuments(profile, draft))
      setEditing(null)
    } catch (err) {
      setError((err as { message?: string })?.message ?? 'Could not save the change.')
    } finally {
      setBusy(false)
    }
  }

  async function pickLicensePhoto(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    setBusy(true)
    setError(null)
    try {
      onChanged(await riderProfileService.uploadLicensePhoto(await compressImage(file)))
    } catch (err) {
      setError((err as { message?: string })?.message ?? 'Could not upload the photo.')
    } finally {
      setBusy(false)
    }
  }

  const set = (patch: DocumentChanges) => setDraft((d) => ({ ...d, ...patch }))
  const editor = editing && (
    <div className="space-y-2 rounded-xl bg-slate-50 p-3 dark:bg-slate-800/60">
      {editing === 'license' && (
        <TextInput value={draft.licenseNumber ?? ''} onChange={(e) => set({ licenseNumber: e.target.value.toUpperCase() })} placeholder="KA0520190001234" />
      )}
      {editing === 'idProof' && (
        <>
          <select className="input" value={draft.idProofType} onChange={(e) => set({ idProofType: e.target.value as IdProofType })}>
            <option value="AADHAAR">Aadhaar</option>
            <option value="PAN">PAN</option>
          </select>
          <TextInput value={draft.idProofNumber ?? ''} onChange={(e) => set({ idProofNumber: e.target.value.toUpperCase() })} placeholder={draft.idProofType === 'PAN' ? 'ABCDE1234F' : '1234 5678 9012'} />
        </>
      )}
      {editing === 'vehicleType' && (
        <select className="input" value={draft.vehicleType} onChange={(e) => set({ vehicleType: e.target.value as VehicleType })}>
          <option value="BIKE">Bike</option>
          <option value="CYCLE">Cycle</option>
          <option value="EV">EV</option>
        </select>
      )}
      {editing === 'payout' && (
        <>
          <select className="input" value={draft.payoutMethod} onChange={(e) => set({ payoutMethod: e.target.value as PayoutMethod })}>
            <option value="UPI">UPI</option>
            <option value="BANK">Bank account</option>
          </select>
          {draft.payoutMethod === 'UPI' ? (
            <TextInput value={draft.upiId ?? ''} onChange={(e) => set({ upiId: e.target.value.trim() })} placeholder="name@okhdfcbank" />
          ) : (
            <>
              <TextInput value={draft.bankAccountHolder ?? ''} onChange={(e) => set({ bankAccountHolder: e.target.value })} placeholder="Account holder name" />
              <TextInput inputMode="numeric" value={draft.bankAccountNumber ?? ''} onChange={(e) => set({ bankAccountNumber: e.target.value.replace(/\D/g, '') })} placeholder="Account number" />
              <TextInput value={draft.bankIfsc ?? ''} onChange={(e) => set({ bankIfsc: e.target.value.toUpperCase().slice(0, 11) })} placeholder="IFSC" />
            </>
          )}
        </>
      )}
      <div className="flex gap-2">
        <button type="button" className="btn-primary flex-1" onClick={save} disabled={busy}>
          {busy ? 'Saving...' : 'Save'}
        </button>
        <button type="button" className="btn-secondary" onClick={() => setEditing(null)} disabled={busy}>
          Cancel
        </button>
      </div>
    </div>
  )

  return (
    <div className="card mt-4 px-4">
      <p className="pt-3 text-xs font-semibold uppercase tracking-wide text-slate-400">Documents & payout</p>
      <div className="divide-y divide-slate-100 dark:divide-slate-800">
        <Row label="Driving licence" value={profile.licenseNumber} editable={can.license} onEdit={() => start('license')} />
        {editing === 'license' && editor}
        <div className="flex items-center justify-between gap-3 py-3">
          <div className="flex min-w-0 items-center gap-3">
            {profile.licensePhotoUrl ? (
              <img src={profile.licensePhotoUrl} alt="Driving licence" className="h-10 w-14 rounded object-cover" />
            ) : (
              <span className="text-sm text-slate-400">No licence photo</span>
            )}
            <span className="text-xs font-medium text-slate-500 dark:text-slate-400">Licence photo</span>
          </div>
          {can.license ? (
            <button type="button" className="shrink-0 text-xs font-semibold text-brand-600" onClick={() => fileRef.current?.click()} disabled={busy}>
              {busy && !editing ? <Loader2 size={14} className="animate-spin" /> : 'Replace'}
            </button>
          ) : (
            <span className="flex shrink-0 items-center gap-1 text-[11px] text-slate-400">
              <Lock size={12} /> View only
            </span>
          )}
          <input ref={fileRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={pickLicensePhoto} />
        </div>
        <Row label={profile.idProofType === 'PAN' ? 'PAN' : 'Aadhaar'} value={profile.idProofNumberMasked} editable={can.idProof} onEdit={() => start('idProof')} />
        {editing === 'idProof' && editor}
        <Row label="Vehicle type" value={profile.vehicleType ? VEHICLE[profile.vehicleType] : null} editable={can.vehicleType} onEdit={() => start('vehicleType')} />
        {editing === 'vehicleType' && editor}
        <Row
          label="Payout"
          value={profile.payoutMethod === 'BANK' ? `Bank ${profile.bankAccountNumberMasked ?? ''}` : profile.upiId}
          editable={can.payout}
          onEdit={() => start('payout')}
        />
        {editing === 'payout' && editor}
      </div>
      {error && <p className="pb-3 text-xs text-rose-500">{error}</p>}
    </div>
  )
}
