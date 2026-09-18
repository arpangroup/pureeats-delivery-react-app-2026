export function formatCurrency(amount: number, currency = 'INR'): string {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency,
    maximumFractionDigits: 2,
  }).format(amount || 0)
}

export function formatDate(value: string | null | undefined, withTime = true): string {
  if (!value) return '-'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '-'
  return new Intl.DateTimeFormat('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    ...(withTime ? { hour: '2-digit', minute: '2-digit' } : {}),
  }).format(date)
}

export function timeAgo(value: string | null | undefined): string {
  if (!value) return '-'
  const date = new Date(value).getTime()
  if (Number.isNaN(date)) return '-'
  const seconds = Math.floor((Date.now() - date) / 1000)
  const ranges: [number, string][] = [
    [60, 'sec'],
    [60, 'min'],
    [24, 'hr'],
    [30, 'day'],
    [12, 'month'],
  ]
  let value_ = seconds
  let unit = 'sec'
  for (const [size, label] of ranges) {
    if (value_ < size) {
      unit = label
      break
    }
    value_ = Math.floor(value_ / size)
    unit = label
  }
  if (seconds < 60) return 'just now'
  return `${value_} ${unit}${value_ !== 1 ? 's' : ''} ago`
}

export function initials(name: string): string {
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('')
}

export function classNames(...values: Array<string | false | null | undefined>): string {
  return values.filter(Boolean).join(' ')
}

/** Parses a wire value that may be a numeric string (BigDecimal serialized as String by the backend) or already a number. */
export function toNumber(value: string | number | null | undefined, fallback = 0): number {
  if (value === null || value === undefined) return fallback
  const n = typeof value === 'string' ? Number(value) : value
  return Number.isFinite(n) ? n : fallback
}

/** Haversine distance in km between two lat/lng points - used to compute AvailableOrder.distanceKm for mock fixtures. */
export function distanceKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371
  const dLat = ((lat2 - lat1) * Math.PI) / 180
  const dLng = ((lng2 - lng1) * Math.PI) / 180
  const a = Math.sin(dLat / 2) ** 2 + Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
  return Math.round(R * c * 10) / 10
}
