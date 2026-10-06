import { useEffect, useRef } from 'react'

/**
 * Calls `callback` whenever the app comes back to the foreground - tab made visible again, window
 * re-focused, page restored from the back/forward cache, or the network reconnecting. Mobile
 * browsers freeze or heavily throttle timers while a PWA is backgrounded, so anything that polls
 * must also catch up immediately on resume instead of waiting for its next (possibly minutes-late)
 * tick. Debounced so the burst of events a single resume fires only triggers one call.
 */
export function useOnResume(callback: () => void) {
  const callbackRef = useRef(callback)
  callbackRef.current = callback

  useEffect(() => {
    let last = 0
    const fire = () => {
      if (document.visibilityState !== 'visible') return
      const now = Date.now()
      if (now - last < 1500) return
      last = now
      callbackRef.current()
    }
    document.addEventListener('visibilitychange', fire)
    window.addEventListener('focus', fire)
    window.addEventListener('pageshow', fire)
    window.addEventListener('online', fire)
    return () => {
      document.removeEventListener('visibilitychange', fire)
      window.removeEventListener('focus', fire)
      window.removeEventListener('pageshow', fire)
      window.removeEventListener('online', fire)
    }
  }, [])
}
