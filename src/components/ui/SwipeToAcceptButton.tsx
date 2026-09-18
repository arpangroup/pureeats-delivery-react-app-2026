import { useRef, useState, type PointerEvent as ReactPointerEvent } from 'react'
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
  const dragStartClientX = useRef(0)
  const dragStartX = useRef(0)

  function trackMax(): number {
    const track = trackRef.current
    if (!track) return 0
    return Math.max(0, track.clientWidth - THUMB_SIZE - THUMB_INSET * 2)
  }

  function handlePointerDown(e: ReactPointerEvent<HTMLDivElement>) {
    if (disabled || accepted) return
    setDragging(true)
    dragStartClientX.current = e.clientX
    dragStartX.current = dragX
    e.currentTarget.setPointerCapture(e.pointerId)
  }

  function handlePointerMove(e: ReactPointerEvent<HTMLDivElement>) {
    if (!dragging || disabled || accepted) return
    const delta = e.clientX - dragStartClientX.current
    const max = trackMax()
    setDragX(Math.max(0, Math.min(max, dragStartX.current + delta)))
  }

  function finishDrag() {
    if (!dragging || disabled || accepted) return
    setDragging(false)
    const max = trackMax()
    if (max > 0 && dragX / max >= ACCEPT_THRESHOLD) {
      setAccepted(true)
      setDragX(max)
      onAccept()
    } else {
      setDragX(0)
    }
  }

  return (
    <div
      ref={trackRef}
      className={classNames(
        'relative h-14 w-full select-none overflow-hidden rounded-full bg-brand-100 dark:bg-brand-500/10',
        disabled && 'pointer-events-none opacity-50',
      )}
      onPointerMove={handlePointerMove}
      onPointerUp={finishDrag}
      onPointerCancel={finishDrag}
      onPointerLeave={dragging ? finishDrag : undefined}
    >
      <span className="pointer-events-none absolute inset-0 flex items-center justify-center text-sm font-semibold text-brand-700 dark:text-brand-400">
        {accepted ? 'Accepted!' : label}
      </span>
      <div
        onPointerDown={handlePointerDown}
        className={classNames(
          'absolute top-1 flex h-12 w-12 items-center justify-center rounded-full text-white shadow-md',
          accepted ? 'bg-emerald-600' : 'bg-brand-600',
          !dragging && 'transition-transform duration-200 ease-out',
        )}
        style={{ left: THUMB_INSET, transform: `translateX(${dragX}px)` }}
        role="button"
        aria-label={label}
      >
        {accepted ? <Check size={22} /> : <ChevronsRight size={22} />}
      </div>
    </div>
  )
}
