/**
 * New-order alert sound. Plays the admin-uploaded file (Settings -> General -> Order alert sound,
 * public setting `order_alert_sound_url`) when one is configured, and falls back to a built-in
 * two-tone chime synthesized with the Web Audio API - no asset to download or fail to load - when
 * none is set or the file can't be played.
 *
 * The uploaded file is fetched once and decoded into an AudioBuffer, then played through the SAME
 * AudioContext as the chime. That matters: browsers apply autoplay rules to an <audio> element
 * separately from Web Audio, so playing the file through an <audio> element (the previous approach)
 * could be refused - e.g. after a page reload before the next click - while the chime still played,
 * which is why dashboards kept hearing the default chime despite a custom sound being configured.
 * Now, whenever the chime would be audible, the custom sound is too. An <audio> element remains only
 * as a last resort while the file is still downloading/decoding.
 *
 * Browsers still need one user gesture per page load before ANY sound: {@link installAudioUnlock}
 * resumes the shared AudioContext on every tap/key press.
 */

type AudioContextCtor = typeof window.AudioContext
type SharedAudioContext = InstanceType<AudioContextCtor>
type SoundSource = ReturnType<SharedAudioContext['createBufferSource']>
type DecodedSound = Awaited<ReturnType<SharedAudioContext['decodeAudioData']>>

const createAudioElement = () => document.createElement('audio')

let audioContext: SharedAudioContext | null = null
let audioElement: ReturnType<typeof createAudioElement> | null = null
let customSoundUrl: string | null = null
let customBuffer: DecodedSound | null = null
let currentSource: SoundSource | null = null
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

function resumeContext(ctx: SharedAudioContext) {
  if (ctx.state === 'suspended') ctx.resume().catch(() => undefined)
}

function getAudioElement(): ReturnType<typeof createAudioElement> {
  if (!audioElement) {
    audioElement = createAudioElement()
    audioElement.preload = 'auto'
  }
  return audioElement
}

async function loadCustomBuffer(url: string) {
  const ctx = getAudioContext()
  if (!ctx) return
  try {
    const response = await window.fetch(url, { mode: 'cors', cache: 'force-cache' })
    if (!response.ok) throw new Error(`HTTP ${response.status}`)
    const bytes = await response.arrayBuffer()
    const buffer = await ctx.decodeAudioData(bytes)
    if (customSoundUrl === url) customBuffer = buffer
  } catch (err) {
    console.warn('[order-sound] could not load custom sound, will fall back', url, err)
  }
}

/** Sets (or clears, with null/blank) the admin-configured sound, and starts downloading/decoding it so the first alert plays without delay. */
export function setCustomOrderSoundUrl(url: string | null | undefined): void {
  const next = url && url.trim() ? url.trim() : null
  if (next === customSoundUrl) return
  customSoundUrl = next
  customBuffer = null
  const el = getAudioElement()
  if (next) {
    el.src = next
    el.load()
    void loadCustomBuffer(next)
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
  if (ctx) resumeContext(ctx)
}

/** Installs gesture listeners that unlock audio. Safe to call repeatedly. */
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
    resumeContext(ctx)
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

function stopCurrentSource() {
  if (currentSource) {
    try {
      currentSource.stop()
    } catch {
      // already stopped
    }
    currentSource = null
  }
}

function playBuffer(ctx: SharedAudioContext, buffer: DecodedSound) {
  resumeContext(ctx)
  stopCurrentSource()
  const source = ctx.createBufferSource()
  source.buffer = buffer
  source.connect(ctx.destination)
  source.onended = () => {
    if (currentSource === source) currentSource = null
  }
  source.start()
  currentSource = source
}

/** Plays the configured sound once, falling back to the default chime if there is none or it fails. */
export function playOrderSound(): void {
  if (!customSoundUrl) {
    playDefaultChime()
    return
  }
  const ctx = getAudioContext()
  if (ctx && customBuffer) {
    try {
      playBuffer(ctx, customBuffer)
      return
    } catch (err) {
      console.warn('[order-sound] Web Audio playback failed, trying <audio>', err)
    }
  }
  // Buffer not decoded yet (or Web Audio unavailable) - try the element, chime as the last resort.
  const el = getAudioElement()
  try {
    el.muted = false
    el.currentTime = 0
    const result = el.play()
    if (result)
      result.catch((err) => {
        console.warn('[order-sound] <audio> playback refused, playing default chime', err)
        playDefaultChime()
      })
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
  stopCurrentSource()
  if (audioElement && !audioElement.paused) {
    audioElement.pause()
    audioElement.currentTime = 0
  }
}
