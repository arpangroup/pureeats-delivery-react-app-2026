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
}

const DEFAULTS: PlatformSettings = { locationTrackingEnabled: true, orderAlertSoundUrl: null }

/**
 * The generic, public key/value settings store every PureEats app reads from
 * (`GET /api/v1/settings`, no auth needed - see the admin panel's own settingsService.ts for the
 * write side, `PUT /admin/settings`). This app only cares about a couple of keys; kept as its own
 * small service rather than a full generic settings client since that's all a rider app needs.
 */
export const platformSettingsService = {
  async fetch(): Promise<PlatformSettings> {
    if (IS_MOCK) {
      await mockDelay(100)
      return DEFAULTS
    }
    try {
      const { data } = await apiClient.get<{ data: Record<string, string> }>('/settings')
      const tracking = data.data?.driver_location_tracking_enabled
      const sound = data.data?.order_alert_sound_url
      return {
        // Missing key (never explicitly set) defaults to enabled - matches the backend schema default.
        locationTrackingEnabled: tracking == null || tracking === 'true',
        orderAlertSoundUrl: sound && sound.trim() ? sound.trim() : null,
      }
    } catch {
      // A settings-fetch failure should never be the reason a rider's location silently stops
      // reporting - fail open (tracking stays enabled) rather than closed.
      return DEFAULTS
    }
  },

  async isLocationTrackingEnabled(): Promise<boolean> {
    return (await platformSettingsService.fetch()).locationTrackingEnabled
  },
}
