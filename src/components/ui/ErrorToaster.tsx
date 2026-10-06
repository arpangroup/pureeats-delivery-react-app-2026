import { useEffect, useState } from 'react'
import { AlertCircle, X } from 'lucide-react'
import { ERROR_TOAST_EVENT } from '@/lib/errorToast'

const AUTO_DISMISS_MS = 7000
const MAX_VISIBLE = 3

interface Toast {
  id: number
  message: string
}

/**
 * Renders error toasts raised via showErrorToast (lib/errorToast.ts). Mounted once at the app root
 * with a z-index above FullScreenOrderAlert/AssignedOrderAlert, so an accept failure is visible
 * even on top of the full-screen order popup. Identical messages arriving together are collapsed.
 */
export function ErrorToaster() {
  const [toasts, setToasts] = useState<Toast[]>([])

  useEffect(() => {
    let nextId = 1
    const onError = (event: unknown) => {
      const message = (event as { detail?: string }).detail
      if (!message) return
      const id = nextId++
      setToasts((prev) => [{ id, message }, ...prev.filter((t) => t.message !== message)].slice(0, MAX_VISIBLE))
      window.setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), AUTO_DISMISS_MS)
    }
    window.addEventListener(ERROR_TOAST_EVENT, onError)
    return () => window.removeEventListener(ERROR_TOAST_EVENT, onError)
  }, [])

  if (toasts.length === 0) return null

  return (
    <div className="pointer-events-none fixed inset-x-0 top-0 z-[60] flex flex-col items-center gap-2 px-3 pt-safe" role="alert" aria-live="assertive">
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className="pointer-events-auto mt-2 flex w-full max-w-md items-start gap-2 rounded-xl bg-rose-600 px-3 py-2.5 text-sm text-white shadow-lg animate-fade-in"
        >
          <AlertCircle size={18} className="mt-0.5 shrink-0" />
          <p className="flex-1">{toast.message}</p>
          <button onClick={() => setToasts((prev) => prev.filter((t) => t.id !== toast.id))} aria-label="Dismiss" className="shrink-0 text-white/80">
            <X size={16} />
          </button>
        </div>
      ))}
    </div>
  )
}
