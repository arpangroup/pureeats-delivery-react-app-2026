import { useCallback, useState } from 'react'
import { useAuth } from '@/hooks/useAuth'
import { deliveryStatusService } from '@/services/deliveryStatusService'
import { readStorage, writeStorage } from '@/lib/storage'

const ONLINE_STORAGE_KEY = 'pureeats.rider.isOnline'

/**
 * Go-online/offline toggle - the most visible piece of chrome in the app (see HomePage's banner).
 * Persists to `deliveryStatusService.setOnline` with an optimistic UI update, reverting if the
 * call fails. `useLocationReporting` reads the resulting `isOnline` to decide whether to start/stop
 * pinging GPS.
 */
export function useOnlineStatus() {
  const { user } = useAuth()
  const [isOnline, setIsOnline] = useState(() => readStorage(ONLINE_STORAGE_KEY, false))
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const toggle = useCallback(async () => {
    if (!user) return
    const next = !isOnline
    setIsOnline(next)
    writeStorage(ONLINE_STORAGE_KEY, next)
    setIsSaving(true)
    setError(null)
    try {
      await deliveryStatusService.setOnline(user.id, next)
    } catch (err) {
      // revert the optimistic flip on failure
      setIsOnline(!next)
      writeStorage(ONLINE_STORAGE_KEY, !next)
      setError((err as { message?: string })?.message ?? 'Could not update your status.')
    } finally {
      setIsSaving(false)
    }
  }, [user, isOnline])

  return { isOnline, isSaving, error, toggle }
}
