import { apiClient } from '@/lib/apiClient'
import { IS_MOCK } from '@/config/env'

/**
 * Push-token registration for the rider app. Unlike the customer app, this app doesn't need a
 * general notification-center UI - the one thing that matters here is getting this device's FCM
 * token onto the backend under the DELIVERY audience so new-order pushes (type: 'NEW_ORDER') and
 * any other rider broadcast reach it.
 */
export const notificationService = {
  /** Mock: no-op (no server to notify). Live: `audience: 'DELIVERY'` auto-subscribes this device
   * to the standing rider broadcast topic (a `DELIVERY` push audience is being added backend-side
   * in parallel with this app). */
  async registerPushToken(token: string): Promise<void> {
    if (IS_MOCK) return
    await apiClient.post('/notifications/push-token', { token, audience: 'DELIVERY' })
  },
}
