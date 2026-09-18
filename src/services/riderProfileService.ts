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
    const formData = new FormData()
    if (payload.name) formData.append('name', payload.name)
    formData.append('vehicleNumber', payload.vehicleNumber)
    if (payload.age != null) formData.append('age', String(payload.age))
    if (payload.gender) formData.append('gender', payload.gender)
    formData.append('description', payload.description)
    if (payload.photo) formData.append('photo', payload.photo)
    const { data } = await apiClient.post<{ data: RiderProfile }>('/users/me/rider-profile', formData)
    return data.data
  },

  /** Profile edits after onboarding. NOTE: the backend does not yet confirm a dedicated
   * PATCH/PUT for rider-profile updates - this re-POSTs to the same upsert endpoint as
   * createProfile, which the backend team has indicated is idempotent today. Revisit once a real
   * update endpoint is confirmed. */
  async updateProfile(userId: number, payload: RiderProfileInput): Promise<RiderProfile> {
    if (IS_MOCK) {
      await mockDelay()
      return riderProfileService.createProfile(userId, payload)
    }
    const formData = new FormData()
    if (payload.name) formData.append('name', payload.name)
    formData.append('vehicleNumber', payload.vehicleNumber)
    if (payload.age != null) formData.append('age', String(payload.age))
    if (payload.gender) formData.append('gender', payload.gender)
    formData.append('description', payload.description)
    if (payload.photo) formData.append('photo', payload.photo)
    const { data } = await apiClient.post<{ data: RiderProfile }>('/users/me/rider-profile', formData)
    return data.data
  },
}
