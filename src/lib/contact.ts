/** Phone-only accounts get an internal placeholder email (e.g. 9876543210@otp.pureeats.local) - never show it. */
const PLACEHOLDER_EMAIL_DOMAIN = '@otp.pureeats.local'

export function isPlaceholderEmail(email: string | null | undefined): boolean {
  return !!email && email.toLowerCase().endsWith(PLACEHOLDER_EMAIL_DOMAIN)
}

/** The email to show, or '' for none / a placeholder. */
export function displayEmail(email: string | null | undefined): string {
  return email && !isPlaceholderEmail(email) ? email : ''
}

/** The default name of an OTP sign-up - not a real name, so the onboarding form starts empty instead. */
export const PLACEHOLDER_NAME = 'PureEats User'

export function realName(name: string | null | undefined): string {
  return name && name.trim() && name.trim().toLowerCase() !== PLACEHOLDER_NAME.toLowerCase() ? name : ''
}
