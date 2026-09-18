import { useState, type FormEvent } from 'react'
import { useLocation, useNavigate, Link } from 'react-router-dom'
import { Mail, User as UserIcon } from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'
import { Field, TextInput } from '@/components/ui/FormControls'
import { IS_MOCK } from '@/config/env'

export default function RegisterPage() {
  const { register, isLoading, error } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const from = (location.state as { from?: string } | null)?.from
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    try {
      const challenge = await register({ fullName, email })
      navigate('/verify', {
        state: {
          challengeId: challenge.challengeId,
          maskedDestination: challenge.maskedDestination,
          expiresIn: challenge.expiresIn,
          resendAvailableIn: challenge.resendAvailableIn,
          from,
        },
      })
    } catch {
      // error is surfaced via auth context
    }
  }

  return (
    <div className="card p-6">
      <h2 className="mb-1 text-lg font-semibold text-slate-800 dark:text-slate-100">Become a delivery partner</h2>
      <p className="mb-5 text-sm text-slate-500 dark:text-slate-400">Takes less than a minute - you'll set up your rider details next.</p>

      <form onSubmit={handleSubmit} className="space-y-4">
        <Field label="Full name" required>
          <div className="relative">
            <UserIcon size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <TextInput value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="Your name" className="pl-9" required />
          </div>
        </Field>
        <Field label="Email" required>
          <div className="relative">
            <Mail size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <TextInput type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" className="pl-9" required />
          </div>
        </Field>

        {error && <p className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-600 dark:bg-rose-500/10 dark:text-rose-400">{error}</p>}

        <button type="submit" className="btn-primary w-full" disabled={isLoading}>
          {isLoading ? 'Creating account...' : 'Create account'}
        </button>
      </form>

      {IS_MOCK && (
        <p className="mt-4 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-700 dark:bg-amber-500/10 dark:text-amber-400">
          Mock mode: registration issues a fake OTP challenge - verify with <span className="font-mono">123456</span>.
        </p>
      )}

      <p className="mt-5 text-center text-sm text-slate-500 dark:text-slate-400">
        Already have an account?{' '}
        <Link to="/login" state={{ from }} className="font-medium text-brand-600 hover:underline">
          Sign in
        </Link>
      </p>
    </div>
  )
}
