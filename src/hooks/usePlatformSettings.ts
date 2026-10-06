import { useEffect, useState } from 'react'
import { platformSettingsService } from '@/services/platformSettingsService'
import { setCustomOrderSoundUrl } from '@/lib/orderSound'

const RECHECK_INTERVAL_MS = 60000

/**
 * Polls the public platform settings every 60s so an admin change (the location-tracking kill
 * switch under Settings -> Delivery Application, or a new order alert sound) takes effect on an
 * already-open rider app within a minute, not only on next login. Also pushes the sound URL into
 * the shared order-sound player.
 */
export function usePlatformSettings() {
  const [locationTrackingEnabled, setLocationTrackingEnabled] = useState(true)
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    let cancelled = false
    async function check() {
      const settings = await platformSettingsService.fetch()
      if (cancelled) return
      setLocationTrackingEnabled(settings.locationTrackingEnabled)
      setCustomOrderSoundUrl(settings.orderAlertSoundUrl)
      setLoaded(true)
    }
    check()
    const intervalId = setInterval(check, RECHECK_INTERVAL_MS)
    return () => {
      cancelled = true
      clearInterval(intervalId)
    }
  }, [])

  return { locationTrackingEnabled, loaded }
}
