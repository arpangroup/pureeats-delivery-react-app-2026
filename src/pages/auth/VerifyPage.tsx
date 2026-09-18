import { useEffect, useState, type FormEvent } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { ShieldCheck } from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'
import { TextInput } from '@/components/ui/FormControls'
import { IS_MOCK } from '@/config/env'

interface PendingChallenge {
  challengeId: string
  maskedDestination: string
  expiresIn: number
  resendAvailableIn: number
  from?: string
}

const PENDING_CHALLENGE_KEY = 'pureeats.rider.auth.pendingChallenge'

function readPendingChallenge(state: unknown): PendingChallenge | null {
  if (state && typeof state === 'object' && 'challengeId' in state) {
    const challenge = state as PendingChallenge
    sessionStorage.setItem(PENDING_CHALLENGE_KEY, JSON.stringify(challenge))
    return challenge
  }
  const stored = sessionStorage.getItem(PENDING_CHALLENGE_KEY)
  return stored ? (JSON.parse(stored) as PendingChallenge) : null
}

export default function VerifyPage() {
  const { verifyOtp, resendOtp, isLoading, error } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [challenge] = useState<PendingChallenge | null>(() => readPendingChallenge(location.state))
  const [otp, setOtp] = useState('')
  const [secondsLeft, setSecondsLeft] = useState(challenge?.expiresIn ?? 0)
  const [resendIn, setResendIn] = useState(challenge?.resendAvailableIn ?? 0)
  const [resending, setResending] = useState(false)
  const [resendMessage, setResendMessage] = useState<string | null>(null)

  useEffect(() => {
    if (secondsLeft <= 0) return
    const timer = setInterval(() => setSecondsLeft((s) => Math.max(0, s - 1)), 1000)
    return () => clearInterval(timer)
  }, [secondsLeft])

  useEffect(() => {
    if (resendIn <= 0) return
    const timer = setInterval(() => setResendIn((s) => Math.max(0, s - 1)), 1000)
    return () => clearInterval(timer)
  }, [resendIn])

  if (!challenge) {
    return (
      <div className="card p-6 text-center">
        <p className="text-sm text-slate-500 dark:text-slate-400">No pending verification. Please sign in again.</p>
        <button className="btn-primary mt-4 w-full" onClick={() => navigate('/login')}>
          Back to sign in
        </button>
      </div>
    )
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    try {
      await verifyOtp({ challengeId: challenge!.challengeId, otp })
      sessionStorage.removeItem(PENDING_CHALLENGE_KEY)
      navigate(challenge!.from ?? '/', { replace: true })
    } catch {
      // error is surfaced via auth context
    }
  }

  async function handleResend() {
    setResending(true)
    setResendMessage(null)
    try {
      const result = await resendOtp(challenge!.challengeId)
      setSecondsLeft(result.expiresIn)
      setResendIn(result.resendAvailableIn)
      setResendMessage('A new code has been sent.')
    } catch {
      // error surfaced via auth context
    } finally {
      setResending(false)
    }
  }

  const minutes = Math.floor(secondsLeft / 60)
  const seconds = secondsLeft % 60

  return (
    <div className="card p-6">
      <div className="mb-4 flex items-center gap-2 text-slate-700 dark:text-slate-200">
        <ShieldCheck size={18} className="text-brand-600" />
        <p className="text-sm">
          Enter the code sent to <span className="font-medium">{challenge.maskedDestination}</span>
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <TextInput
          value={otp}
          onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
          placeholder="123456"
          inputMode="numeric"
          maxLength={6}
          className="text-center text-xl tracking-[0.5em]"
          autoFocus
          required
        />

        {error && <p className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-600 dark:bg-rose-500/10 dark:text-rose-400">{error}</p>}
        {resendMessage && <p className="rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-400">{resendMessage}</p>}

        <button type="submit" className="btn-primary w-full" disabled={isLoading || otp.length !== 6}>
          {isLoading ? 'Verifying...' : 'Verify & continue'}
        </button>
      </form>

      <div className="mt-4 flex items-center justify-between text-xs text-slate-400">
        <span>{secondsLeft > 0 ? `Expires in ${minutes}:${seconds.toString().padStart(2, '0')}` : 'Code expired'}</span>
        <button
          type="button"
          onClick={handleResend}
          disabled={resendIn > 0 || resending}
          className="font-medium text-brand-600 hover:underline disabled:cursor-not-allowed disabled:text-slate-300 disabled:no-underline"
        >
          {resendIn > 0 ? `Resend in ${resendIn}s` : resending ? 'Resending...' : 'Resend code'}
        </button>
      </div>

      {IS_MOCK && (
        <p className="mt-4 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-700 dark:bg-amber-500/10 dark:text-amber-400">
          Mock mode: enter <span className="font-mono">123456</span> to verify.
        </p>
      )}
    </div>
  )
}
