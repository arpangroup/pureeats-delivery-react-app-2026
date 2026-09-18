import { apiClient } from '@/lib/apiClient'
import { mockDelay, nextMockId } from '@/lib/mockUtils'
import { IS_MOCK } from '@/config/env'
import { users } from '@/mocks/fixtures/users'
import { riderProfilesByUserId } from '@/mocks/fixtures/riderProfile'
import type { Gender, RiderProfile } from '@/types/entities'

export interface RiderProfileInput {
  name?: string
  vehicleNumber: string
  age: number | null
  gender: Gender | null
  description: string
  photo?: File | null
}

export const riderProfileService = {
  async getMyProfile(userId: number): Promise<RiderProfile | null> {
    if (IS_MOCK) {
      await mockDelay()
      return riderProfilesByUserId[userId] ?? null
    }
    const { data } = await apiClient.get<{ data: RiderProfile }>('/users/me/rider-profile')
    return data.data
  },

  /** First-time onboarding - creates the rider profile and (mock mode) flips the in-memory user's
   * role to delivery-guy so a subsequent login issues a DELIVERY-role token, mirroring the real
   * backend's "role only appears in a fresh token" behavior (see RiderOnboardingPage). */
  async createProfile(userId: number, payload: RiderProfileInput): Promise<RiderProfile> {
    if (IS_MOCK) {
      await mockDelay()
      const user = users.find((u) => u.id === userId)
      const photo = payload.photo ? URL.createObjectURL(payload.photo) : null
      const profile: RiderProfile = {
        id: riderProfilesByUserId[userId]?.id ?? nextMockId(),
        userId,
        name: payload.name ?? riderProfilesByUserId[userId]?.name ?? user?.name ?? 'New Rider',
        email: user?.email ?? '',
        phone: user?.phone ?? '',
        photo: photo ?? riderProfilesByUserId[userId]?.photo ?? null,
        vehicleNumber: payload.vehicleNumber,
        age: payload.age,
        gender: payload.gender,
        description: payload.description,
        commissionRate: riderProfilesByUserId[userId]?.commissionRate ?? 80,
        maxAcceptDeliveryLimit: riderProfilesByUserId[userId]?.maxAcceptDeliveryLimit ?? 1,
        rating: riderProfilesByUserId[userId]?.rating ?? 0,
        isNotifiable: riderProfilesByUserId[userId]?.isNotifiable ?? true,
        isOnline: riderProfilesByUserId[userId]?.isOnline ?? false,
        isActive: true,
      }
      riderProfilesByUserId[userId] = profile
      if (user) {
        user.role = 'delivery-guy'
        if (payload.name) user.name = payload.name
      }
      return profile
    }
    // Plain JSON - the backend's RiderProfileRequest carries no photo field, since a photo is a
    // file, not JSON (see uploadPhoto below). Onboarding still lets the rider pick a photo in the
    // same form for a smooth UX, so if one was chosen, upload it as a second call right after the
    // profile itself is created.
    const { data } = await apiClient.post<{ data: RiderProfile }>('/users/me/rider-profile', {
      name: payload.name,
      vehicleNumber: payload.vehicleNumber,
      age: payload.age != null ? String(payload.age) : null,
      gender: payload.gender,
      description: payload.description,
    })
    if (payload.photo) return riderProfileService.uploadPhoto(payload.photo)
    return data.data
  },

  /** Partial update of the rider's own profile fields, post-onboarding - PUT to the same
   * resource, distinct from createProfile's POST (which the backend rejects once a profile
   * already exists). Photo, again, goes through uploadPhoto separately if one was picked. */
  async updateProfile(userId: number, payload: RiderProfileInput): Promise<RiderProfile> {
    if (IS_MOCK) {
      // createProfile's mock branch already upserts (no "already exists" rejection like the real
      // backend), and already turns payload.photo into an object-URL preview itself - reuse it
      // as-is rather than routing through the live-only uploadPhoto split.
      return riderProfileService.createProfile(userId, payload)
    }
    const { data } = await apiClient.put<{ data: RiderProfile }>('/users/me/rider-profile', {
      name: payload.name,
      vehicleNumber: payload.vehicleNumber,
      age: payload.age != null ? String(payload.age) : null,
      gender: payload.gender,
      description: payload.description,
    })
    if (payload.photo) return riderProfileService.uploadPhoto(payload.photo)
    return data.data
  },

  /** Separate multipart action, mirroring the customer app's own profile-photo upload - a file is
   * never smuggled into a JSON profile-fields request. */
  async uploadPhoto(file: File): Promise<RiderProfile> {
    if (IS_MOCK) {
      await mockDelay()
      throw { message: 'uploadPhoto should not be called directly in mock mode - createProfile/updateProfile handle the mock photo preview themselves.' }
    }
    const formData = new FormData()
    formData.append('file', file)
    const { data } = await apiClient.post<{ data: RiderProfile }>('/users/me/rider-profile/photo', formData)
    return data.data
  },
}
