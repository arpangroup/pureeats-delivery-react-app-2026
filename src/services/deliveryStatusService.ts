import { apiClient } from '@/lib/apiClient'
import { mockDelay } from '@/lib/mockUtils'
import { IS_MOCK } from '@/config/env'
import { riderProfilesByUserId } from '@/mocks/fixtures/riderProfile'

/** Server-side availability - see GET /api/v1/delivery/status. */
export interface RiderServerStatus {
  isOnline: boolean
  /** Why the rider is offline: SELF, INACTIVITY (auto-offlined after the app stopped reporting location - a "forced stop") or ADMIN. Null while online. */
  offlineReason: 'SELF' | 'INACTIVITY' | 'ADMIN' | null
  statusChangedAt: string | null
}

let mockIsOnline = false
let mockLastPosition: { lat: number; lng: number; at: string } | null = null

export const deliveryStatusService = {
  async setOnline(userId: number, isOnline: boolean): Promise<void> {
    if (IS_MOCK) {
      await mockDelay(150)
      mockIsOnline = isOnline
      const profile = riderProfilesByUserId[userId]
      if (profile) profile.isOnline = isOnline
      return
    }
    await apiClient.post('/delivery/status', { isOnline })
  },

  async getStatus(): Promise<RiderServerStatus> {
    if (IS_MOCK) {
      await mockDelay(80)
      return { isOnline: mockIsOnline, offlineReason: mockIsOnline ? null : 'SELF', statusChangedAt: null }
    }
    const { data } = await apiClient.get<{ data: RiderServerStatus }>('/delivery/status')
    return data.data
  },

  async pingLocation(lat: number, lng: number): Promise<void> {
    if (IS_MOCK) {
      // No-op against a server - just remember it in-memory so the UI can show a "last known
      // position" debug line without a real backend.
      mockLastPosition = { lat, lng, at: new Date().toISOString() }
      return
    }
    // Backend's LocationPingRequest declares lat/lng as String (matching the existing
    // order-scoped GpsPingRequest's own String lat/long convention) - send them as strings,
    // not JSON numbers, to avoid relying on Jackson's scalar-coercion behavior.
    await apiClient.post('/delivery/location', { lat: String(lat), lng: String(lng) })
  },

  /** Mock-only accessor for the debug "you are here" line - see HomePage. */
  getMockLastPosition() {
    return mockLastPosition
  },

  getMockIsOnline() {
    return mockIsOnline
  },
}
