import { useState, type FormEvent } from 'react'
import { useLocation, useNavigate, Link } from 'react-router-dom'
import { Mail, Phone } from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'
import { Field, TextInput } from '@/components/ui/FormControls'
import { IS_MOCK } from '@/config/env'
import { DEMO_ACCOUNTS } from '@/services/authService'

interface LoginNavState {
  from?: string
  method?: 'EMAIL' | 'PHONE'
}

export default function LoginPage() {
  const { requestOtp, isLoading, error } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const navState = (location.state ?? {}) as LoginNavState
  const [method, setMethod] = useState<'EMAIL' | 'PHONE'>(navState.method ?? 'EMAIL')
  const [email, setEmail] = useState('')
  const [countryId, setCountryId] = useState('91')
  const [phone, setPhone] = useState('')

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    try {
      const payload = method === 'EMAIL' ? { method: 'EMAIL' as const, email } : { method: 'PHONE' as const, countryId: Number(countryId), phone }
      const challenge = await requestOtp(payload)
      navigate('/verify', {
        state: {
          challengeId: challenge.challengeId,
          maskedDestination: challenge.maskedDestination,
          expiresIn: challenge.expiresIn,
          resendAvailableIn: challenge.resendAvailableIn,
          from: navState.from,
        },
      })
    } catch {
      // error is surfaced via auth context
    }
  }

  return (
    <div className="card p-6">
      <h2 className="mb-1 text-lg font-semibold text-slate-800 dark:text-slate-100">Sign in to start delivering</h2>
      <p className="mb-5 text-sm text-slate-500 dark:text-slate-400">We'll send you a one-time code to verify it's you.</p>

      <div className="mb-4 flex gap-1 rounded-xl bg-slate-100 p-1 text-sm dark:bg-slate-800">
        <button
          type="button"
          onClick={() => setMethod('EMAIL')}
          className={`flex-1 rounded-lg py-2 font-medium transition-colors ${method === 'EMAIL' ? 'bg-white text-slate-800 shadow-sm dark:bg-slate-700 dark:text-slate-100' : 'text-slate-500'}`}
        >
          Email
        </button>
        <button
          type="button"
          onClick={() => setMethod('PHONE')}
          className={`flex-1 rounded-lg py-2 font-medium transition-colors ${method === 'PHONE' ? 'bg-white text-slate-800 shadow-sm dark:bg-slate-700 dark:text-slate-100' : 'text-slate-500'}`}
        >
          Phone
        </button>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        {method === 'EMAIL' ? (
          <Field label="Email" required>
            <div className="relative">
              <Mail size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <TextInput type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" className="pl-9" required />
            </div>
          </Field>
        ) : (
          <div className="grid grid-cols-3 gap-2">
            <Field label="Code" required>
              <TextInput value={countryId} onChange={(e) => setCountryId(e.target.value)} placeholder="91" required />
            </Field>
            <div className="col-span-2">
              <Field label="Phone" required>
                <div className="relative">
                  <Phone size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <TextInput type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="9800000000" className="pl-9" required />
                </div>
              </Field>
            </div>
          </div>
        )}

        {error && <p className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-600 dark:bg-rose-500/10 dark:text-rose-400">{error}</p>}

        <button type="submit" className="btn-primary w-full" disabled={isLoading}>
          {isLoading ? 'Sending OTP...' : 'Send OTP'}
        </button>
      </form>

      {IS_MOCK && (
        <div className="mt-5 border-t border-slate-100 pt-4 dark:border-slate-800">
          <p className="mb-2 text-xs font-medium uppercase tracking-wide text-slate-400">Quick demo login</p>
          <div className="space-y-1.5">
            {DEMO_ACCOUNTS.map((account) => (
              <button
                key={account.email}
                type="button"
                onClick={() => {
                  setMethod('EMAIL')
                  setEmail(account.email)
                }}
                className="flex w-full items-center justify-between rounded-xl border border-slate-200 px-3.5 py-2.5 text-left text-sm hover:border-brand-300 hover:bg-brand-50 dark:border-slate-700 dark:hover:border-brand-500/40 dark:hover:bg-brand-500/10"
              >
                <span className="font-medium text-slate-700 dark:text-slate-200">{account.label}</span>
                <span className="text-xs text-slate-400">{account.email}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      <p className="mt-5 text-center text-sm text-slate-500 dark:text-slate-400">
        New rider?{' '}
        <Link to="/register" state={navState} className="font-medium text-brand-600 hover:underline">
          Create account
        </Link>
      </p>
    </div>
  )
}
