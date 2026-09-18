// Mirrors the real backend's OTP-challenge auth contract (pureeats-user-service AuthController /
// dto/*). Field names match the JSON the Spring Boot API actually returns/expects - this file is a
// verbatim port from the admin panel (pureeats-admin-react-app-2026), since that app is the one
// that already has the DELIVERY role wired into mapBackendRole/mapFrontendRole (the customer app's
// own copy only knows CUSTOMER).
import type { User } from './entities'

export interface SignupRequest {
  fullName: string
  email: string
}

export type LoginChallengeRequest =
  | { method: 'EMAIL'; email: string }
  | { method: 'PHONE'; countryId: number; phone: string }

export interface LoginChallengeResponse {
  success: boolean
  message: string
  challengeId: string
  maskedDestination: string
  expiresIn: number
  resendAvailableIn: number
}

export interface VerifyOtpRequest {
  challengeId: string
  otp: string
}

export interface AuthTokenResponse {
  accessToken: string
  refreshToken: string
  tokenType: 'Bearer'
  expiresIn: number
}

export interface ResendOtpRequest {
  challengeId: string
}

export interface ResendOtpResponse {
  success: boolean
  message: string
  expiresIn: number
  resendAvailableIn: number
}

export interface RefreshTokenRequest {
  refreshToken: string
}

/** JWT `role` claim values (com.pureeats.domain.enums.Role). */
export type BackendRole = 'SUPER_ADMIN' | 'ADMIN' | 'STORE_OWNER' | 'DELIVERY' | 'CUSTOMER' | 'EMPLOYEE'

export interface AccessTokenClaims {
  sub: string
  name: string
  email: string
  phone: string | null
  role: BackendRole
  deliveryGuyDetailId?: number
  iat: number
  exp: number
}

const roleMap: Record<BackendRole, User['role']> = {
  SUPER_ADMIN: 'admin',
  ADMIN: 'admin',
  STORE_OWNER: 'restaurant-owner',
  DELIVERY: 'delivery-guy',
  CUSTOMER: 'customer',
  EMPLOYEE: 'employee',
}

export function mapBackendRole(role: BackendRole): User['role'] {
  return roleMap[role] ?? 'customer'
}

const backendRoleMap: Record<User['role'], BackendRole> = {
  admin: 'ADMIN',
  employee: 'EMPLOYEE',
  'restaurant-owner': 'STORE_OWNER',
  'delivery-guy': 'DELIVERY',
  customer: 'CUSTOMER',
}

/** Inverse of {@link mapBackendRole}. */
export function mapFrontendRole(role: User['role']): BackendRole {
  return backendRoleMap[role]
}
