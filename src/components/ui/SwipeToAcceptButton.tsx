import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react'
import { ChevronsRight, Check } from 'lucide-react'
import { classNames } from '@/lib/format'

const THUMB_SIZE = 48
const THUMB_INSET = 4
/** Fraction of the track the thumb must cross before a release counts as "accepted". */
const ACCEPT_THRESHOLD = 0.85

/**
 * A pill-shaped "swipe to accept" control, built with raw pointer events (no drag library) per the
 * spec - drag the thumb past ~85% of the track and `onAccept` fires; release earlier and it springs
 * back via a CSS transition. Used on the full-screen new-order alert and (in a smaller form) on
 * each row of the manual "browse available orders" list.
 *
 * Mobile notes: the thumb is `touch-action: none` - without it the browser claims a horizontal
 * finger drag as a scroll/pan gesture, fires `pointercancel` a few pixels in, and the swipe never
 * completes (exactly the "nothing happens on my phone" bug). All drag handlers live on the thumb,
 * which holds pointer capture for the whole gesture, and the position is tracked in a ref so the
 * release handler never reads a stale value from the last render on a fast flick.
 */
export function SwipeToAcceptButton({
  label = 'Swipe to accept',
  onAccept,
  disabled = false,
}: {
  label?: string
  onAccept: () => void
  disabled?: boolean
}) {
  const trackRef = useRef<HTMLDivElement>(null)
  const [dragX, setDragX] = useState(0)
  const [dragging, setDragging] = useState(false)
  const [accepted, setAccepted] = useState(false)
  const draggingRef = useRef(false)
  const dragXRef = useRef(0)
  const dragStartClientX = useRef(0)
  const dragStartX = useRef(0)
  const wasDisabled = useRef(disabled)

  function moveTo(x: number) {
    dragXRef.current = x
    setDragX(x)
  }

  // The parent disables the control while its accept call is in flight. If that call FAILS (order
  // already taken, network drop after the app was backgrounded, ...) it re-enables us - spring the
  // thumb back so the rider can retry.
  useEffect(() => {
    if (wasDisabled.current && !disabled && accepted) {
      setAccepted(false)
      moveTo(0)
    }
    wasDisabled.current = disabled
  }, [disabled, accepted])

  function trackMax(): number {
    const track = trackRef.current
    if (!track) return 0
    return Math.max(0, track.clientWidth - THUMB_SIZE - THUMB_INSET * 2)
  }

  function handlePointerDown(e: ReactPointerEvent<HTMLDivElement>) {
    if (disabled || accepted) return
    e.preventDefault()
    draggingRef.current = true
    setDragging(true)
    dragStartClientX.current = e.clientX
    dragStartX.current = dragXRef.current
    try {
      e.currentTarget.setPointerCapture(e.pointerId)
    } catch {
      // capture unsupported - move/up still reach the thumb while the finger stays on it
    }
  }

  function handlePointerMove(e: ReactPointerEvent<HTMLDivElement>) {
    if (!draggingRef.current || disabled || accepted) return
    const delta = e.clientX - dragStartClientX.current
    moveTo(Math.max(0, Math.min(trackMax(), dragStartX.current + delta)))
  }

  function finishDrag() {
    if (!draggingRef.current) return
    draggingRef.current = false
    setDragging(false)
    if (disabled || accepted) return
    const max = trackMax()
    if (max > 0 && dragXRef.current / max >= ACCEPT_THRESHOLD) {
      setAccepted(true)
      moveTo(max)
      onAccept()
    } else {
      moveTo(0)
    }
  }

  return (
    <div
      ref={trackRef}
      className={classNames(
        'relative h-14 w-full select-none overflow-hidden rounded-full bg-brand-100 dark:bg-brand-500/10',
        disabled && 'pointer-events-none opacity-50',
      )}
    >
      <span className="pointer-events-none absolute inset-0 flex items-center justify-center text-sm font-semibold text-brand-700 dark:text-brand-400">
        {accepted ? 'Accepted!' : label}
      </span>
      <div
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={finishDrag}
        onPointerCancel={finishDrag}
        onLostPointerCapture={finishDrag}
        className={classNames(
          'absolute top-1 flex h-12 w-12 cursor-grab touch-none items-center justify-center rounded-full text-white shadow-md',
          accepted ? 'bg-emerald-600' : 'bg-brand-600',
          !dragging && 'transition-transform duration-200 ease-out',
        )}
        style={{ left: THUMB_INSET, transform: `translateX(${dragX}px)`, touchAction: 'none' }}
        role="button"
        aria-label={label}
      >
        {accepted ? <Check size={22} /> : <ChevronsRight size={22} />}
      </div>
    </div>
  )
}
