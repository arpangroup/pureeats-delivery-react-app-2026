import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react'
import { AUTH_REFRESH_TOKEN_STORAGE_KEY, AUTH_TOKEN_STORAGE_KEY, AUTH_USER_STORAGE_KEY, IS_MOCK } from '@/config/env'
import { readStorage, removeStorage, writeStorage } from '@/lib/storage'
import { decodeJwtPayload } from '@/lib/jwt'
import { authService } from '@/services/authService'
import type { User } from '@/types/entities'
import type {
  AccessTokenClaims,
  LoginChallengeRequest,
  LoginChallengeResponse,
  ResendOtpResponse,
  SignupRequest,
  VerifyOtpRequest,
} from '@/types/auth'
import { mapBackendRole } from '@/types/auth'

interface AuthContextValue {
  user: User | null
  isAuthenticated: boolean
  /** True once the JWT actually carries the DELIVERY role - the app shell (AppShell/RequireAuth)
   * only treats a rider as fully logged in once this is true. An authenticated-but-not-yet-a-rider
   * user (isAuthenticated && !isRider) is routed to RiderOnboardingPage instead. */
  isRider: boolean
  isLoading: boolean
  error: string | null
  register: (payload: SignupRequest) => Promise<LoginChallengeResponse>
  requestOtp: (payload: LoginChallengeRequest) => Promise<LoginChallengeResponse>
  verifyOtp: (payload: VerifyOtpRequest) => Promise<User>
  resendOtp: (challengeId: string) => Promise<ResendOtpResponse>
  logout: () => Promise<void>
  logoutAll: () => Promise<void>
  refreshUser: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined)

// A delivery-partner app authenticates by phone/email OTP in both mock and live mode, same as the
// customer app - see src/services/authService.ts for the mock-challenge simulation and the
// DELIVERY-role token-claim shape this decodes.
export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(() => readStorage<User | null>(AUTH_USER_STORAGE_KEY, null))
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const register = useCallback(async (payload: SignupRequest) => {
    setIsLoading(true)
    setError(null)
    try {
      return await authService.register(payload)
    } catch (err) {
      setError((err as { message?: string })?.message ?? 'Unable to register')
      throw err
    } finally {
      setIsLoading(false)
    }
  }, [])

  const requestOtp = useCallback(async (payload: LoginChallengeRequest) => {
    setIsLoading(true)
    setError(null)
    try {
      return await authService.requestOtp(payload)
    } catch (err) {
      setError((err as { message?: string })?.message ?? 'Unable to send OTP')
      throw err
    } finally {
      setIsLoading(false)
    }
  }, [])

  const verifyOtp = useCallback(async (payload: VerifyOtpRequest) => {
    setIsLoading(true)
    setError(null)
    try {
      const tokens = await authService.verifyOtp(payload)
      const claims = decodeJwtPayload<AccessTokenClaims>(tokens.accessToken)
      if (!claims) throw { message: 'Received an unreadable session token.' }
      const verifiedUser: User = {
        id: Number(claims.sub),
        name: claims.name,
        email: claims.email,
        phone: claims.phone ?? '',
        photo: null,
        role: mapBackendRole(claims.role),
        defaultAddressId: null,
        dob: null,
        gender: null,
      }
      writeStorage(AUTH_USER_STORAGE_KEY, verifiedUser)
      writeStorage(AUTH_TOKEN_STORAGE_KEY, tokens.accessToken)
      writeStorage(AUTH_REFRESH_TOKEN_STORAGE_KEY, tokens.refreshToken)
      setUser(verifiedUser)
      return verifiedUser
    } catch (err) {
      setError((err as { message?: string })?.message ?? 'Unable to verify OTP')
      throw err
    } finally {
      setIsLoading(false)
    }
  }, [])

  const resendOtp = useCallback(async (challengeId: string) => {
    try {
      return await authService.resendOtp({ challengeId })
    } catch (err) {
      setError((err as { message?: string })?.message ?? 'Unable to resend OTP')
      throw err
    }
  }, [])

  const logout = useCallback(async () => {
    if (IS_MOCK) {
      await authService.logout()
    } else {
      const refreshToken = readStorage<string | null>(AUTH_REFRESH_TOKEN_STORAGE_KEY, null)
      if (refreshToken) await authService.logoutSession(refreshToken)
    }
    removeStorage(AUTH_USER_STORAGE_KEY)
    removeStorage(AUTH_TOKEN_STORAGE_KEY)
    removeStorage(AUTH_REFRESH_TOKEN_STORAGE_KEY)
    setUser(null)
  }, [])

  const logoutAll = useCallback(async () => {
    await authService.logoutAll()
    removeStorage(AUTH_USER_STORAGE_KEY)
    removeStorage(AUTH_TOKEN_STORAGE_KEY)
    removeStorage(AUTH_REFRESH_TOKEN_STORAGE_KEY)
    setUser(null)
  }, [])

  const refreshUser = useCallback(async () => {
    if (!user) return
    // No dedicated GET /users/me round-trip here (unlike the customer app) - this app's `user`
    // is always fresh off the JWT claims, and profile edits live on RiderProfile (see
    // riderProfileService), not on the base User identity. Kept as a no-op-shaped async function so
    // callers (e.g. after a name change) can still `await refreshUser()` uniformly.
  }, [user])

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      isAuthenticated: !!user,
      isRider: user?.role === 'delivery-guy',
      isLoading,
      error,
      register,
      requestOtp,
      verifyOtp,
      resendOtp,
      logout,
      logoutAll,
      refreshUser,
    }),
    [user, isLoading, error, register, requestOtp, verifyOtp, resendOtp, logout, logoutAll, refreshUser],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
