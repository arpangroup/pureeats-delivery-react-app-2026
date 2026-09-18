export interface Coordinates {
  latitude: number
  longitude: number
}

/** Wraps the browser Geolocation API in a promise; rejects with a friendly message on denial/timeout. */
export function getCurrentPosition(): Promise<Coordinates> {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error('Location is not supported on this device.'))
      return
    }
    navigator.geolocation.getCurrentPosition(
      (position) => resolve({ latitude: position.coords.latitude, longitude: position.coords.longitude }),
      () => reject(new Error("Couldn't access your location - please check your device's location settings.")),
      { enableHighAccuracy: true, timeout: 8000, maximumAge: 60_000 },
    )
  })
}

export type GeolocationPermissionState = 'granted' | 'denied' | 'prompt' | 'unsupported'

/**
 * Reads the current geolocation permission without triggering the native browser prompt - the
 * Permissions API lets us tell "never asked yet" (prompt) apart from "user already said no"
 * (denied) so the UI can show a plain "allow" button in one case and settings instructions in the
 * other. Safari (all platforms) doesn't implement `navigator.permissions.query` for geolocation,
 * so it falls back to 'prompt', matching the only thing we can safely assume there.
 */
export async function queryGeolocationPermission(): Promise<GeolocationPermissionState> {
  if (!navigator.geolocation) return 'unsupported'
  if (!navigator.permissions?.query) return 'prompt'
  try {
    const status = await navigator.permissions.query({ name: 'geolocation' as any })
    return status.state as GeolocationPermissionState
  } catch {
    return 'prompt'
  }
}

/** Calls `onChange` whenever the permission state flips. Returns a no-op unsubscribe when the Permissions API isn't available. */
export function watchGeolocationPermission(onChange: (state: GeolocationPermissionState) => void): () => void {
  if (!navigator.permissions?.query) return () => {}
  let status: any
  navigator.permissions
    .query({ name: 'geolocation' as any })
    .then((s) => {
      status = s
      status.addEventListener('change', handleChange)
    })
    .catch(() => {})
  function handleChange() {
    if (status) onChange(status.state as GeolocationPermissionState)
  }
  return () => status?.removeEventListener('change', handleChange)
}
