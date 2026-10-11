import { useRef, useState, type ChangeEvent, type ReactNode } from 'react'
import { FileText, Lock, Loader2 } from 'lucide-react'
import { TextInput } from '@/components/ui/FormControls'
import { useDriverSettings } from '@/hooks/useDriverSettings'
import { DOC_LABELS, riderProfileService, type DocumentChanges } from '@/services/riderProfileService'
import { requiredDocuments } from '@/lib/riderDocuments'
import { showErrorToast } from '@/lib/errorToast'
import { compressImage } from '@/lib/imageCompress'
import type { DocType, PayoutMethod, RiderProfile, VehicleType } from '@/types/entities'

type Group = 'license' | 'idProof' | 'vehicleType' | 'payout'
const VEHICLE = { BIKE: 'Bike', CYCLE: 'Cycle', EV: 'EV' } as const

/** One uploaded document (photo or PDF) - viewable, and replaceable when that group may be changed from the app. */
function DocumentRow({ profile, type, editable, onChanged }: { profile: RiderProfile; type: DocType; editable: boolean; onChanged: (p: RiderProfile) => void }) {
  const ref = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState(false)
  const doc = profile.documents?.find((d) => d.type === type)

  async function pick(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    setBusy(true)
    try {
      const upload = file.type === 'application/pdf' ? file : await compressImage(file)
      onChanged(await riderProfileService.uploadDocument(profile, type, upload))
    } catch (err) {
      showErrorToast(err, `Could not upload your ${DOC_LABELS[type]}.`)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex items-center justify-between gap-3 py-3">
      <a href={doc?.url} target="_blank" rel="noopener noreferrer" className="flex min-w-0 items-center gap-3">
        {!doc ? (
          <span className="flex h-10 w-14 items-center justify-center rounded bg-rose-50 text-[10px] font-semibold text-rose-500 dark:bg-rose-500/10">Missing</span>
        ) : doc.contentType === 'application/pdf' ? (
          <span className="flex h-10 w-14 items-center justify-center rounded bg-slate-100 text-brand-600 dark:bg-slate-800">
            <FileText size={18} />
          </span>
        ) : (
          <img src={doc.url} alt={DOC_LABELS[type]} className="h-10 w-14 rounded object-cover" />
        )}
        <span className="truncate text-xs font-medium text-slate-500 dark:text-slate-400">{DOC_LABELS[type]}</span>
      </a>
      {editable ? (
        <button type="button" className="shrink-0 text-xs font-semibold text-brand-600" onClick={() => ref.current?.click()} disabled={busy}>
          {busy ? <Loader2 size={14} className="animate-spin" /> : doc ? 'Replace' : 'Upload'}
        </button>
      ) : (
        <span className="flex shrink-0 items-center gap-1 text-[11px] text-slate-400">
          <Lock size={12} /> View only
        </span>
      )}
      <input ref={ref} type="file" accept="image/png,image/jpeg,image/webp,application/pdf" className="hidden" onChange={pick} />
    </div>
  )
}

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
          ? { aadhaarNumber: '', panNumber: '' }
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

  const set = (patch: DocumentChanges) => setDraft((d) => ({ ...d, ...patch }))
  const editor = editing && (
    <div className="space-y-2 rounded-xl bg-slate-50 p-3 dark:bg-slate-800/60">
      {editing === 'license' && (
        <TextInput value={draft.licenseNumber ?? ''} onChange={(e) => set({ licenseNumber: e.target.value.toUpperCase() })} placeholder="KA0520190001234" />
      )}
      {editing === 'idProof' && (
        <>
          <TextInput value={draft.aadhaarNumber ?? ''} onChange={(e) => set({ aadhaarNumber: e.target.value.replace(/[^\d ]/g, '') })} inputMode="numeric" placeholder="Aadhaar - 1234 5678 9012" />
          <TextInput value={draft.panNumber ?? ''} onChange={(e) => set({ panNumber: e.target.value.toUpperCase() })} placeholder="PAN - ABCDE1234F" maxLength={10} />
          <p className="text-[11px] text-slate-400">Fill in the one you want to change - the other stays as it is.</p>
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
        <Row label="Aadhaar" value={profile.aadhaarNumberMasked ?? 'Not added'} editable={can.idProof} onEdit={() => start('idProof')} />
        <Row label="PAN" value={profile.panNumberMasked ?? 'Not added'} editable={can.idProof} onEdit={() => start('idProof')} />
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
      <p className="pt-2 text-xs font-semibold uppercase tracking-wide text-slate-400">Uploaded documents</p>
      <div className="divide-y divide-slate-100 dark:divide-slate-800">
        {requiredDocuments(profile.vehicleType ?? 'BIKE', profile.payoutMethod ?? 'UPI').map((type) => (
          <DocumentRow
            key={type}
            profile={profile}
            type={type}
            editable={type === 'LICENSE' ? can.license : type === 'RC' ? can.vehicleNumber : type === 'PASSBOOK' ? can.payout : can.idProof}
            onChanged={onChanged}
          />
        ))}
      </div>
      {error && <p className="pb-3 text-xs text-rose-500">{error}</p>}
    </div>
  )
}
