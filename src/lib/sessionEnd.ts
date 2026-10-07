import { AUTH_REFRESH_TOKEN_STORAGE_KEY, AUTH_TOKEN_STORAGE_KEY, AUTH_USER_STORAGE_KEY } from '@/config/env'
import { removeStorage } from '@/lib/storage'

const NOTICE_KEY = 'pureeats.signedOutNotice'
/** Backend errorCode for a user blocked/deactivated by an admin (see AccountAccessGuard). */
export const ACCOUNT_BLOCKED = 'ACCOUNT_BLOCKED'
/** Every token issued before the user chose "log out of all devices" is rejected with this. */
export const SESSION_REVOKED = 'SESSION_REVOKED'
/** Error codes that end the session immediately, with the server's message shown on the sign-in page. */
export const FORCED_SIGN_OUT_CODES = [ACCOUNT_BLOCKED, SESSION_REVOKED]

let ending = false

/**
 * The session can't continue (the account was blocked, or the refresh token is no longer valid):
 * clear the stored tokens AND reload, so the app's in-memory signed-in state goes too - clearing
 * storage alone left the app looking signed in with every request failing. Blocked users land on
 * the sign-in page with the reason shown; anyone else just reloads signed out.
 */
export function endSession(blockedMessage?: string | null) {
  if (ending) return
  ending = true
  removeStorage(AUTH_TOKEN_STORAGE_KEY)
  removeStorage(AUTH_REFRESH_TOKEN_STORAGE_KEY)
  removeStorage(AUTH_USER_STORAGE_KEY)
  if (blockedMessage) {
    try {
      window.sessionStorage.setItem(NOTICE_KEY, blockedMessage)
    } catch {
      // storage unavailable - the sign-in page just won't show the reason
    }
    window.location.replace('/login')
  } else {
    window.location.reload()
  }
}

/** One-time message for the sign-in page, e.g. "Your account has been blocked". */
export function takeSignedOutNotice(): string | null {
  try {
    const notice = window.sessionStorage.getItem(NOTICE_KEY)
    if (notice) window.sessionStorage.removeItem(NOTICE_KEY)
    return notice
  } catch {
    return null
  }
}
