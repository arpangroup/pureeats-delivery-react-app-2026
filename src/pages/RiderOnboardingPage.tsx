import { useRef, useState, type ChangeEvent, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { Camera, Loader2, CheckCircle2 } from 'lucide-react'
import { Field, TextInput, Textarea } from '@/components/ui/FormControls'
import { useAuth } from '@/hooks/useAuth'
import { riderProfileService } from '@/services/riderProfileService'
import type { Gender } from '@/types/entities'

/**
 * Shown when authenticated but the JWT role isn't yet DELIVERY (see RequireAuth). Collects the
 * minimum rider details, then - mirroring the backend's real behavior where a role only appears in
 * a FRESH token - tells the rider to log in again rather than trying to hot-swap their session role
 * client-side.
 */
export default function RiderOnboardingPage() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [vehicleNumber, setVehicleNumber] = useState('')
  const [age, setAge] = useState('')
  const [gender, setGender] = useState<Gender | ''>('')
  const [description, setDescription] = useState('')
  const [photo, setPhoto] = useState<File | null>(null)
  const [photoPreview, setPhotoPreview] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [done, setDone] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (!user) {
    navigate('/login', { replace: true })
    return null
  }

  function handlePhotoSelected(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setPhoto(file)
    setPhotoPreview(URL.createObjectURL(file))
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setSubmitting(true)
    setError(null)
    try {
      await riderProfileService.createProfile(user!.id, {
        name: user!.name,
        vehicleNumber,
        age: age ? Number(age) : null,
        gender: gender || null,
        description,
        photo,
      })
      setDone(true)
    } catch (err) {
      setError((err as { message?: string })?.message ?? 'Could not save your rider details.')
    } finally {
      setSubmitting(false)
    }
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
        <h2 className="text-lg font-semibold text-slate-800 dark:text-slate-100">You're almost a rider!</h2>
        <p className="max-w-xs text-sm text-slate-500 dark:text-slate-400">
          Your rider details are saved. Please log in again to activate your delivery-partner account.
        </p>
        <button className="btn-primary w-full max-w-xs" onClick={handleReturnToLogin}>
          Back to sign in
        </button>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-md px-5 py-8 pb-safe">
      <h1 className="text-xl font-bold text-slate-800 dark:text-slate-100">Set up your rider profile</h1>
      <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">A few details before you can start accepting deliveries.</p>

      <div className="mt-6 flex flex-col items-center gap-3">
        <div className="relative">
          <span className="flex h-20 w-20 items-center justify-center overflow-hidden rounded-full bg-brand-100 text-xl font-semibold text-brand-700 dark:bg-brand-500/15 dark:text-brand-400">
            {photoPreview ? <img src={photoPreview} alt="" className="h-full w-full object-cover" /> : <Camera size={22} />}
          </span>
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="absolute -bottom-1 -right-1 flex h-8 w-8 items-center justify-center rounded-full bg-brand-600 text-white shadow-sm"
            aria-label="Add photo"
          >
            <Camera size={14} />
          </button>
          <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handlePhotoSelected} />
        </div>
      </div>

      <form onSubmit={handleSubmit} className="card mt-6 space-y-4 p-4">
        <Field label="Vehicle number" required>
          <TextInput value={vehicleNumber} onChange={(e) => setVehicleNumber(e.target.value)} placeholder="KA-05-HH-1234" required />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Age">
            <TextInput type="number" min={18} max={70} value={age} onChange={(e) => setAge(e.target.value)} placeholder="27" />
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
        <Field label="About you" hint="Shown to support - not visible to customers.">
          <Textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="e.g. Full-time rider, evenings preferred." />
        </Field>

        {error && <p className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-600 dark:bg-rose-500/10 dark:text-rose-400">{error}</p>}

        <button type="submit" className="btn-primary flex w-full items-center justify-center gap-2" disabled={submitting || !vehicleNumber.trim()}>
          {submitting ? <Loader2 size={16} className="animate-spin" /> : null}
          {submitting ? 'Saving...' : 'Submit & activate'}
        </button>
      </form>
    </div>
  )
}
