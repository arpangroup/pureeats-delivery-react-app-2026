import { apiClient } from '@/lib/apiClient'
import { mockDelay, nextMockId } from '@/lib/mockUtils'
import { IS_MOCK } from '@/config/env'
import { users } from '@/mocks/fixtures/users'
import type { User } from '@/types/entities'
import type { LoginChallengeResponse } from '@/types/auth'

// Mirrors authService.ts's mock-OTP-challenge simulation, scoped to the profile phone/email change
// flow - same "123456" code in mock mode as everywhere else in this app.
interface MockContactChallenge {
  userId: number
  field: 'phone' | 'email'
  value: string
}
const mockContactChallenges = new Map<string, MockContactChallenge>()
const MOCK_OTP = '123456'

function maskDestination(value: string): string {
  if (value.includes('@')) {
    const [local, domain] = value.split('@')
    return `${local.slice(0, 2)}***@${domain}`
  }
  return `${'*'.repeat(Math.max(0, value.length - 2))}${value.slice(-2)}`
}

function mockChallengeResponse(challengeId: string, destination: string): LoginChallengeResponse {
  return { success: true, message: 'OTP sent (mock mode - use 123456).', challengeId, maskedDestination: maskDestination(destination), expiresIn: 300, resendAvailableIn: 10 }
}

export const userService = {
  async getMe(userId: number): Promise<User> {
    if (IS_MOCK) {
      await mockDelay()
      const user = users.find((u) => u.id === userId)
      if (!user) throw { message: 'User not found.' }
      return user
    }
    const { data } = await apiClient.get<{ data: User }>('/users/me')
    return data.data
  },

  async uploadPhoto(file: File): Promise<User> {
    if (IS_MOCK) {
      await mockDelay()
      const user = users[0]
      user.photo = URL.createObjectURL(file)
      return user
    }
    const formData = new FormData()
    formData.append('file', file)
    const { data } = await apiClient.post<{ data: User }>('/users/me/photo', formData)
    return data.data
  },

  async requestPhoneChange(userId: number, newPhone: string): Promise<LoginChallengeResponse> {
    if (IS_MOCK) {
      await mockDelay()
      const challengeId = `mock-contact-challenge-${nextMockId()}`
      mockContactChallenges.set(challengeId, { userId, field: 'phone', value: newPhone })
      return mockChallengeResponse(challengeId, newPhone)
    }
    const { data } = await apiClient.post<{ data: LoginChallengeResponse }>('/users/me/phone/otp', { destination: newPhone })
    return data.data
  },

  async confirmPhoneChange(challengeId: string, otp: string): Promise<User> {
    if (IS_MOCK) {
      await mockDelay()
      const challenge = mockContactChallenges.get(challengeId)
      if (!challenge) throw { message: 'Challenge not found or expired.' }
      if (otp !== MOCK_OTP) throw { message: `Invalid OTP. Use ${MOCK_OTP} in mock mode.` }
      mockContactChallenges.delete(challengeId)
      const user = users.find((u) => u.id === challenge.userId) ?? users[0]
      user.phone = challenge.value
      return user
    }
    const { data } = await apiClient.post<{ data: User }>('/users/me/phone/verify', { challengeId, otp })
    return data.data
  },

  async requestEmailChange(userId: number, newEmail: string): Promise<LoginChallengeResponse> {
    if (IS_MOCK) {
      await mockDelay()
      const challengeId = `mock-contact-challenge-${nextMockId()}`
      mockContactChallenges.set(challengeId, { userId, field: 'email', value: newEmail })
      return mockChallengeResponse(challengeId, newEmail)
    }
    const { data } = await apiClient.post<{ data: LoginChallengeResponse }>('/users/me/email/otp', { destination: newEmail })
    return data.data
  },

  async confirmEmailChange(challengeId: string, otp: string): Promise<User> {
    if (IS_MOCK) {
      await mockDelay()
      const challenge = mockContactChallenges.get(challengeId)
      if (!challenge) throw { message: 'Challenge not found or expired.' }
      if (otp !== MOCK_OTP) throw { message: `Invalid OTP. Use ${MOCK_OTP} in mock mode.` }
      mockContactChallenges.delete(challengeId)
      const user = users.find((u) => u.id === challenge.userId) ?? users[0]
      user.email = challenge.value
      return user
    }
    const { data } = await apiClient.post<{ data: User }>('/users/me/email/verify', { challengeId, otp })
    return data.data
  },
}
