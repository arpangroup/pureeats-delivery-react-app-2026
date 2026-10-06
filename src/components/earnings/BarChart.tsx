import { useEffect, useRef, useState } from 'react'
import { List, BarChart3 } from 'lucide-react'

export interface BarDatum {
  key: string
  label: string
  value: number
  /** Secondary line in the tooltip/list, e.g. "5 trips". */
  detail?: string
}

const HEIGHT = 140
const TOP_PAD = 8
const RADIUS = 4
const GAP = 2

function roundedTopBar(x: number, y: number, w: number, h: number): string {
  const r = Math.min(RADIUS, w / 2, h)
  return `M${x},${y + h} V${y + r} Q${x},${y} ${x + r},${y} H${x + w - r} Q${x + w},${y} ${x + w},${y + r} V${y + h} Z`
}

/**
 * Single-series bar chart (no legend - the card title names the measure). Bars are the brand hue
 * (validated against both surfaces: brand-600 light, brand-500 dark), anchored to the baseline with
 * 4px rounded data-ends and a 2px gap. Tap/hover a bar to read it; the full-width invisible column
 * behind each bar is the hit target. "List" switches to a plain table of the same values.
 */
export function BarChart({
  data,
  formatValue,
  ariaLabel,
  maxLabels = 8,
  highlightKey,
}: {
  data: BarDatum[]
  formatValue: (v: number) => string
  ariaLabel: string
  /** Only every n-th axis label is shown when there are more bars than this. */
  maxLabels?: number
  /** A bar to show as selected initially (e.g. the current period). */
  highlightKey?: string
}) {
  const [selected, setSelected] = useState<string | null>(highlightKey ?? null)
  const [asList, setAsList] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)
  const [width, setWidth] = useState(320)

  // Drawn in real pixels (viewBox = measured width) so labels never stretch on a wide/narrow screen.
  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const update = () => setWidth(Math.max(160, el.clientWidth))
    update()
    const observer = new window.ResizeObserver(update)
    observer.observe(el)
    return () => observer.disconnect()
  }, [asList])

  const max = Math.max(...data.map((d) => d.value), 0)
  const slot = width / Math.max(data.length, 1)
  const barW = Math.max(4, Math.min(28, slot - GAP))
  const labelEvery = Math.max(1, Math.ceil(data.length / maxLabels))
  const active = data.find((d) => d.key === selected) ?? null

  return (
    <div ref={containerRef}>
      <div className="mb-2 flex min-h-[38px] items-start justify-between gap-2">
        <div className="min-w-0">
          {active ? (
            <>
              <p className="text-sm font-bold text-slate-800 dark:text-slate-100">{formatValue(active.value)}</p>
              <p className="truncate text-xs text-slate-500 dark:text-slate-400">
                {active.label}
                {active.detail ? ` · ${active.detail}` : ''}
              </p>
            </>
          ) : (
            <p className="text-xs text-slate-400 dark:text-slate-500">Tap a bar to see its value</p>
          )}
        </div>
        <button
          type="button"
          onClick={() => setAsList((v) => !v)}
          className="flex shrink-0 items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800"
          aria-pressed={asList}
        >
          {asList ? <BarChart3 size={13} /> : <List size={13} />}
          {asList ? 'Chart' : 'List'}
        </button>
      </div>

      {asList ? (
        <table className="w-full text-sm">
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
            {data.map((d) => (
              <tr key={d.key}>
                <td className="py-1.5 text-slate-600 dark:text-slate-300">{d.label}</td>
                <td className="py-1.5 text-right text-xs text-slate-400">{d.detail}</td>
                <td className="py-1.5 pl-3 text-right font-semibold text-slate-800 dark:text-slate-100">{formatValue(d.value)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <svg
          viewBox={`0 0 ${width} ${HEIGHT + 20}`}
          width={width}
          height={HEIGHT + 20}
          className="block overflow-visible"
          role="img"
          aria-label={ariaLabel}
          onMouseLeave={() => setSelected(highlightKey ?? null)}
        >
          {/* recessive grid: baseline + half-max */}
          <line x1={0} x2={width} y1={HEIGHT} y2={HEIGHT} className="stroke-slate-200 dark:stroke-slate-700" strokeWidth={1} />
          {max > 0 && (
            <line
              x1={0}
              x2={width}
              y1={TOP_PAD + (HEIGHT - TOP_PAD) / 2}
              y2={TOP_PAD + (HEIGHT - TOP_PAD) / 2}
              className="stroke-slate-100 dark:stroke-slate-800"
              strokeDasharray="3 3"
              strokeWidth={1}
             
            />
          )}
          {data.map((d, i) => {
            const h = max > 0 ? ((HEIGHT - TOP_PAD) * d.value) / max : 0
            const x = i * slot + (slot - barW) / 2
            const isActive = d.key === selected
            const dim = selected !== null && !isActive
            return (
              <g key={d.key}>
                <rect
                  x={i * slot}
                  y={0}
                  width={slot}
                  height={HEIGHT}
                  fill="transparent"
                  onClick={() => setSelected(d.key)}
                  onMouseEnter={() => setSelected(d.key)}
                  className="cursor-pointer"
                >
                  <title>{`${d.label}: ${formatValue(d.value)}${d.detail ? ` (${d.detail})` : ''}`}</title>
                </rect>
                {h > 0 && (
                  <path
                    d={roundedTopBar(x, HEIGHT - Math.max(h, 2), barW, Math.max(h, 2))}
                    className={`pointer-events-none fill-brand-600 transition-opacity dark:fill-brand-500 ${dim ? 'opacity-40' : 'opacity-100'}`}
                  />
                )}
                {i % labelEvery === 0 && (
                  <text
                    x={i * slot + slot / 2}
                    y={HEIGHT + 14}
                    textAnchor="middle"
                    className={`pointer-events-none text-[10px] ${isActive ? 'fill-slate-700 font-semibold dark:fill-slate-200' : 'fill-slate-400 dark:fill-slate-500'}`}
                  >
                    {d.label}
                  </text>
                )}
              </g>
            )
          })}
        </svg>
      )}
    </div>
  )
}
