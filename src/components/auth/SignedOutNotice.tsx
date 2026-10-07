import { useState } from 'react'
import { ShieldOff } from 'lucide-react'
import { takeSignedOutNotice } from '@/lib/sessionEnd'

/** Shown on the sign-in page after the app signed the user out (account blocked/deleted, or signed out of all devices). */
export function SignedOutNotice() {
  const [notice] = useState(takeSignedOutNotice)
  if (!notice) return null
  return (
    <p role="alert" className="mb-4 flex items-start gap-2 rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700 dark:bg-rose-500/10 dark:text-rose-300">
      <ShieldOff size={16} className="mt-0.5 shrink-0" />
      <span>{notice}</span>
    </p>
  )
}
