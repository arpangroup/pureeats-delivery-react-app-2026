const DEVICE_ID_STORAGE_KEY = 'pureeats.rider.device.id'

/** Stable per-browser device id, sent as X-Device-Id so the backend's device/session audit trail is meaningful. */
export function getDeviceId(): string {
  let id = localStorage.getItem(DEVICE_ID_STORAGE_KEY)
  if (!id) {
    id = crypto.randomUUID()
    localStorage.setItem(DEVICE_ID_STORAGE_KEY, id)
  }
  return id
}
