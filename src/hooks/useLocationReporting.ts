import { useEffect, useRef, useState } from 'react'
import { getCurrentPosition, queryGeolocationPermission, type Coordinates, type GeolocationPermissionState } from '@/lib/geolocation'
import { deliveryStatusService } from '@/services/deliveryStatusService'

const PING_INTERVAL_MS = 15000

/**
 * While `isOnline` is true, pings this device's GPS position to the backend every 15s (and once
 * immediately on going online) - stops instantly the moment `isOnline` flips false or the
 * component unmounts, so a rider who goes offline stops being tracked with no lag. See
 * useOnlineStatus for the toggle this is keyed on, and HomePage for the "sending location"
 * indicator this feeds.
 */
export function useLocationReporting(isOnline: boolean) {
  const [lastPosition, setLastPosition] = useState<Coordinates | null>(null)
  const [permissionState, setPermissionState] = useState<GeolocationPermissionState>('prompt')
  const [error, setError] = useState<string | null>(null)
  const requestedPermissionOnce = useRef(false)

  useEffect(() => {
    if (!isOnline) return
    let cancelled = false
    let intervalId: ReturnType<typeof setInterval> | undefined

    async function reportOnce() {
      try {
        const position = await getCurrentPosition()
        if (cancelled) return
        setLastPosition(position)
        setError(null)
        await deliveryStatusService.pingLocation(position.latitude, position.longitude)
      } catch (err) {
        if (!cancelled) setError((err as Error)?.message ?? 'Could not read your location.')
      }
    }

    if (!requestedPermissionOnce.current) {
      requestedPermissionOnce.current = true
      queryGeolocationPermission().then((state) => {
        if (!cancelled) setPermissionState(state)
      })
    }

    reportOnce()
    intervalId = setInterval(reportOnce, PING_INTERVAL_MS)

    return () => {
      cancelled = true
      if (intervalId) clearInterval(intervalId)
    }
  }, [isOnline])

  return { lastPosition, permissionState, error }
}
