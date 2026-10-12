import { useEffect, useRef, useState, type ChangeEvent, type FormEvent, type ReactNode } from 'react'
import { BadgeCheck, Bike, Bolt, Camera, CheckCircle2, IdCard, Landmark, Loader2, Lock, UserRound } from 'lucide-react'
import { Field, TextInput } from '@/components/ui/FormControls'
import { userService } from '@/services/userService'
import { useAuth } from '@/hooks/useAuth'
import { classNames } from '@/lib/format'
import { showErrorToast } from '@/lib/errorToast'
import { compressImage } from '@/lib/imageCompress'
import { realName } from '@/lib/contact'
import { requiredDocuments } from '@/lib/riderDocuments'
import type { DocType, PartnerApplication, PayoutMethod, RiderProfile, VehicleType } from '@/types/entities'
import { DocumentUpload } from './DocumentUpload'

/** Same rules the server applies (RiderKyc) - so every problem is shown here, next to its field. */
const LICENSE_RE = /^[A-Z]{2}\d{2}[A-Z0-9]{8,14}$/
const AADHAAR_RE = /^\d{12}$/
const PAN_RE = /^[A-Z]{5}\d{4}[A-Z]$/
const IFSC_RE = /^[A-Z]{4}0[A-Z0-9]{6}$/
const ACCOUNT_RE = /^\d{9,18}$/
const UPI_RE = /^[A-Za-z0-9._-]{2,256}@[A-Za-z]{2,64}$/
const compact = (v: string) => v.replace(/[\s-]/g, '').toUpperCase()

type FieldKey =
  | 'photo'
  | 'phone'
  | 'name'
  | 'licenseNumber'
  | 'aadhaarNumber'
  | 'panNumber'
  | 'vehicleNumber'
  | 'upiId'
  | 'bankAccountHolder'
  | 'bankAccountNumber'
  | 'bankIfsc'
  | DocType

/** Field -> what's wrong with it (only invalid fields are present). */
function validate(form: PartnerApplication, ctx: { hasPhone: boolean; hasPhoto: boolean; hasDoc: (t: DocType) => boolean }): Partial<Record<FieldKey, string>> {
  const e: Partial<Record<FieldKey, string>> = {}
  if (!ctx.hasPhoto) e.photo = 'Add your photo - customers see it when you deliver.'
  if (!ctx.hasPhone) e.phone = 'Verify your mobile number with the OTP.'
  if (realName(form.name).trim().length < 2) e.name = 'Enter your full name as printed on your licence.'
  const dl = compact(form.licenseNumber)
  if (!dl) e.licenseNumber = 'Enter your driving licence number.'
  else if (!LICENSE_RE.test(dl)) e.licenseNumber = `Not a valid DL number - it starts with the state code and RTO number, e.g. KA0520190001234 (${dl.length} characters entered).`
  const aadhaar = compact(form.aadhaarNumber)
  if (!aadhaar) e.aadhaarNumber = 'Enter your 12-digit Aadhaar number.'
  else if (!AADHAAR_RE.test(aadhaar)) e.aadhaarNumber = `Aadhaar number must be exactly 12 digits (you entered ${aadhaar.length}).`
  const pan = compact(form.panNumber)
  if (!pan) e.panNumber = 'Enter your PAN.'
  else if (!PAN_RE.test(pan)) e.panNumber = 'PAN is 10 characters: 5 letters, 4 digits, 1 letter - e.g. ABCDE1234F.'
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
  const docMessages: Record<DocType, string> = {
    LICENSE: 'Add a photo of the front of your licence.',
    AADHAAR_FRONT: 'Add a photo of the front of your Aadhaar - the number alone is not enough.',
    AADHAAR_BACK: 'Add a photo of the back of your Aadhaar (address side).',
    PAN: 'Add a photo of your PAN card - the number alone is not enough.',
    RC: 'Add your vehicle RC (Registration Certificate).',
    PASSBOOK: 'Add your passbook first page or a cancelled cheque for this bank account.',
  }
  for (const doc of requiredDocuments(form.vehicleType, form.payoutMethod)) if (!ctx.hasDoc(doc)) e[doc] = docMessages[doc]
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

/** A numbered step of the form, ticked once everything in it is valid. */
function Step({ n, title, icon: Icon, done, children }: { n: number; title: string; icon: typeof Bike; done: boolean; children: ReactNode }) {
  return (
    <section className="rounded-2xl border border-slate-200 p-4 dark:border-slate-800">
      <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-slate-800 dark:text-slate-100">
        <span
          className={classNames(
            'flex h-6 w-6 items-center justify-center rounded-full text-[11px] font-bold',
            done ? 'bg-emerald-500 text-white' : 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400',
          )}
        >
          {done ? <CheckCircle2 size={14} /> : n}
        </span>
        <Icon size={15} className="text-slate-400" /> {title}
      </h3>
      <div className="space-y-3">{children}</div>
    </section>
  )
}

/**
 * The mobile number. Already OTP-verified (signed in with it, or verified before) -> shown read-only, nothing to
 * do. Otherwise (e.g. the account was created with an email) it's required: enter it and verify it by OTP.
 */
function MobileVerification({ userId, phone, verified, onVerified }: { userId: number; phone: string; verified: boolean; onVerified: (phone: string) => void }) {
  const [value, setValue] = useState(phone)
  const [challengeId, setChallengeId] = useState<string | null>(null)
  const [otp, setOtp] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (verified && phone) {
    return (
      <div className="flex items-center justify-between rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2.5 text-sm dark:border-emerald-500/30 dark:bg-emerald-500/10">
        <span className="flex items-center gap-2 font-semibold text-slate-800 dark:text-slate-100">
          <Lock size={13} className="text-slate-400" /> {phone}
        </span>
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
 * Become a delivery partner, in six steps: your photo, about you (name + OTP-verified mobile), driving licence
 * (number + photo), ID proof (Aadhaar front & back + PAN, numbers and photos), vehicle (type, number + RC) and
 * payout (UPI, or bank account + passbook). Also used to correct and resubmit an application. The server validates
 * everything again and an admin can only approve once every document is on file.
 */
export function PartnerApplicationForm({
  userId,
  defaultName,
  phone,
  phoneVerified,
  existing,
  submitLabel,
  onSubmit,
}: {
  userId: number
  /** The account's name - ignored when it's the "PureEats User" placeholder of an OTP sign-up. */
  defaultName: string
  phone: string
  /** The account's mobile is already OTP-verified (e.g. signed in with it) - shown read-only. */
  phoneVerified: boolean
  existing?: RiderProfile | null
  submitLabel: string
  onSubmit: (application: PartnerApplication, documents: Partial<Record<DocType, File>>, profilePhoto: File | null) => Promise<void>
}) {
  const { refreshUser } = useAuth()
  const photoRef = useRef<HTMLInputElement>(null)
  const [profilePhoto, setProfilePhoto] = useState<File | null>(null)
  const [profilePreview, setProfilePreview] = useState<string | null>(existing?.photo ?? null)
  /** After the first Submit every invalid field shows its error; before that, only fields already typed in. */
  const [attempted, setAttempted] = useState(false)
  const [verifiedPhone, setVerifiedPhone] = useState(phoneVerified ? phone : '')
  // The account is re-read from the server on open - if that lands after this form mounted, take it then.
  useEffect(() => {
    if (phoneVerified && phone) setVerifiedPhone(phone)
  }, [phoneVerified, phone])
  const [form, setForm] = useState<PartnerApplication>({
    name: realName(existing?.name) || realName(defaultName),
    licenseNumber: existing?.licenseNumber ?? '',
    aadhaarNumber: '',
    panNumber: '',
    vehicleType: existing?.vehicleType ?? 'BIKE',
    vehicleNumber: existing?.vehicleNumber ?? '',
    payoutMethod: existing?.payoutMethod ?? 'UPI',
    bankAccountHolder: existing?.bankAccountHolder ?? '',
    bankAccountNumber: '',
    bankIfsc: existing?.bankIfsc ?? '',
    upiId: existing?.upiId ?? '',
  })
  const [docs, setDocs] = useState<Partial<Record<DocType, File>>>({})
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const onFile = (type: DocType) => existing?.documents?.find((d) => d.type === type) ?? null
  const hasDoc = (type: DocType) => !!docs[type] || !!onFile(type)
  const set = <K extends keyof PartnerApplication>(key: K, value: PartnerApplication[K]) => setForm((f) => ({ ...f, [key]: value }))
  const setDoc = (type: DocType) => (file: File) => setDocs((d) => ({ ...d, [type]: file }))

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

  const errors = validate(form, { hasPhone: !!verifiedPhone, hasPhoto: !!profilePhoto || !!existing?.photo, hasDoc })
  const typed: Partial<Record<FieldKey, boolean>> = {
    name: form.name.length > 0,
    licenseNumber: form.licenseNumber.length > 0,
    aadhaarNumber: form.aadhaarNumber.length > 0,
    panNumber: form.panNumber.length > 0,
    vehicleNumber: form.vehicleNumber.length > 0,
    upiId: form.upiId.length > 0,
    bankAccountHolder: form.bankAccountHolder.length > 0,
    bankAccountNumber: form.bankAccountNumber.length > 0,
    bankIfsc: form.bankIfsc.length > 0,
  }
  /** The error to show under a field: as soon as something invalid is typed, or for every field once Submit was pressed. */
  const errorFor = (key: FieldKey) => (attempted || typed[key] ? errors[key] : undefined)
  const errorCount = Object.keys(errors).length
  const ok = (...keys: FieldKey[]) => keys.every((k) => !errors[k])
  const needs = requiredDocuments(form.vehicleType, form.payoutMethod)
  const steps = [
    ok('photo'),
    ok('name', 'phone'),
    ok('licenseNumber', 'LICENSE'),
    ok('aadhaarNumber', 'panNumber', 'AADHAAR_FRONT', 'AADHAAR_BACK', 'PAN'),
    ok('vehicleNumber', 'RC'),
    ok('upiId', 'bankAccountHolder', 'bankAccountNumber', 'bankIfsc', 'PASSBOOK'),
  ]
  const doneCount = steps.filter(Boolean).length

  async function submit(e: FormEvent) {
    e.preventDefault()
    setAttempted(true)
    if (errorCount > 0) {
      setError(`Please fix the ${errorCount === 1 ? 'highlighted item' : `${errorCount} highlighted items`} above.`)
      return
    }
    setSubmitting(true)
    setError(null)
    try {
      // Only the documents this application needs (e.g. no RC for a cycle, no passbook for UPI).
      const toUpload = Object.fromEntries(needs.filter((t) => docs[t]).map((t) => [t, docs[t]!])) as Partial<Record<DocType, File>>
      await onSubmit({ ...form, name: form.name.trim() }, toUpload, profilePhoto)
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
    <form onSubmit={submit} noValidate className="space-y-4">
      <div className="sticky top-0 z-10 -mx-4 bg-white/95 px-4 pb-3 pt-1 backdrop-blur dark:bg-slate-900/95">
        <div className="flex items-center justify-between text-xs font-medium text-slate-500 dark:text-slate-400">
          <span>
            {doneCount} of {steps.length} steps complete
          </span>
          <span>All fields and documents are required</span>
        </div>
        <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
          <div className="h-full rounded-full bg-emerald-500 transition-all" style={{ width: `${(doneCount / steps.length) * 100}%` }} />
        </div>
      </div>

      <Step n={1} title="Your photo" icon={Camera} done={steps[0]}>
        <div className="flex items-center gap-4">
          <button type="button" onClick={() => photoRef.current?.click()} className="relative shrink-0" aria-label="Add your photo">
            <span
              className={classNames(
                'flex h-20 w-20 items-center justify-center overflow-hidden rounded-full bg-brand-100 text-brand-600 dark:bg-brand-500/15',
                errorFor('photo') && 'ring-2 ring-rose-400',
              )}
            >
              {profilePreview ? <img src={profilePreview} alt="Your photo" className="h-full w-full object-cover" /> : <Camera size={24} />}
            </span>
            <span className="absolute -bottom-1 -right-1 flex h-7 w-7 items-center justify-center rounded-full bg-brand-600 text-white shadow-sm">
              <Camera size={13} />
            </span>
          </button>
          <div className="text-xs text-slate-500 dark:text-slate-400">
            <p className="font-medium text-slate-700 dark:text-slate-200">{profilePreview ? 'Change photo' : 'Add a clear photo of your face'} <span className="text-rose-500">*</span></p>
            <p className="mt-0.5">Customers see it when you deliver. Once you're approved it can only be changed by PureEats.</p>
          </div>
        </div>
        {errorFor('photo') && <p className="text-xs text-rose-500">{errorFor('photo')}</p>}
        <input ref={photoRef} type="file" accept="image/*" capture="user" className="hidden" onChange={pickProfilePhoto} />
      </Step>

      <Step n={2} title="About you" icon={UserRound} done={steps[1]}>
        <Field label="Full name (as on your licence)" required error={errorFor('name')}>
          <TextInput value={form.name} onChange={(e) => set('name', e.target.value)} placeholder="e.g. Ravi Kumar" autoComplete="name" />
        </Field>
        <Field
          label="Mobile number"
          required
          hint={verifiedPhone ? 'Verified when you signed in.' : "We'll send an OTP to verify it."}
          error={errorFor('phone')}
        >
          <MobileVerification
            userId={userId}
            phone={verifiedPhone || phone}
            verified={!!verifiedPhone}
            onVerified={(p) => {
              setVerifiedPhone(p)
              refreshUser()
            }}
          />
        </Field>
      </Step>

      <Step n={3} title="Driving licence" icon={IdCard} done={steps[2]}>
        <Field label="DL number" required error={errorFor('licenseNumber')}>
          <TextInput value={form.licenseNumber} onChange={(e) => set('licenseNumber', e.target.value.toUpperCase())} placeholder="KA0520190001234" />
        </Field>
        <DocumentUpload type="LICENSE" file={docs.LICENSE ?? null} existing={onFile('LICENSE')} onPick={setDoc('LICENSE')} error={attempted ? errors.LICENSE : undefined} />
      </Step>

      <Step n={4} title="Aadhaar & PAN" icon={IdCard} done={steps[3]}>
        <p className="text-xs text-slate-500 dark:text-slate-400">Both are needed - the number and a photo of the card (Aadhaar front and back).</p>
        <Field
          label="Aadhaar number"
          required
          hint={existing?.aadhaarNumberMasked ? `On file: ${existing.aadhaarNumberMasked} - enter it again to resubmit.` : undefined}
          error={errorFor('aadhaarNumber')}
        >
          <TextInput value={form.aadhaarNumber} onChange={(e) => set('aadhaarNumber', e.target.value.replace(/[^\d ]/g, ''))} inputMode="numeric" placeholder="1234 5678 9012" />
        </Field>
        <DocumentUpload type="AADHAAR_FRONT" file={docs.AADHAAR_FRONT ?? null} existing={onFile('AADHAAR_FRONT')} onPick={setDoc('AADHAAR_FRONT')} error={attempted ? errors.AADHAAR_FRONT : undefined} />
        <DocumentUpload type="AADHAAR_BACK" file={docs.AADHAAR_BACK ?? null} existing={onFile('AADHAAR_BACK')} onPick={setDoc('AADHAAR_BACK')} error={attempted ? errors.AADHAAR_BACK : undefined} />
        <Field
          label="PAN"
          required
          hint={existing?.panNumberMasked ? `On file: ${existing.panNumberMasked} - enter it again to resubmit.` : undefined}
          error={errorFor('panNumber')}
        >
          <TextInput value={form.panNumber} onChange={(e) => set('panNumber', e.target.value.toUpperCase())} placeholder="ABCDE1234F" maxLength={10} />
        </Field>
        <DocumentUpload type="PAN" file={docs.PAN ?? null} existing={onFile('PAN')} onPick={setDoc('PAN')} error={attempted ? errors.PAN : undefined} />
      </Step>

      <Step n={5} title="Vehicle" icon={Bike} done={steps[4]}>
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
        {form.vehicleType !== 'CYCLE' ? (
          <>
            <Field label="Vehicle number" required error={errorFor('vehicleNumber')}>
              <TextInput value={form.vehicleNumber} onChange={(e) => set('vehicleNumber', e.target.value.toUpperCase())} placeholder="KA-05-HH-1234" />
            </Field>
            <DocumentUpload type="RC" file={docs.RC ?? null} existing={onFile('RC')} onPick={setDoc('RC')} error={attempted ? errors.RC : undefined} />
          </>
        ) : (
          <p className="text-xs text-slate-500 dark:text-slate-400">A cycle needs no registration number or RC.</p>
        )}
      </Step>

      <Step n={6} title="Where should we pay you?" icon={Landmark} done={steps[5]}>
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
            <DocumentUpload type="PASSBOOK" file={docs.PASSBOOK ?? null} existing={onFile('PASSBOOK')} onPick={setDoc('PASSBOOK')} error={attempted ? errors.PASSBOOK : undefined} />
          </>
        )}
      </Step>

      {error && <p className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-600 dark:bg-rose-500/10 dark:text-rose-400">{error}</p>}

      <button type="submit" className="btn-primary flex w-full items-center justify-center gap-2" disabled={submitting}>
        {submitting ? <Loader2 size={16} className="animate-spin" /> : <BadgeCheck size={16} />}
        {submitting ? 'Submitting...' : submitLabel}
      </button>
    </form>
  )
}
