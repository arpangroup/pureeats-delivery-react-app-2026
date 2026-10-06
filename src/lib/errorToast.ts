/**
 * App-wide error toast bus. Anything that fails - an API call, an accept, a background refresh the
 * rider triggered - calls {@link showErrorToast} with the server's message, and <ErrorToaster />
 * (mounted once at the app root, above every overlay) renders it. A plain window event rather than a
 * React context so services/hooks outside the component tree can raise one too.
 */
export const ERROR_TOAST_EVENT = 'pureeats:error-toast'

export function errorMessage(err: unknown, fallback = 'Something went wrong. Please try again.'): string {
  const message = (err as { message?: unknown })?.message
  return typeof message === 'string' && message.trim() ? message : fallback
}

export function showErrorToast(errOrMessage: unknown, fallback?: string): void {
  const message = typeof errOrMessage === 'string' ? errOrMessage : errorMessage(errOrMessage, fallback)
  window.dispatchEvent(new window.CustomEvent<string>(ERROR_TOAST_EVENT, { detail: message }))
}
