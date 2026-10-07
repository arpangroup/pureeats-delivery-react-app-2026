import { useRef, useState, type ChangeEvent, type FormEvent } from 'react'
import { BadgeCheck, Bike, Bolt, Camera, Landmark, Loader2 } from 'lucide-react'
import { Field, TextInput } from '@/components/ui/FormControls'
import { userService } from '@/services/userService'
import { classNames } from '@/lib/format'
import { showErrorToast } from '@/lib/errorToast'
import { compressImage } from '@/lib/imageCompress'
import type { IdProofType, PartnerApplication, PayoutMethod, RiderProfile, VehicleType } from '@/types/entities'

const VEHICLES: { value: VehicleType; label: string; icon: typeof Bike }[] = [
  { value: 'BIKE', label: 'Bike', icon: Bike },
  { value: 'CYCLE', label: 'Cycle', icon: Bike },
  { value: 'EV', label: 'EV', icon: Bolt },
]

function Segmented<T extends string>({ value, options, onChange }: { value: T; options: { value: T; label: string }[]; onChange: (v: T) => void }) {
  return (
    <div className="grid rounded-xl bg-slate-100 p-1 text-sm font-semibold dark:bg-slate-800" style={{ gridTemplateColumns: `repeat(${options.length}, 1fr)` }}>
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          onClick={() => onChange(o.value)}
          className={classNames('rounded-lg py-1.5', value === o.value ? 'bg-white text-slate-800 shadow-sm dark:bg-slate-900 dark:text-slate-100' : 'text-slate-500 dark:text-slate-400')}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}

/** Mobile number verified by OTP (the static test OTP is 123456 for now) - required before applying. */
function MobileVerification({ userId, phone, verified, onVerified }: { userId: number; phone: string; verified: boolean; onVerified: (phone: string) => void }) {
  const [value, setValue] = useState(phone)
  const [challengeId, setChallengeId] = useState<string | null>(null)
  const [otp, setOtp] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (verified) {
    return (
      <div className="flex items-center justify-between rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2.5 text-sm dark:border-emerald-500/30 dark:bg-emerald-500/10">
        <span className="font-semibold text-slate-800 dark:text-slate-100">{phone}</span>
        <span className="flex items-center gap-1 text-xs font-semibold text-emerald-700 dark:text-emerald-400">
          <BadgeCheck size={14} /> Verified
        </span>
      </div>
    )
  }

  async function send() {
    setBusy(true)
    setError(null)
    try {
      const res = await userService.requestPhoneChange(userId, value.trim())
      setChallengeId(res.challengeId)
    } catch (err) {
      setError((err as { message?: string })?.message ?? 'Could not send the OTP.')
    } finally {
      setBusy(false)
    }
  }

  async function verify() {
    if (!challengeId) return
    setBusy(true)
    setError(null)
    try {
      const updated = await userService.confirmPhoneChange(challengeId, otp)
      onVerified(updated.phone || value.trim())
    } catch (err) {
      setError((err as { message?: string })?.message ?? 'Invalid or expired OTP.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="space-y-2">
      <div className="flex gap-2">
        <TextInput type="tel" inputMode="numeric" placeholder="10-digit mobile number" value={value} onChange={(e) => setValue(e.target.value.replace(/[^\d+]/g, ''))} disabled={!!challengeId} />
        {!challengeId && (
          <button type="button" className="btn-secondary shrink-0" onClick={send} disabled={busy || value.replace(/\D/g, '').length < 10}>
            {busy ? <Loader2 size={16} className="animate-spin" /> : 'Send OTP'}
          </button>
        )}
      </div>
      {challengeId && (
        <div className="flex gap-2">
          <TextInput inputMode="numeric" placeholder="Enter OTP" value={otp} onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))} autoFocus />
          <button type="button" className="btn-primary shrink-0" onClick={verify} disabled={busy || otp.length < 4}>
            {busy ? <Loader2 size={16} className="animate-spin" /> : 'Verify'}
          </button>
        </div>
      )}
      {error && <p className="text-xs text-rose-500">{error}</p>}
    </div>
  )
}

/**
 * Become a delivery partner: name, OTP-verified mobile, driving licence (number + photo), Aadhaar or PAN,
 * vehicle type and number, and where to be paid (bank or UPI). Also used to correct and resubmit a
 * rejected application. The server validates everything again; the application then waits for approval.
 */
export function PartnerApplicationForm({
  userId,
  defaultName,
  phone,
  existing,
  submitLabel,
  onSubmit,
}: {
  userId: number
  defaultName: string
  phone: string
  existing?: RiderProfile | null
  submitLabel: string
  onSubmit: (application: PartnerApplication, licensePhoto: File | null) => Promise<void>
}) {
  const fileRef = useRef<HTMLInputElement>(null)
  const [verifiedPhone, setVerifiedPhone] = useState(phone)
  const [form, setForm] = useState<PartnerApplication>({
    name: existing?.name ?? defaultName,
    licenseNumber: existing?.licenseNumber ?? '',
    idProofType: existing?.idProofType ?? 'AADHAAR',
    idProofNumber: '',
    vehicleType: existing?.vehicleType ?? 'BIKE',
    vehicleNumber: existing?.vehicleNumber ?? '',
    payoutMethod: existing?.payoutMethod ?? 'UPI',
    bankAccountHolder: existing?.bankAccountHolder ?? '',
    bankAccountNumber: '',
    bankIfsc: existing?.bankIfsc ?? '',
    upiId: existing?.upiId ?? '',
  })
  const [licensePhoto, setLicensePhoto] = useState<File | null>(null)
  const [licensePreview, setLicensePreview] = useState<string | null>(existing?.licensePhotoUrl ?? null)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const set = <K extends keyof PartnerApplication>(key: K, value: PartnerApplication[K]) => setForm((f) => ({ ...f, [key]: value }))

  async function pickLicense(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    setError(null)
    try {
      // Camera photos are 5-15MB (or HEIC); shrink to a JPEG the server accepts before it's ever uploaded.
      const small = await compressImage(file)
      setLicensePhoto(small)
      setLicensePreview(URL.createObjectURL(small))
    } catch (err) {
      setError((err as { message?: string })?.message ?? "Couldn't use this photo.")
    }
  }

  // What's still missing - listed when Submit is tapped, instead of a button that silently does nothing.
  const missing = [
    !verifiedPhone && 'verify your mobile number',
    form.name.trim().length <= 1 && 'full name',
    form.licenseNumber.trim().length < 8 && 'driving licence number',
    !licensePhoto && !existing?.licensePhotoUrl && 'licence photo',
    form.idProofNumber.trim().length < 10 && (form.idProofType === 'AADHAAR' ? 'Aadhaar number' : 'PAN'),
    form.vehicleType !== 'CYCLE' && form.vehicleNumber.trim().length < 4 && 'vehicle number',
    form.payoutMethod === 'UPI'
      ? !form.upiId.includes('@') && 'UPI ID'
      : (!form.bankAccountHolder.trim() || form.bankAccountNumber.trim().length < 9 || form.bankIfsc.trim().length !== 11) && 'bank account details',
  ].filter(Boolean) as string[]

  async function submit(e: FormEvent) {
    e.preventDefault()
    if (missing.length > 0) {
      setError(`Please complete: ${missing.join(', ')}.`)
      return
    }
    setSubmitting(true)
    setError(null)
    try {
      await onSubmit(form, licensePhoto)
    } catch (err) {
      showErrorToast(err)
      const message = (err as { message?: string })?.message ?? 'Could not submit your application.'
      setError(message)
      // The number on the account was never OTP-verified - ask for verification instead of showing it as verified.
      if (/verify your mobile/i.test(message)) setVerifiedPhone('')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <form onSubmit={submit} className="space-y-5">
      <section className="space-y-3">
        <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-200">About you</h3>
        <Field label="Full name (as on your licence)" required>
          <TextInput value={form.name} onChange={(e) => set('name', e.target.value)} required />
        </Field>
        <Field label="Mobile number" required hint="We'll send an OTP to verify it.">
          <MobileVerification userId={userId} phone={verifiedPhone} verified={!!verifiedPhone} onVerified={setVerifiedPhone} />
        </Field>
      </section>

      <section className="space-y-3">
        <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-200">Driving licence</h3>
        <Field label="DL number" required>
          <TextInput value={form.licenseNumber} onChange={(e) => set('licenseNumber', e.target.value.toUpperCase())} placeholder="KA0520190001234" required />
        </Field>
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          className="flex w-full items-center gap-3 rounded-xl border border-dashed border-slate-300 p-3 text-left text-sm dark:border-slate-700"
        >
          {licensePreview ? (
            <img src={licensePreview} alt="Driving licence" className="h-14 w-20 shrink-0 rounded-lg object-cover" />
          ) : (
            <span className="flex h-14 w-20 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-400 dark:bg-slate-800">
              <Camera size={20} />
            </span>
          )}
          <span className="text-slate-600 dark:text-slate-300">{licensePreview ? 'Change licence photo' : 'Add a clear photo of your licence (front)'}</span>
        </button>
        <input ref={fileRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={pickLicense} />
      </section>

      <section className="space-y-3">
        <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-200">ID proof</h3>
        <Segmented<IdProofType> value={form.idProofType} options={[{ value: 'AADHAAR', label: 'Aadhaar' }, { value: 'PAN', label: 'PAN' }]} onChange={(v) => set('idProofType', v)} />
        <Field label={form.idProofType === 'AADHAAR' ? 'Aadhaar number' : 'PAN'} required hint={existing?.idProofNumberMasked ? `On file: ${existing.idProofNumberMasked} - enter it again to resubmit.` : undefined}>
          <TextInput
            value={form.idProofNumber}
            onChange={(e) => set('idProofNumber', form.idProofType === 'AADHAAR' ? e.target.value.replace(/[^\d ]/g, '') : e.target.value.toUpperCase())}
            inputMode={form.idProofType === 'AADHAAR' ? 'numeric' : 'text'}
            placeholder={form.idProofType === 'AADHAAR' ? '1234 5678 9012' : 'ABCDE1234F'}
            required
          />
        </Field>
      </section>

      <section className="space-y-3">
        <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-200">Vehicle</h3>
        <div className="grid grid-cols-3 gap-2">
          {VEHICLES.map(({ value, label, icon: Icon }) => (
            <button
              key={value}
              type="button"
              onClick={() => set('vehicleType', value)}
              className={classNames(
                'flex flex-col items-center gap-1 rounded-xl border py-3 text-sm font-semibold',
                form.vehicleType === value
                  ? 'border-brand-500 bg-brand-50 text-brand-700 dark:bg-brand-500/10 dark:text-brand-400'
                  : 'border-slate-200 text-slate-600 dark:border-slate-700 dark:text-slate-300',
              )}
            >
              <Icon size={20} /> {label}
            </button>
          ))}
        </div>
        {form.vehicleType !== 'CYCLE' && (
          <Field label="Vehicle number" required>
            <TextInput value={form.vehicleNumber} onChange={(e) => set('vehicleNumber', e.target.value.toUpperCase())} placeholder="KA-05-HH-1234" required />
          </Field>
        )}
      </section>

      <section className="space-y-3">
        <h3 className="flex items-center gap-1.5 text-sm font-semibold text-slate-700 dark:text-slate-200">
          <Landmark size={15} /> Where should we pay you?
        </h3>
        <Segmented<PayoutMethod> value={form.payoutMethod} options={[{ value: 'UPI', label: 'UPI' }, { value: 'BANK', label: 'Bank account' }]} onChange={(v) => set('payoutMethod', v)} />
        {form.payoutMethod === 'UPI' ? (
          <Field label="UPI ID" required>
            <TextInput value={form.upiId} onChange={(e) => set('upiId', e.target.value.trim())} placeholder="name@okhdfcbank" required />
          </Field>
        ) : (
          <>
            <Field label="Account holder name" required>
              <TextInput value={form.bankAccountHolder} onChange={(e) => set('bankAccountHolder', e.target.value)} required />
            </Field>
            <Field label="Account number" required hint={existing?.bankAccountNumberMasked ? `On file: ${existing.bankAccountNumberMasked}` : undefined}>
              <TextInput inputMode="numeric" value={form.bankAccountNumber} onChange={(e) => set('bankAccountNumber', e.target.value.replace(/\D/g, ''))} required />
            </Field>
            <Field label="IFSC" required>
              <TextInput value={form.bankIfsc} onChange={(e) => set('bankIfsc', e.target.value.toUpperCase().slice(0, 11))} placeholder="HDFC0001234" required />
            </Field>
          </>
        )}
      </section>

      {error && <p className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-600 dark:bg-rose-500/10 dark:text-rose-400">{error}</p>}

      <button type="submit" className="btn-primary flex w-full items-center justify-center gap-2" disabled={submitting}>
        {submitting ? <Loader2 size={16} className="animate-spin" /> : <BadgeCheck size={16} />}
        {submitting ? 'Submitting...' : submitLabel}
      </button>
      {!verifiedPhone && <p className="text-center text-xs text-slate-400">Verify your mobile number to continue.</p>}
    </form>
  )
}
