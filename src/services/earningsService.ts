import { apiClient } from '@/lib/apiClient'
import { mockDelay } from '@/lib/mockUtils'
import { toNumber } from '@/lib/format'
import { IS_MOCK } from '@/config/env'
import type {
  AnalyticsBucket,
  AnalyticsPeriod,
  AnalyticsTotals,
  RiderEarning,
  RiderEarningsAnalytics,
  RiderEarningsSummary,
  RiderSettlement,
  RiderWalletTransaction,
  SettlementDirection,
} from '@/types/entities'

/**
 * The rider's money: per-trip earnings, pending settlement (earned but not yet paid out, plus COD
 * cash held), settlements recorded by an admin, analytics and the linked wallet ledger. Live mode
 * reads the /delivery/earnings*, /delivery/settlements* and /delivery/wallet/transactions
 * endpoints; mock mode derives the same shapes from a deterministic set of fake trips.
 */

// ---- date helpers (local dates as yyyy-MM-dd, matching the backend's LocalDate) ----
export function isoDate(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}
function parseDate(s: string): Date {
  const [y, m, d] = s.split('-').map(Number)
  return new Date(y, m - 1, d)
}
function addDays(d: Date, n: number): Date {
  const out = new Date(d)
  out.setDate(out.getDate() + n)
  return out
}

// ---- mock data -------------------------------------------------------------------------------
const MOCK_RESTAURANTS = ['Meghana Foods - Indiranagar', 'Truffles - Koramangala', 'Empire Restaurant - Church Street', 'Nagarjuna - Residency Road']

function seeded(seed: number) {
  let s = seed
  return () => {
    s = (s * 9301 + 49297) % 233280
    return s / 233280
  }
}

function buildMockTrips(): RiderEarning[] {
  const rand = seeded(7)
  const trips: RiderEarning[] = []
  const today = new Date()
  let id = 1
  for (let dayOffset = 89; dayOffset >= 0; dayOffset--) {
    const day = addDays(today, -dayOffset)
    const count = rand() < 0.15 ? 0 : Math.floor(rand() * 7) + 1
    for (let i = 0; i < count; i++) {
      const at = new Date(day)
      at.setHours(11 + Math.floor(rand() * 11), Math.floor(rand() * 60))
      if (dayOffset === 0 && at > today) continue
      const total = Math.round(180 + rand() * 600)
      const cod = rand() < 0.35
      const earning = Math.round(total * 0.1 * 100) / 100
      trips.push({
        tripId: id,
        orderId: 5000 + id,
        uniqueOrderId: `PE-${5000 + id}`,
        restaurantName: MOCK_RESTAURANTS[Math.floor(rand() * MOCK_RESTAURANTS.length)],
        customerAddress: 'HSR Layout, Bengaluru',
        deliveredAt: at.toISOString(),
        distanceKm: Math.round((1 + rand() * 6) * 10) / 10,
        orderTotal: total,
        deliveryCharge: 30,
        paymentMode: cod ? 'COD' : 'RAZORPAY',
        commissionRate: 10,
        commissionBasis: 'FULL_ORDER',
        commissionBase: total,
        rateIsCurrent: false,
        earning,
        codCollected: cod ? total : 0,
        settled: dayOffset > 6,
        settlementId: dayOffset > 6 ? Math.floor(dayOffset / 7) : null,
        settledAt: dayOffset > 6 ? addDays(day, 7 - (dayOffset % 7)).toISOString() : null,
      })
      id++
    }
  }
  return trips.reverse()
}

let mockTrips: RiderEarning[] | null = null
function trips(): RiderEarning[] {
  if (!mockTrips) mockTrips = buildMockTrips()
  return mockTrips
}

const sum = (list: RiderEarning[], f: (t: RiderEarning) => number) => Math.round(list.reduce((a, t) => a + f(t), 0) * 100) / 100
const direction = (net: number): SettlementDirection => (net > 0 ? 'PAID_TO_RIDER' : net < 0 ? 'COLLECTED_FROM_RIDER' : 'EVEN')

function mockSettlements(): RiderSettlement[] {
  const byId = new Map<number, RiderEarning[]>()
  trips().filter((t) => t.settlementId !== null).forEach((t) => byId.set(t.settlementId!, [...(byId.get(t.settlementId!) ?? []), t]))
  return [...byId.entries()]
    .map(([id, list]) => {
      const earnings = sum(list, (t) => t.earning)
      const cod = sum(list, (t) => t.codCollected)
      return {
        id,
        earningsAmount: earnings,
        codAmount: cod,
        netAmount: Math.round((earnings - cod) * 100) / 100,
        direction: direction(earnings - cod),
        tripCount: list.length,
        transactionMode: 'UPI',
        transactionReference: `UTR${100000 + id}`,
        note: null,
        createdAt: list[0].settledAt!,
      }
    })
    .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))
}

function inRange(list: RiderEarning[], from: Date, to: Date) {
  const start = from.getTime()
  const end = addDays(to, 1).getTime()
  return list.filter((t) => {
    const at = new Date(t.deliveredAt).getTime()
    return at >= start && at < end
  })
}

function totals(list: RiderEarning[]): AnalyticsTotals {
  const earnings = sum(list, (t) => t.earning)
  const distance = sum(list, (t) => t.distanceKm)
  return {
    earnings,
    trips: list.length,
    averagePerTrip: list.length ? Math.round((earnings / list.length) * 100) / 100 : 0,
    distanceKm: distance,
    averageDistanceKm: list.length ? Math.round((distance / list.length) * 100) / 100 : 0,
    codCollected: sum(list, (t) => t.codCollected),
    activeDays: new Set(list.map((t) => isoDate(new Date(t.deliveredAt)))).size,
  }
}

function mondayOf(d: Date): Date {
  const out = new Date(d.getFullYear(), d.getMonth(), d.getDate())
  out.setDate(out.getDate() - ((out.getDay() + 6) % 7))
  return out
}

function series(list: RiderEarning[], from: Date, to: Date, size: 'DAY' | 'WEEK' | 'MONTH'): AnalyticsBucket[] {
  const out: AnalyticsBucket[] = []
  const shortSpan = (to.getTime() - from.getTime()) / 86_400_000 < 7
  let cursor = size === 'WEEK' ? mondayOf(from) : size === 'MONTH' ? new Date(from.getFullYear(), from.getMonth(), 1) : new Date(from)
  const todayIso = isoDate(new Date())
  while (cursor <= to) {
    const next = size === 'WEEK' ? addDays(cursor, 7) : size === 'MONTH' ? new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1) : addDays(cursor, 1)
    const bFrom = cursor < from ? from : cursor
    const lastDay = addDays(next, -1)
    const bTo = lastDay > to ? to : lastDay
    const label =
      size === 'MONTH'
        ? cursor.toLocaleDateString('en-IN', { month: 'short' })
        : size === 'DAY' && isoDate(bFrom) === todayIso
          ? 'Today'
          : size === 'DAY' && shortSpan
            ? bFrom.toLocaleDateString('en-IN', { weekday: 'short' })
            : bFrom.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })
    const inB = inRange(list, bFrom, bTo)
    out.push({ label, from: isoDate(bFrom), to: isoDate(bTo), earnings: sum(inB, (t) => t.earning), trips: inB.length })
    cursor = next
  }
  return out
}

function mockAnalytics(period: AnalyticsPeriod, fromIso?: string, toIso?: string): RiderEarningsAnalytics {
  const all = trips()
  const today = new Date(new Date().getFullYear(), new Date().getMonth(), new Date().getDate())
  let from: Date, to: Date, pFrom: Date, pTo: Date, size: 'DAY' | 'WEEK' | 'MONTH', buckets: AnalyticsBucket[]
  if (period === 'WEEK') {
    from = mondayOf(today)
    to = addDays(from, 6)
    pFrom = addDays(from, -7)
    pTo = addDays(from, -1)
    size = 'WEEK'
    buckets = series(all, addDays(from, -49), to, 'WEEK')
  } else if (period === 'MONTH') {
    from = new Date(today.getFullYear(), today.getMonth(), 1)
    to = new Date(today.getFullYear(), today.getMonth() + 1, 0)
    pFrom = new Date(today.getFullYear(), today.getMonth() - 1, 1)
    pTo = addDays(from, -1)
    size = 'MONTH'
    buckets = series(all, new Date(today.getFullYear(), today.getMonth() - 5, 1), to, 'MONTH')
  } else if (period === 'CUSTOM' && fromIso && toIso) {
    from = parseDate(fromIso)
    to = parseDate(toIso)
    const days = Math.round((to.getTime() - from.getTime()) / 86_400_000) + 1
    pTo = addDays(from, -1)
    pFrom = addDays(pTo, -(days - 1))
    size = days <= 31 ? 'DAY' : days <= 124 ? 'WEEK' : 'MONTH'
    buckets = series(all, from, to, size)
  } else {
    from = today
    to = today
    pFrom = addDays(today, -1)
    pTo = pFrom
    size = 'DAY'
    buckets = series(all, addDays(today, -6), today, 'DAY')
  }
  const inPeriod = inRange(all, from, to)
  const current = totals(inPeriod)
  const previous = totals(inRange(all, pFrom, pTo))
  const best = buckets.filter((b) => b.earnings > 0).sort((a, b) => b.earnings - a.earnings)[0] ?? null
  const weekdayNames = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
  const byRestaurant = new Map<string, RiderEarning[]>()
  inPeriod.forEach((t) => byRestaurant.set(t.restaurantName, [...(byRestaurant.get(t.restaurantName) ?? []), t]))
  const cod = inPeriod.filter((t) => t.codCollected > 0)
  return {
    period,
    currentFrom: isoDate(from),
    currentTo: isoDate(to),
    current,
    previousFrom: isoDate(pFrom),
    previousTo: isoDate(pTo),
    previous,
    changePercent: previous.earnings ? Math.round(((current.earnings - previous.earnings) / previous.earnings) * 1000) / 10 : null,
    bucketSize: size,
    buckets,
    bestBucket: best,
    byHour: Array.from({ length: 24 }, (_, hour) => {
      const inH = inPeriod.filter((t) => new Date(t.deliveredAt).getHours() === hour)
      return { hour, earnings: sum(inH, (t) => t.earning), trips: inH.length }
    }),
    byWeekday: weekdayNames.map((label, i) => {
      const inD = inPeriod.filter((t) => (new Date(t.deliveredAt).getDay() + 6) % 7 === i)
      return { label, from: '', to: '', earnings: sum(inD, (t) => t.earning), trips: inD.length }
    }),
    paymentSplit: { codTrips: cod.length, codCollected: sum(cod, (t) => t.codCollected), onlineTrips: inPeriod.length - cod.length },
    topRestaurants: [...byRestaurant.entries()]
      .map(([name, list], i) => ({ restaurantId: i + 1, restaurantName: name, trips: list.length, earnings: sum(list, (t) => t.earning) }))
      .sort((a, b) => b.earnings - a.earnings)
      .slice(0, 5),
  }
}

// ---- live-response normalizers (BigDecimal may arrive as number or string) ------------------
function nEarning(e: RiderEarning): RiderEarning {
  return {
    ...e,
    distanceKm: toNumber(e.distanceKm),
    orderTotal: e.orderTotal == null ? null : toNumber(e.orderTotal),
    deliveryCharge: e.deliveryCharge == null ? null : toNumber(e.deliveryCharge),
    commissionRate: e.commissionRate == null ? null : toNumber(e.commissionRate),
    commissionBase: e.commissionBase == null ? null : toNumber(e.commissionBase),
    earning: toNumber(e.earning),
    codCollected: toNumber(e.codCollected),
  }
}
function nSettlement(s: RiderSettlement): RiderSettlement {
  return { ...s, earningsAmount: toNumber(s.earningsAmount), codAmount: toNumber(s.codAmount), netAmount: toNumber(s.netAmount) }
}
function nTotals(t: AnalyticsTotals): AnalyticsTotals {
  return {
    ...t,
    earnings: toNumber(t.earnings),
    averagePerTrip: toNumber(t.averagePerTrip),
    distanceKm: toNumber(t.distanceKm),
    averageDistanceKm: toNumber(t.averageDistanceKm),
    codCollected: toNumber(t.codCollected),
  }
}
function nBucket(b: AnalyticsBucket): AnalyticsBucket {
  return { ...b, earnings: toNumber(b.earnings) }
}

export const earningsService = {
  async summary(): Promise<RiderEarningsSummary> {
    if (IS_MOCK) {
      await mockDelay()
      const all = trips()
      const pending = all.filter((t) => !t.settled)
      const pendingEarnings = sum(pending, (t) => t.earning)
      const cashInHand = sum(pending, (t) => t.codCollected)
      const lifetime = sum(all, (t) => t.earning)
      const net = Math.round((pendingEarnings - cashInHand) * 100) / 100
      return {
        lifetimeEarnings: lifetime,
        lifetimeTrips: all.length,
        pendingEarnings,
        cashInHand,
        netPending: net,
        netDirection: direction(net),
        unsettledTrips: pending.length,
        settledEarnings: Math.round((lifetime - pendingEarnings) * 100) / 100,
        lastSettlement: mockSettlements()[0] ?? null,
      }
    }
    const { data } = await apiClient.get<{ data: RiderEarningsSummary }>('/delivery/earnings/summary')
    const s = data.data
    return {
      ...s,
      lifetimeEarnings: toNumber(s.lifetimeEarnings),
      pendingEarnings: toNumber(s.pendingEarnings),
      cashInHand: toNumber(s.cashInHand),
      netPending: toNumber(s.netPending),
      settledEarnings: toNumber(s.settledEarnings),
      lastSettlement: s.lastSettlement ? nSettlement(s.lastSettlement) : null,
    }
  },

  async earnings(onlyPending = false): Promise<RiderEarning[]> {
    if (IS_MOCK) {
      await mockDelay()
      return trips().filter((t) => !onlyPending || !t.settled)
    }
    const { data } = await apiClient.get<{ data: RiderEarning[] }>('/delivery/earnings', { params: { pending: onlyPending } })
    return (data.data ?? []).map(nEarning)
  },

  async earningForOrder(orderId: number): Promise<RiderEarning> {
    if (IS_MOCK) {
      await mockDelay(150)
      const found = trips().find((t) => t.orderId === orderId)
      if (!found) throw { message: 'No earning found for this order.' }
      return found
    }
    const { data } = await apiClient.get<{ data: RiderEarning }>(`/delivery/earnings/orders/${orderId}`)
    return nEarning(data.data)
  },

  async analytics(period: AnalyticsPeriod, from?: string, to?: string): Promise<RiderEarningsAnalytics> {
    if (IS_MOCK) {
      await mockDelay()
      return mockAnalytics(period, from, to)
    }
    const { data } = await apiClient.get<{ data: RiderEarningsAnalytics }>('/delivery/earnings/analytics', {
      params: period === 'CUSTOM' ? { period, from, to } : { period },
    })
    const a = data.data
    return {
      ...a,
      current: nTotals(a.current),
      previous: nTotals(a.previous),
      changePercent: a.changePercent == null ? null : toNumber(a.changePercent),
      buckets: a.buckets.map(nBucket),
      bestBucket: a.bestBucket ? nBucket(a.bestBucket) : null,
      byHour: a.byHour.map((h) => ({ ...h, earnings: toNumber(h.earnings) })),
      byWeekday: a.byWeekday.map(nBucket),
      paymentSplit: { ...a.paymentSplit, codCollected: toNumber(a.paymentSplit.codCollected) },
      topRestaurants: a.topRestaurants.map((r) => ({ ...r, earnings: toNumber(r.earnings) })),
    }
  },

  async settlements(): Promise<RiderSettlement[]> {
    if (IS_MOCK) {
      await mockDelay()
      return mockSettlements()
    }
    const { data } = await apiClient.get<{ data: RiderSettlement[] }>('/delivery/settlements')
    return (data.data ?? []).map(nSettlement)
  },

  async settlement(id: number): Promise<RiderSettlement> {
    if (IS_MOCK) {
      await mockDelay(150)
      const found = mockSettlements().find((s) => s.id === id)
      if (!found) throw { message: 'Settlement not found.' }
      return found
    }
    const { data } = await apiClient.get<{ data: RiderSettlement }>(`/delivery/settlements/${id}`)
    return nSettlement(data.data)
  },

  /** Trips covered by one settlement (filtered client-side from the rider's own earnings). */
  async tripsForSettlement(id: number): Promise<RiderEarning[]> {
    return (await earningsService.earnings(false)).filter((t) => t.settlementId === id)
  },

  async walletTransactions(): Promise<RiderWalletTransaction[]> {
    if (IS_MOCK) {
      await mockDelay()
      const earningTx: RiderWalletTransaction[] = trips().slice(0, 40).map((t) => ({
        id: t.tripId,
        type: 'credit',
        amount: t.earning,
        note: `Delivery earning for order #${t.uniqueOrderId}`,
        createdAt: t.deliveredAt,
        kind: 'EARNING',
        orderId: t.orderId,
        uniqueOrderId: t.uniqueOrderId,
        settlementId: null,
      }))
      const settlementTx: RiderWalletTransaction[] = mockSettlements().map((s) => ({
        id: 100000 + s.id,
        type: 'debit',
        amount: s.earningsAmount,
        note: `Settlement #${s.id} - earnings paid out for ${s.tripCount} trip(s)`,
        createdAt: s.createdAt,
        kind: 'SETTLEMENT',
        orderId: null,
        uniqueOrderId: null,
        settlementId: s.id,
      }))
      return [...earningTx, ...settlementTx].sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))
    }
    const { data } = await apiClient.get<{ data: RiderWalletTransaction[] }>('/delivery/wallet/transactions')
    return (data.data ?? []).map((t) => ({ ...t, amount: toNumber(t.amount) }))
  },
}
