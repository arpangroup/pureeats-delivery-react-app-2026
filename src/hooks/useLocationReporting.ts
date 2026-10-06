import { useCallback, useEffect, useRef, useState } from 'react'
import { getCurrentPosition, queryGeolocationPermission, type Coordinates, type GeolocationPermissionState } from '@/lib/geolocation'
import { deliveryStatusService } from '@/services/deliveryStatusService'

const PING_INTERVAL_MS = 15000

/**
 * While `isOnline` is true AND `trackingEnabled` is true, pings this device's GPS position to the
 * backend every 15s (and once immediately on going online) - stops instantly the moment either
 * flips false or the component unmounts, so a rider who goes offline (or whose app is put into
 * platform-wide maintenance mode by an admin - see usePlatformSettings) stops being tracked with
 * no lag. `trackingEnabled` deliberately gates this the same way `isOnline` does, at the same
 * level, rather than leaving callers to remember to combine the two flags themselves - this is the
 * one place GPS pings actually go out, so it's the one place that must never get the gate wrong.
 *
 * Mounted app-wide (RiderSessionProvider), not per page - pings used to stop the moment the rider
 * left the Home tab, which let the backend's inactivity sweep force them offline. `reportNow` lets
 * the session send a ping straight away when the app returns from the background.
 */
export function useLocationReporting(isOnline: boolean, trackingEnabled: boolean) {
  const [lastPosition, setLastPosition] = useState<Coordinates | null>(null)
  const [permissionState, setPermissionState] = useState<GeolocationPermissionState>('prompt')
  const [error, setError] = useState<string | null>(null)
  const requestedPermissionOnce = useRef(false)
  const activeRef = useRef(false)
  activeRef.current = isOnline && trackingEnabled

  const reportOnce = useCallback(async () => {
    if (!activeRef.current) return
    try {
      const position = await getCurrentPosition()
      if (!activeRef.current) return
      setLastPosition(position)
      setError(null)
      await deliveryStatusService.pingLocation(position.latitude, position.longitude)
    } catch (err) {
      if (activeRef.current) setError((err as Error)?.message ?? 'Could not read your location.')
    }
  }, [])

  useEffect(() => {
    if (!isOnline || !trackingEnabled) return
    let cancelled = false

    if (!requestedPermissionOnce.current) {
      requestedPermissionOnce.current = true
      queryGeolocationPermission().then((state) => {
        if (!cancelled) setPermissionState(state)
      })
    }

    reportOnce()
    const intervalId = setInterval(reportOnce, PING_INTERVAL_MS)

    return () => {
      cancelled = true
      clearInterval(intervalId)
    }
  }, [isOnline, trackingEnabled, reportOnce])

  return { lastPosition, permissionState, error, reportNow: reportOnce }
}
