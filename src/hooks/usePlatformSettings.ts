import { useEffect, useState } from 'react'
import { platformSettingsService } from '@/services/platformSettingsService'

const RECHECK_INTERVAL_MS = 60000

/**
 * Polls the platform-wide location-tracking kill switch every 60s so an admin flipping it in
 * Settings -> Delivery Application takes effect on an already-open rider app within a minute,
 * not only on next login. See useLocationReporting (the thing this actually gates) and HomePage's
 * "Maintenance mode" banner (the thing this explains to the rider).
 */
export function usePlatformSettings() {
  const [locationTrackingEnabled, setLocationTrackingEnabled] = useState(true)
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    let cancelled = false
    async function check() {
      const enabled = await platformSettingsService.isLocationTrackingEnabled()
      if (!cancelled) {
        setLocationTrackingEnabled(enabled)
        setLoaded(true)
      }
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
