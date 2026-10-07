import { apiClient } from '@/lib/apiClient'
import { mockDelay } from '@/lib/mockUtils'
import { IS_MOCK } from '@/config/env'

export interface PlatformSettings {
  /** Platform-wide kill switch - when false, every delivery partner's app must stop sending GPS
   * pings, regardless of their own online/offline toggle. */
  locationTrackingEnabled: boolean
  /** Admin-uploaded new-order sound (Settings -> General -> Order alert sound), or null to use the
   * built-in chime. */
  orderAlertSoundUrl: string | null
  /** Settings -> Delivery Application -> Order screens: show the partner's payout on order screens (off by default). */
  showPayout: boolean
  /** Settings -> Delivery Application -> Profile editing: which profile fields the partner may change (all off by default). */
  profileEditable: Record<ProfileField, boolean>
}

export type ProfileField = 'name' | 'vehicleNumber' | 'age' | 'gender' | 'about' | 'phone' | 'email' | 'license' | 'idProof' | 'vehicleType' | 'payout'

const PROFILE_KEYS: Record<ProfileField, string> = {
  name: 'driver_edit_name',
  vehicleNumber: 'driver_edit_vehicle_number',
  age: 'driver_edit_age',
  gender: 'driver_edit_gender',
  about: 'driver_edit_about',
  phone: 'driver_edit_phone',
  email: 'driver_edit_email',
  license: 'driver_edit_license',
  idProof: 'driver_edit_id_proof',
  vehicleType: 'driver_edit_vehicle_type',
  payout: 'driver_edit_payout',
}

const LOCKED: Record<ProfileField, boolean> = {
  name: false,
  vehicleNumber: false,
  age: false,
  gender: false,
  about: false,
  phone: false,
  email: false,
  license: false,
  idProof: false,
  vehicleType: false,
  payout: false,
}

const DEFAULTS: PlatformSettings = { locationTrackingEnabled: true, orderAlertSoundUrl: null, showPayout: false, profileEditable: LOCKED }

/** Mock mode: payout shown and the profile editable so every screen can be demoed. */
const MOCK_SETTINGS: PlatformSettings = {
  ...DEFAULTS,
  showPayout: true,
  profileEditable: { ...LOCKED, name: true, vehicleNumber: true, age: true, gender: true, about: true },
}

let latest: PlatformSettings = DEFAULTS
const listeners = new Set<(s: PlatformSettings) => void>()

/**
 * The generic, public key/value settings store every PureEats app reads from
 * (`GET /api/v1/settings`, no auth needed - see the admin panel's own settingsService.ts for the
 * write side, `PUT /admin/settings`). This app only cares about a couple of keys; kept as its own
 * small service rather than a full generic settings client since that's all a rider app needs.
 */
function publish(next: PlatformSettings): PlatformSettings {
  latest = next
  listeners.forEach((l) => l(next))
  return next
}

export const platformSettingsService = {
  async fetch(): Promise<PlatformSettings> {
    if (IS_MOCK) {
      await mockDelay(100)
      return publish(MOCK_SETTINGS)
    }
    try {
      const { data } = await apiClient.get<{ data: Record<string, string> }>('/settings')
      const tracking = data.data?.driver_location_tracking_enabled
      const sound = data.data?.order_alert_sound_url
      const flags = data.data ?? {}
      return publish({
        // Missing key (never explicitly set) defaults to enabled - matches the backend schema default.
        locationTrackingEnabled: tracking == null || tracking === 'true',
        orderAlertSoundUrl: sound && sound.trim() ? sound.trim() : null,
        showPayout: flags.driver_show_payout === 'true',
        profileEditable: Object.fromEntries(
          (Object.keys(PROFILE_KEYS) as ProfileField[]).map((f) => [f, flags[PROFILE_KEYS[f]] === 'true']),
        ) as Record<ProfileField, boolean>,
      })
    } catch {
      // A settings-fetch failure should never be the reason a rider's location silently stops
      // reporting - fail open (tracking stays enabled) rather than closed.
      return DEFAULTS
    }
  },

  /** Last fetched settings (defaults until the first fetch) - see useDriverSettings. */
  current(): PlatformSettings {
    return latest
  },

  subscribe(listener: (s: PlatformSettings) => void): () => void {
    listeners.add(listener)
    return () => listeners.delete(listener)
  },

  async isLocationTrackingEnabled(): Promise<boolean> {
    return (await platformSettingsService.fetch()).locationTrackingEnabled
  },
}
