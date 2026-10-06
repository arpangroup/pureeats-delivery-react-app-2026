/**
 * New-order alert sound. Plays the admin-uploaded file (Settings -> General -> Order alert sound,
 * public setting `order_alert_sound_url`) when one is configured, and falls back to a built-in
 * two-tone chime synthesized with the Web Audio API - no asset to download or fail to load - when
 * none is set or the file can't be played.
 *
 * Browsers block audio until the page has had a user gesture. {@link installAudioUnlock} listens for
 * the first tap/key press and "unlocks" both a shared AudioContext and the <audio> element there, so
 * later alerts - fired from a poll or a push, with no gesture of their own - are actually audible.
 * Creating a fresh AudioContext per alert (what this used to do) starts it "suspended" outside a
 * gesture, which is why alerts were silent.
 */

type AudioContextCtor = typeof window.AudioContext
type SharedAudioContext = InstanceType<AudioContextCtor>

let audioContext: SharedAudioContext | null = null
const createAudioElement = () => document.createElement('audio')
let audioElement: ReturnType<typeof createAudioElement> | null = null
let customSoundUrl: string | null = null
let unlockInstalled = false
let ringTimer: ReturnType<typeof setInterval> | null = null

function getAudioContext(): SharedAudioContext | null {
  if (audioContext) return audioContext
  const Ctor: AudioContextCtor | undefined =
    window.AudioContext || (window as unknown as { webkitAudioContext?: AudioContextCtor }).webkitAudioContext
  if (!Ctor) return null
  try {
    audioContext = new Ctor()
  } catch {
    audioContext = null
  }
  return audioContext
}

function getAudioElement(): ReturnType<typeof createAudioElement> {
  if (!audioElement) {
    audioElement = createAudioElement()
    audioElement.preload = 'auto'
  }
  return audioElement
}

/** Sets (or clears, with null/blank) the admin-configured sound. Preloads it so the first alert plays without a fetch delay. */
export function setCustomOrderSoundUrl(url: string | null | undefined): void {
  const next = url && url.trim() ? url.trim() : null
  if (next === customSoundUrl) return
  customSoundUrl = next
  const el = getAudioElement()
  if (next) {
    el.src = next
    el.load()
  } else {
    el.removeAttribute('src')
  }
}

export function getCustomOrderSoundUrl(): string | null {
  return customSoundUrl
}

/** Call inside a user-gesture handler (or let {@link installAudioUnlock} do it) to allow later, gesture-less playback. */
export function unlockAudio(): void {
  const ctx = getAudioContext()
  if (ctx && ctx.state === 'suspended') ctx.resume().catch(() => undefined)
  const el = getAudioElement()
  if (customSoundUrl && el.paused) {
    // Play muted for an instant - this is what grants the element autoplay permission on iOS/Chrome.
    el.muted = true
    el.play()
      .then(() => {
        el.pause()
        el.currentTime = 0
        el.muted = false
      })
      .catch(() => {
        el.muted = false
      })
  }
}

/** Installs one-time-ish gesture listeners that unlock audio. Safe to call repeatedly. */
export function installAudioUnlock(): void {
  if (unlockInstalled || typeof window === 'undefined') return
  unlockInstalled = true
  const handler = () => unlockAudio()
  // Kept registered (not `once`): the AudioContext can get re-suspended after the app is
  // backgrounded on mobile, and the next tap needs to resume it again.
  window.addEventListener('pointerdown', handler, { passive: true })
  window.addEventListener('keydown', handler)
  window.addEventListener('touchstart', handler, { passive: true })
}

/** The built-in fallback chime - always available, no download. */
export function playDefaultChime(): void {
  try {
    const ctx = getAudioContext()
    if (!ctx) return
    if (ctx.state === 'suspended') ctx.resume().catch(() => undefined)
    const playTone = (frequency: number, startOffset: number, duration: number) => {
      const oscillator = ctx.createOscillator()
      const gain = ctx.createGain()
      oscillator.type = 'sine'
      oscillator.frequency.value = frequency
      const startAt = ctx.currentTime + startOffset
      gain.gain.setValueAtTime(0, startAt)
      gain.gain.linearRampToValueAtTime(0.3, startAt + 0.02)
      gain.gain.exponentialRampToValueAtTime(0.001, startAt + duration)
      oscillator.connect(gain)
      gain.connect(ctx.destination)
      oscillator.start(startAt)
      oscillator.stop(startAt + duration + 0.05)
    }
    playTone(880, 0, 0.18)
    playTone(1174.66, 0.16, 0.22)
    playTone(880, 0.5, 0.18)
    playTone(1174.66, 0.66, 0.22)
  } catch {
    // Audio still locked (no gesture yet) - the visible alert still shows.
  }
}

/** Plays the configured sound once, falling back to the default chime if there is none or it fails. */
export function playOrderSound(): void {
  if (!customSoundUrl) {
    playDefaultChime()
    return
  }
  const el = getAudioElement()
  try {
    el.muted = false
    el.currentTime = 0
    const result = el.play()
    if (result) result.catch(() => playDefaultChime())
  } catch {
    playDefaultChime()
  }
}

/** Plays the sound now and repeats it every `intervalMs` until {@link stopRinging}. */
export function startRinging(intervalMs = 4000): void {
  stopRinging()
  playOrderSound()
  ringTimer = setInterval(playOrderSound, intervalMs)
}

export function stopRinging(): void {
  if (ringTimer) {
    clearInterval(ringTimer)
    ringTimer = null
  }
  if (audioElement && !audioElement.paused) {
    audioElement.pause()
    audioElement.currentTime = 0
  }
}
