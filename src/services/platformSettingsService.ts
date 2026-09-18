import { apiClient } from '@/lib/apiClient'
import { mockDelay } from '@/lib/mockUtils'
import { IS_MOCK } from '@/config/env'

/**
 * The generic, public key/value settings store every PureEats app reads from
 * (`GET /api/v1/settings`, no auth needed - see the admin panel's own settingsService.ts for the
 * write side, `PUT /admin/settings`, under Settings -> Delivery Application -> Location tracking).
 * This app only cares about one key today; kept as its own small service rather than a full
 * generic settings client since that's all a rider app needs.
 */
export const platformSettingsService = {
  /** Platform-wide kill switch - when false, every delivery partner's app must stop sending GPS
   * pings, regardless of their own online/offline toggle. Defaults to enabled (mock mode always
   * reports enabled - this is an ops control with no mock-demo need to flip it). */
  async isLocationTrackingEnabled(): Promise<boolean> {
    if (IS_MOCK) {
      await mockDelay(100)
      return true
    }
    try {
      const { data } = await apiClient.get<{ data: Record<string, string> }>('/settings')
      const value = data.data?.driver_location_tracking_enabled
      // Missing key (schema not deployed yet, or never explicitly set) defaults to enabled -
      // matches the backend schema's own default value of "true".
      return value == null || value === 'true'
    } catch {
      // A settings-fetch failure should never be the reason a rider's location silently stops
      // reporting - fail open (tracking stays enabled) rather than closed.
      return true
    }
  },
}
