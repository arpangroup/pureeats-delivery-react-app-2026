import { useEffect, useRef, useState, type ChangeEvent, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { Camera, Check, Loader2 } from 'lucide-react'
import { PageHeader } from '@/components/layout/PageHeader'
import { Field, TextInput, Textarea } from '@/components/ui/FormControls'
import { useAuth } from '@/hooks/useAuth'
import { riderProfileService } from '@/services/riderProfileService'
import { userService } from '@/services/userService'
import { initials } from '@/lib/format'
import { IS_MOCK } from '@/config/env'
import type { Gender, RiderProfile } from '@/types/entities'

type ContactField = 'phone' | 'email'

/** Inline "change phone/email" flow - request an OTP to the new destination, then verify it before
 * the change takes effect, reusing the same OTP-challenge mechanism login/onboarding already use. */
function ContactChangeCard({
  field,
  userId,
  currentValue,
  onChanged,
}: {
  field: ContactField
  userId: number
  currentValue: string
  onChanged: (value: string) => void
}) {
  const [editing, setEditing] = useState(false)
  const [step, setStep] = useState<'input' | 'otp'>('input')
  const [value, setValue] = useState(currentValue)
  const [otp, setOtp] = useState('')
  const [challengeId, setChallengeId] = useState<string | null>(null)
  const [maskedDestination, setMaskedDestination] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function reset() {
    setEditing(false)
    setStep('input')
    setValue(currentValue)
    setOtp('')
    setChallengeId(null)
    setError(null)
  }

  async function handleRequestOtp(e: FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    try {
      const result = field === 'phone' ? await userService.requestPhoneChange(userId, value) : await userService.requestEmailChange(userId, value)
      setChallengeId(result.challengeId)
      setMaskedDestination(result.maskedDestination)
      setStep('otp')
    } catch (err) {
      setError((err as { message?: string })?.message ?? 'Could not send OTP.')
    } finally {
      setBusy(false)
    }
  }

  async function handleVerify(e: FormEvent) {
    e.preventDefault()
    if (!challengeId) return
    setBusy(true)
    setError(null)
    try {
      const updated = field === 'phone' ? await userService.confirmPhoneChange(challengeId, otp) : await userService.confirmEmailChange(challengeId, otp)
      onChanged(field === 'phone' ? updated.phone : updated.email)
      reset()
    } catch (err) {
      setError((err as { message?: string })?.message ?? 'Invalid or expired OTP.')
    } finally {
      setBusy(false)
    }
  }

  const label = field === 'phone' ? 'Mobile number' : 'Email address'

  if (!editing) {
    return (
      <div className="flex items-center justify-between py-3">
        <div className="min-w-0">
          <p className="text-xs font-medium text-slate-500 dark:text-slate-400">{label}</p>
          <p className="truncate text-sm font-medium text-slate-800 dark:text-slate-100">{currentValue || '-'}</p>
        </div>
        <button type="button" className="shrink-0 text-xs font-semibold text-brand-600" onClick={() => setEditing(true)}>
          Change
        </button>
      </div>
    )
  }

  return (
    <div className="py-3">
      <p className="mb-2 text-xs font-medium text-slate-500 dark:text-slate-400">{label}</p>
      {step === 'input' ? (
        <form onSubmit={handleRequestOtp} className="space-y-2">
          <TextInput
            value={value}
            onChange={(e) => setValue(e.target.value)}
            type={field === 'email' ? 'email' : 'tel'}
            placeholder={field === 'phone' ? '9876543210' : 'you@example.com'}
            autoFocus
            required
          />
          {error && <p className="text-xs text-rose-500">{error}</p>}
          <div className="flex gap-2">
            <button type="submit" className="btn-primary flex-1" disabled={busy || value === currentValue}>
              {busy ? 'Sending OTP...' : 'Send OTP'}
            </button>
            <button type="button" className="btn-secondary" onClick={reset}>
              Cancel
            </button>
          </div>
        </form>
      ) : (
        <form onSubmit={handleVerify} className="space-y-2">
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Enter the code sent to <span className="font-medium">{maskedDestination}</span>
          </p>
          <TextInput
            value={otp}
            onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
            placeholder="123456"
            inputMode="numeric"
            maxLength={6}
            className="text-center text-lg tracking-[0.4em]"
            autoFocus
            required
          />
          {error && <p className="text-xs text-rose-500">{error}</p>}
          {IS_MOCK && <p className="text-xs text-amber-600 dark:text-amber-400">Mock mode: use 123456.</p>}
          <div className="flex gap-2">
            <button type="submit" className="btn-primary flex-1" disabled={busy || otp.length !== 6}>
              {busy ? 'Verifying...' : 'Verify & save'}
            </button>
            <button type="button" className="btn-secondary" onClick={reset}>
              Cancel
            </button>
          </div>
        </form>
      )}
    </div>
  )
}

export default function EditRiderProfilePage() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [profile, setProfile] = useState<RiderProfile | null>(null)
  const [name, setName] = useState('')
  const [vehicleNumber, setVehicleNumber] = useState('')
  const [age, setAge] = useState('')
  const [gender, setGender] = useState<Gender | ''>('')
  const [description, setDescription] = useState('')
  const [phone, setPhone] = useState('')
  const [email, setEmail] = useState('')
  const [photo, setPhoto] = useState<string | null>(null)
  const [photoFile, setPhotoFile] = useState<File | null>(null)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!user) return
    let cancelled = false
    riderProfileService.getMyProfile(user.id).then((p) => {
      if (cancelled) return
      setProfile(p)
      setName(p?.name ?? user.name)
      setVehicleNumber(p?.vehicleNumber ?? '')
      setAge(p?.age != null ? String(p.age) : '')
      setGender(p?.gender ?? '')
      setDescription(p?.description ?? '')
      setPhoto(p?.photo ?? null)
      setPhone(user.phone)
      setEmail(user.email)
    })
    return () => {
      cancelled = true
    }
  }, [user])

  if (!user) {
    navigate('/profile', { replace: true })
    return null
  }

  function handlePhotoSelected(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setPhotoFile(file)
    setPhoto(URL.createObjectURL(file))
  }

  async function handleSave(e: FormEvent) {
    e.preventDefault()
    setSaving(true)
    setSaved(false)
    setError(null)
    try {
      const updated = await riderProfileService.updateProfile(user!.id, {
        name: name.trim(),
        vehicleNumber: vehicleNumber.trim(),
        age: age ? Number(age) : null,
        gender: gender || null,
        description: description.trim(),
        photo: photoFile,
      })
      setProfile(updated)
      setPhoto(updated.photo)
      setPhotoFile(null)
      setSaved(true)
    } catch (err) {
      setError((err as { message?: string })?.message ?? 'Could not save your changes.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div>
      <PageHeader title="Edit profile" />
      <div className="px-4 py-4 pb-8">
        <div className="flex flex-col items-center gap-3 py-2">
          <div className="relative">
            <span className="flex h-20 w-20 items-center justify-center overflow-hidden rounded-full bg-brand-100 text-xl font-semibold text-brand-700 dark:bg-brand-500/15 dark:text-brand-400">
              {photo ? <img src={photo} alt={name} className="h-full w-full object-cover" /> : initials(name || user.name)}
            </span>
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="absolute -bottom-1 -right-1 flex h-8 w-8 items-center justify-center rounded-full bg-brand-600 text-white shadow-sm"
              aria-label="Change photo"
            >
              <Camera size={14} />
            </button>
            <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handlePhotoSelected} />
          </div>
        </div>

        <form onSubmit={handleSave} className="card mt-2 space-y-4 p-4">
          <Field label="Name" required>
            <TextInput value={name} onChange={(e) => setName(e.target.value)} required />
          </Field>
          <Field label="Vehicle number" required>
            <TextInput value={vehicleNumber} onChange={(e) => setVehicleNumber(e.target.value)} placeholder="KA-05-HH-1234" required />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Age">
              <TextInput type="number" min={18} max={70} value={age} onChange={(e) => setAge(e.target.value)} />
            </Field>
            <Field label="Gender">
              <select className="input" value={gender} onChange={(e) => setGender(e.target.value as Gender | '')}>
                <option value="">Prefer not to say</option>
                <option value="MALE">Male</option>
                <option value="FEMALE">Female</option>
                <option value="OTHER">Other</option>
              </select>
            </Field>
          </div>
          <Field label="About you">
            <Textarea value={description} onChange={(e) => setDescription(e.target.value)} />
          </Field>

          {error && <p className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-600 dark:bg-rose-500/10 dark:text-rose-400">{error}</p>}

          <button type="submit" className="btn-primary flex w-full items-center justify-center gap-2" disabled={saving || !name.trim() || !vehicleNumber.trim()}>
            {saving ? (
              'Saving...'
            ) : saved ? (
              <>
                <Check size={16} /> Saved
              </>
            ) : (
              'Save changes'
            )}
          </button>
        </form>

        {profile && (
          <div className="card mt-4 grid grid-cols-2 divide-x divide-slate-100 dark:divide-slate-800">
            <div className="p-3 text-center">
              <p className="text-sm font-bold text-slate-800 dark:text-slate-100">{profile.rating.toFixed(1)}</p>
              <p className="text-[11px] text-slate-400">Rating</p>
            </div>
            <div className="p-3 text-center">
              <p className="text-sm font-bold text-slate-800 dark:text-slate-100">{profile.commissionRate}%</p>
              <p className="text-[11px] text-slate-400">Commission</p>
            </div>
          </div>
        )}

        <div className="card mt-4 divide-y divide-slate-100 px-4 dark:divide-slate-800">
          <ContactChangeCard field="phone" userId={user.id} currentValue={phone} onChanged={setPhone} />
          <ContactChangeCard field="email" userId={user.id} currentValue={email} onChanged={setEmail} />
        </div>
      </div>
    </div>
  )
}
