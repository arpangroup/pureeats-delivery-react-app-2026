import { useRef, useState, type ChangeEvent, type FormEvent } from 'react'
import { BadgeCheck, Bike, Bolt, Camera, Landmark, Loader2 } from 'lucide-react'
import { Field, TextInput } from '@/components/ui/FormControls'
import { userService } from '@/services/userService'
import { classNames } from '@/lib/format'
import { showErrorToast } from '@/lib/errorToast'
import { compressImage } from '@/lib/imageCompress'
import type { IdProofType, PartnerApplication, PayoutMethod, RiderProfile, VehicleType } from '@/types/entities'

/** Same rules the server applies (RiderKyc) - so every problem is shown here, next to its field. */
const LICENSE_RE = /^[A-Z]{2}\d{2}[A-Z0-9]{8,14}$/
const AADHAAR_RE = /^\d{12}$/
const PAN_RE = /^[A-Z]{5}\d{4}[A-Z]$/
const IFSC_RE = /^[A-Z]{4}0[A-Z0-9]{6}$/
const ACCOUNT_RE = /^\d{9,18}$/
const UPI_RE = /^[A-Za-z0-9._-]{2,256}@[A-Za-z]{2,64}$/
const compact = (v: string) => v.replace(/[\s-]/g, '').toUpperCase()

type FieldKey = 'phone' | 'name' | 'licenseNumber' | 'licensePhoto' | 'idProofNumber' | 'vehicleNumber' | 'upiId' | 'bankAccountHolder' | 'bankAccountNumber' | 'bankIfsc'

/** Field -> what's wrong with it (only invalid fields are present). */
function validate(form: PartnerApplication, hasPhone: boolean, hasLicensePhoto: boolean): Partial<Record<FieldKey, string>> {
  const e: Partial<Record<FieldKey, string>> = {}
  if (!hasPhone) e.phone = 'Verify your mobile number with the OTP.'
  if (form.name.trim().length < 2) e.name = 'Enter your full name as printed on your licence.'
  const dl = compact(form.licenseNumber)
  if (!dl) e.licenseNumber = 'Enter your driving licence number.'
  else if (!LICENSE_RE.test(dl)) e.licenseNumber = `Not a valid DL number - it starts with the state code and RTO number, e.g. KA0520190001234 (${dl.length} characters entered).`
  if (!hasLicensePhoto) e.licensePhoto = 'Add a clear photo of the front of your licence.'
  const id = compact(form.idProofNumber)
  if (form.idProofType === 'AADHAAR') {
    if (!id) e.idProofNumber = 'Enter your 12-digit Aadhaar number.'
    else if (!AADHAAR_RE.test(id)) e.idProofNumber = `Aadhaar number must be exactly 12 digits (you entered ${id.length}).`
  } else if (!id) e.idProofNumber = 'Enter your PAN.'
  else if (!PAN_RE.test(id)) e.idProofNumber = 'PAN is 10 characters: 5 letters, 4 digits, 1 letter - e.g. ABCDE1234F.'
  if (form.vehicleType !== 'CYCLE' && form.vehicleNumber.trim().length < 4) e.vehicleNumber = 'Enter your vehicle registration number, e.g. KA-05-HH-1234.'
  if (form.payoutMethod === 'UPI') {
    if (!form.upiId.trim()) e.upiId = 'Enter your UPI ID.'
    else if (!UPI_RE.test(form.upiId.trim())) e.upiId = 'Not a valid UPI ID - it looks like name@bank, e.g. ravi@okhdfcbank.'
  } else {
    if (!form.bankAccountHolder.trim()) e.bankAccountHolder = "Enter the account holder's name as on the bank account."
    const account = form.bankAccountNumber.trim()
    if (!account) e.bankAccountNumber = 'Enter your bank account number.'
    else if (!ACCOUNT_RE.test(account)) e.bankAccountNumber = `Account number must be 9 to 18 digits (you entered ${account.length}).`
    const ifsc = form.bankIfsc.trim()
    if (!ifsc) e.bankIfsc = 'Enter your branch IFSC.'
    else if (!IFSC_RE.test(ifsc))
      e.bankIfsc =
        ifsc.length !== 11
          ? `IFSC must be 11 characters, e.g. SBIN0001234 (you entered ${ifsc.length}).`
          : 'Not a valid IFSC - 4 letters, then 0, then 6 letters/digits, e.g. SBIN0001234.'
  }
  return e
}

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
  onSubmit: (application: PartnerApplication, licensePhoto: File | null, profilePhoto: File | null) => Promise<void>
}) {
  const fileRef = useRef<HTMLInputElement>(null)
  const photoRef = useRef<HTMLInputElement>(null)
  const [profilePhoto, setProfilePhoto] = useState<File | null>(null)
  const [profilePreview, setProfilePreview] = useState<string | null>(existing?.photo ?? null)
  /** After the first Submit every invalid field shows its error; before that, only fields already typed in. */
  const [attempted, setAttempted] = useState(false)
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

  async function pickProfilePhoto(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    try {
      const small = await compressImage(file)
      setProfilePhoto(small)
      setProfilePreview(URL.createObjectURL(small))
    } catch (err) {
      setError((err as { message?: string })?.message ?? "Couldn't use this photo.")
    }
  }

  const errors = validate(form, !!verifiedPhone, !!licensePhoto || !!existing?.licensePhotoUrl)
  const typed: Record<FieldKey, boolean> = {
    phone: false,
    name: form.name.length > 0,
    licenseNumber: form.licenseNumber.length > 0,
    licensePhoto: false,
    idProofNumber: form.idProofNumber.length > 0,
    vehicleNumber: form.vehicleNumber.length > 0,
    upiId: form.upiId.length > 0,
    bankAccountHolder: form.bankAccountHolder.length > 0,
    bankAccountNumber: form.bankAccountNumber.length > 0,
    bankIfsc: form.bankIfsc.length > 0,
  }
  /** The error to show under a field: as soon as something invalid is typed, or for every field once Submit was pressed. */
  const errorFor = (key: FieldKey) => (attempted || typed[key] ? errors[key] : undefined)
  const errorCount = Object.keys(errors).length

  async function submit(e: FormEvent) {
    e.preventDefault()
    setAttempted(true)
    if (errorCount > 0) {
      setError(`Please fix the ${errorCount === 1 ? 'highlighted field' : `${errorCount} highlighted fields`} above.`)
      return
    }
    setSubmitting(true)
    setError(null)
    try {
      await onSubmit(form, licensePhoto, profilePhoto)
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
    <form onSubmit={submit} noValidate className="space-y-5">
      <div className="flex flex-col items-center gap-1">
        <button type="button" onClick={() => photoRef.current?.click()} className="relative" aria-label="Add your photo">
          <span className="flex h-20 w-20 items-center justify-center overflow-hidden rounded-full bg-brand-100 text-brand-600 dark:bg-brand-500/15">
            {profilePreview ? <img src={profilePreview} alt="Your photo" className="h-full w-full object-cover" /> : <Camera size={24} />}
          </span>
          <span className="absolute -bottom-1 -right-1 flex h-7 w-7 items-center justify-center rounded-full bg-brand-600 text-white shadow-sm">
            <Camera size={13} />
          </span>
        </button>
        <span className="text-xs text-slate-500 dark:text-slate-400">{profilePreview ? 'Change photo' : 'Add your photo (optional) - customers see it'}</span>
        <input ref={photoRef} type="file" accept="image/*" capture="user" className="hidden" onChange={pickProfilePhoto} />
      </div>

      <section className="space-y-3">
        <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-200">About you</h3>
        <Field label="Full name (as on your licence)" required error={errorFor('name')}>
          <TextInput value={form.name} onChange={(e) => set('name', e.target.value)} />
        </Field>
        <Field label="Mobile number" required hint="We'll send an OTP to verify it." error={errorFor('phone')}>
          <MobileVerification userId={userId} phone={verifiedPhone} verified={!!verifiedPhone} onVerified={setVerifiedPhone} />
        </Field>
      </section>

      <section className="space-y-3">
        <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-200">Driving licence</h3>
        <Field label="DL number" required error={errorFor('licenseNumber')}>
          <TextInput value={form.licenseNumber} onChange={(e) => set('licenseNumber', e.target.value.toUpperCase())} placeholder="KA0520190001234" />
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
        {errorFor('licensePhoto') && <p className="text-xs text-rose-500">{errorFor('licensePhoto')}</p>}
        <input ref={fileRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={pickLicense} />
      </section>

      <section className="space-y-3">
        <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-200">ID proof</h3>
        <Segmented<IdProofType> value={form.idProofType} options={[{ value: 'AADHAAR', label: 'Aadhaar' }, { value: 'PAN', label: 'PAN' }]} onChange={(v) => set('idProofType', v)} />
        <Field
          label={form.idProofType === 'AADHAAR' ? 'Aadhaar number' : 'PAN'}
          required
          hint={existing?.idProofNumberMasked ? `On file: ${existing.idProofNumberMasked} - enter it again to resubmit.` : undefined}
          error={errorFor('idProofNumber')}
        >
          <TextInput
            value={form.idProofNumber}
            onChange={(e) => set('idProofNumber', form.idProofType === 'AADHAAR' ? e.target.value.replace(/[^\d ]/g, '') : e.target.value.toUpperCase())}
            inputMode={form.idProofType === 'AADHAAR' ? 'numeric' : 'text'}
            placeholder={form.idProofType === 'AADHAAR' ? '1234 5678 9012' : 'ABCDE1234F'}
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
          <Field label="Vehicle number" required error={errorFor('vehicleNumber')}>
            <TextInput value={form.vehicleNumber} onChange={(e) => set('vehicleNumber', e.target.value.toUpperCase())} placeholder="KA-05-HH-1234" />
          </Field>
        )}
      </section>

      <section className="space-y-3">
        <h3 className="flex items-center gap-1.5 text-sm font-semibold text-slate-700 dark:text-slate-200">
          <Landmark size={15} /> Where should we pay you?
        </h3>
        <Segmented<PayoutMethod> value={form.payoutMethod} options={[{ value: 'UPI', label: 'UPI' }, { value: 'BANK', label: 'Bank account' }]} onChange={(v) => set('payoutMethod', v)} />
        {form.payoutMethod === 'UPI' ? (
          <Field label="UPI ID" required error={errorFor('upiId')}>
            <TextInput value={form.upiId} onChange={(e) => set('upiId', e.target.value.trim())} placeholder="name@okhdfcbank" />
          </Field>
        ) : (
          <>
            <Field label="Account holder name" required error={errorFor('bankAccountHolder')}>
              <TextInput value={form.bankAccountHolder} onChange={(e) => set('bankAccountHolder', e.target.value)} />
            </Field>
            <Field
              label="Account number"
              required
              hint={existing?.bankAccountNumberMasked ? `On file: ${existing.bankAccountNumberMasked}` : undefined}
              error={errorFor('bankAccountNumber')}
            >
              <TextInput inputMode="numeric" value={form.bankAccountNumber} onChange={(e) => set('bankAccountNumber', e.target.value.replace(/\D/g, ''))} />
            </Field>
            <Field
              label="IFSC"
              required
              hint="11 characters: 4 letters, a zero, then 6 letters/digits - printed on your passbook or cheque (e.g. SBIN0001234)."
              error={errorFor('bankIfsc')}
            >
              <TextInput value={form.bankIfsc} onChange={(e) => set('bankIfsc', e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 11))} placeholder="SBIN0001234" />
            </Field>
          </>
        )}
      </section>

      {error && <p className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-600 dark:bg-rose-500/10 dark:text-rose-400">{error}</p>}

      <button type="submit" className="btn-primary flex w-full items-center justify-center gap-2" disabled={submitting}>
        {submitting ? <Loader2 size={16} className="animate-spin" /> : <BadgeCheck size={16} />}
        {submitting ? 'Submitting...' : submitLabel}
      </button>
    </form>
  )
}
