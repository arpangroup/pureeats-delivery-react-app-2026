import { apiClient } from '@/lib/apiClient'
import { mockDelay } from '@/lib/mockUtils'
import { IS_MOCK } from '@/config/env'
import { availableOrderTemplates, type AvailableOrderTemplate } from '@/mocks/fixtures/availableOrders'
import { toNumber } from '@/lib/format'
import { activeDeliveryDetailById, MOCK_DELIVERY_PIN } from '@/mocks/fixtures/activeDelivery'
import { deliveryHistory } from '@/mocks/fixtures/history'
import type { ActiveDelivery, AvailableOrder, DeliveryHistoryEntry, PickupPhoto, RiderActivity } from '@/types/entities'

// --- Mock in-memory order-pool simulation -----------------------------
// Simulates the backend "new orders keep arriving" behavior without a server: a rolling window of
// visible orders that ages out and occasionally admits a fresh template, so RiderSessionProvider's polling
// has something new to diff against on its own even with zero user interaction.
const VISIBLE_TTL_MS = 45_000
let visibleOrders: AvailableOrder[] = []
let currentActive: ActiveDelivery | null = null
/** Mock: the kitchen "marks the food ready" this long after the rider accepts, so the gated pickup can be demoed. */
const MOCK_READY_AFTER_MS = 15_000
let mockAcceptedAtMs = 0
let mockPhotos: PickupPhoto[] = []
const mockStatusHistory: RiderActivity['statusHistory'] = []
const sessionHistory: DeliveryHistoryEntry[] = []

function purgeStale() {
  const now = Date.now()
  visibleOrders = visibleOrders.filter((o) => now - new Date(o.createdAt).getTime() < VISIBLE_TTL_MS)
}

/** Mock-only: a deterministic tip for some templates, no server pickup distance (the app computes it from live GPS), drop = route distance. */
function withMockExtras(t: AvailableOrderTemplate, createdAt: string): AvailableOrder {
  return {
    ...t,
    createdAt,
    tipAmount: t.tipAmount ?? [0, 20, 30][t.id % 3],
    pickupDistanceKm: null,
    dropDistanceKm: t.distanceKm,
    orderStatus: t.id % 2 === 0 ? 'READY_FOR_PICKUP' : 'PREPARING',
    paymentMode: t.id % 3 === 0 ? 'COD' : 'RAZORPAY',
    pickupDueAt: new Date(Date.now() + ((t.id % 4) * 4 - 2) * 60_000).toISOString(),
  }
}

/** Live responses from a backend that predates tip/pickup/drop fall back to safe defaults; BigDecimals may arrive as strings. */
function normalizeAvailable(o: AvailableOrder): AvailableOrder {
  const drop = toNumber(o.dropDistanceKm ?? o.distanceKm)
  return {
    ...o,
    distanceKm: toNumber(o.distanceKm),
    payoutEstimate: toNumber(o.payoutEstimate),
    tipAmount: toNumber(o.tipAmount ?? 0),
    pickupDistanceKm: o.pickupDistanceKm == null ? null : toNumber(o.pickupDistanceKm),
    dropDistanceKm: drop,
  }
}

function maybeAdmitNewOrder() {
  const visibleIds = new Set(visibleOrders.map((o) => o.id))
  const candidates = availableOrderTemplates.filter((t) => !visibleIds.has(t.id))
  if (candidates.length === 0) return
  // ~45% chance per poll to admit one new order - frequent enough that a demo left running for
  // 10-20s reliably sees a fresh full-screen alert fire on its own.
  if (Math.random() < 0.45) {
    const template = candidates[Math.floor(Math.random() * candidates.length)]
    visibleOrders = [withMockExtras(template, new Date().toISOString()), ...visibleOrders]
  }
}

const amount = (v: number | string | null | undefined) => (v == null ? undefined : Number(v))

/** Backend sends nullable strings/numbers for a few optional fields - coerce to what the UI expects. */
function normalizeActiveDelivery(d: ActiveDelivery): ActiveDelivery {
  return {
    ...d,
    restaurantContactNumber: d.restaurantContactNumber ?? '',
    customerName: d.customerName ?? 'Customer',
    customerPhone: d.customerPhone ?? '',
    items: d.items ?? [],
    payoutEstimate: Number(d.payoutEstimate ?? 0),
    distanceKm: Number(d.distanceKm ?? 0),
    tipAmount: Number(d.tipAmount ?? 0),
    // The backend calls it `total` (what the customer pays).
    payable: amount(d.payable ?? (d as { total?: number | string }).total),
    // Older backends don't send foodReady - fall back to the statuses they used to allow pickup from.
    foodReady: d.foodReady ?? ['READY_FOR_PICKUP', 'RIDER_ASSIGNED', 'PICKED_UP', 'ON_THE_WAY', 'ARRIVED'].includes(d.status),
    pickupPhotoCount: d.pickupPhotoCount ?? 0,
  }
}

/** Mock: the active order with the simulated kitchen progress applied. */
function mockActiveNow(): ActiveDelivery | null {
  if (!currentActive) return null
  const ready = Date.now() - mockAcceptedAtMs >= MOCK_READY_AFTER_MS
  if (ready && !currentActive.foodReady && currentActive.status === 'PREPARING') {
    currentActive = { ...currentActive, status: 'RIDER_ASSIGNED', foodReady: true }
  }
  return { ...currentActive, pickupPhotoCount: mockPhotos.length }
}

/** "COD" vs "Prepaid" - every non-cash mode (Razorpay, wallet...) is prepaid as far as the rider is concerned. */
export function paymentLabel(mode: string | null | undefined): 'COD' | 'Prepaid' | null {
  if (!mode) return null
  return mode.toUpperCase() === 'COD' ? 'COD' : 'Prepaid'
}

export const MAX_PICKUP_PHOTOS = 3

export const deliveryOrderService = {
  async listAvailable(): Promise<AvailableOrder[]> {
    if (IS_MOCK) {
      await mockDelay(200)
      purgeStale()
      maybeAdmitNewOrder()
      return [...visibleOrders].sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))
    }
    const { data } = await apiClient.get<{ data: AvailableOrder[] }>('/delivery/orders/available')
    return (data.data ?? []).map(normalizeAvailable)
  },

  async accept(orderId: number): Promise<ActiveDelivery> {
    if (IS_MOCK) {
      await mockDelay(200)
      const template = availableOrderTemplates.find((t) => t.id === orderId) ?? visibleOrders.find((o) => o.id === orderId)
      if (!template) throw { message: 'This order is no longer available.' }
      const detail = activeDeliveryDetailById[orderId]
      const now = new Date().toISOString()
      mockAcceptedAtMs = Date.now()
      mockPhotos = []
      const tpl = template as Partial<AvailableOrder>
      currentActive = {
        id: template.id,
        uniqueOrderId: template.uniqueOrderId,
        status: tpl.orderStatus === 'READY_FOR_PICKUP' ? 'RIDER_ASSIGNED' : 'PREPARING',
        foodReady: tpl.orderStatus === 'READY_FOR_PICKUP',
        paymentMode: tpl.paymentMode ?? 'COD',
        payable: Math.round(template.payoutEstimate * 8),
        pickupDueAt: tpl.pickupDueAt ?? new Date(Date.now() + 10 * 60_000).toISOString(),
        pickupPhotoCount: 0,
        restaurantName: template.restaurantName,
        restaurantAddress: template.restaurantAddress,
        restaurantLat: template.restaurantLat,
        restaurantLng: template.restaurantLng,
        restaurantContactNumber: detail?.restaurantContactNumber ?? '080-41200000',
        customerName: detail?.customerName ?? 'Customer',
        customerAddress: template.customerAddress,
        customerLat: template.customerLat,
        customerLng: template.customerLng,
        customerPhone: detail?.customerPhone ?? '9900000000',
        items: detail?.items ?? [{ name: 'Order items', quantity: template.itemsCount }],
        payoutEstimate: template.payoutEstimate,
        tipAmount: 'tipAmount' in template ? template.tipAmount ?? 0 : 0,
        distanceKm: template.distanceKm,
        createdAt: now,
        acceptedAt: now,
        pickedUpAt: null,
        deliveredAt: null,
        mockDeliveryPinHint: MOCK_DELIVERY_PIN,
      }
      visibleOrders = visibleOrders.filter((o) => o.id !== orderId)
      return currentActive
    }
    const { data } = await apiClient.post<{ data: ActiveDelivery }>(`/delivery/orders/${orderId}/accept`)
    return data.data
  },

  /** Re-reads the order from GET /delivery/orders/active after the transition, since the
   * transition endpoints return the customer-facing OrderResponse shape, not ActiveDelivery. */
  async pickup(orderId: number): Promise<ActiveDelivery> {
    if (IS_MOCK) {
      await mockDelay(200)
      const active = mockActiveNow()
      if (!active || active.id !== orderId) throw { message: 'No active delivery matches this order.' }
      if (!active.foodReady) throw { message: "The restaurant hasn't marked this order ready yet - you can mark it picked up once it's ready." }
      if (mockPhotos.length === 0) throw { message: 'Take at least one photo of the packed order before marking it picked up.' }
      currentActive = { ...active, status: 'PICKED_UP', pickedUpAt: new Date().toISOString() }
      return currentActive
    }
    await apiClient.post(`/delivery/orders/${orderId}/pickup`)
    const refreshed = (await deliveryOrderService.getActiveDeliveries()).find((d) => d.id === orderId)
    if (!refreshed) throw { message: 'Marked as picked up, but the order could not be reloaded - pull to refresh.' }
    return refreshed
  },

  /** Tells the customer the partner has reached their location (PICKED_UP/ON_THE_WAY -> ARRIVED). */
  async arrived(orderId: number): Promise<void> {
    if (IS_MOCK) {
      await mockDelay(200)
      if (!currentActive || currentActive.id !== orderId) throw { message: 'No active delivery matches this order.' }
      currentActive = { ...currentActive, status: 'ARRIVED' }
      return
    }
    await apiClient.post(`/delivery/orders/${orderId}/arrived`)
  },

  async listPickupPhotos(orderId: number): Promise<PickupPhoto[]> {
    if (IS_MOCK) {
      await mockDelay(80)
      return [...mockPhotos]
    }
    const { data } = await apiClient.get<{ data: PickupPhoto[] }>(`/delivery/orders/${orderId}/pickup-photos`)
    return data.data ?? []
  },

  /** Uploads one camera shot of the packed order (max 3, before pickup). */
  async uploadPickupPhoto(orderId: number, photo: Blob): Promise<void> {
    if (IS_MOCK) {
      await mockDelay(300)
      if (mockPhotos.length >= MAX_PICKUP_PHOTOS) throw { message: `You can add up to ${MAX_PICKUP_PHOTOS} photos - remove one to retake it.` }
      mockPhotos = [...mockPhotos, { id: Date.now(), url: URL.createObjectURL(photo), takenAt: new Date().toISOString() }]
      return
    }
    const form = new FormData()
    form.append('file', photo, `pickup-${orderId}-${Date.now()}.jpg`)
    await apiClient.post(`/delivery/orders/${orderId}/pickup-photos`, form)
  },

  async deletePickupPhoto(orderId: number, photoId: number): Promise<void> {
    if (IS_MOCK) {
      await mockDelay(120)
      mockPhotos = mockPhotos.filter((p) => p.id !== photoId)
      return
    }
    await apiClient.delete(`/delivery/orders/${orderId}/pickup-photos/${photoId}`)
  },

  /** Online/offline history (incl. automatic offline) and recent sign-ins. */
  async activity(): Promise<RiderActivity> {
    if (IS_MOCK) {
      await mockDelay()
      const now = Date.now()
      return {
        statusHistory: [
          ...mockStatusHistory,
          { online: true, reason: null, message: 'You went online', at: new Date(now - 20 * 60_000).toISOString() },
          { online: false, reason: 'INACTIVITY', message: 'Set offline automatically - your app stopped sharing your location', at: new Date(now - 3 * 3600_000).toISOString() },
          { online: true, reason: null, message: 'You went online', at: new Date(now - 5 * 3600_000).toISOString() },
        ],
        loginHistory: [
          { at: new Date(now - 26 * 3600_000).toISOString(), method: 'EMAIL', status: 'SUCCESS', device: 'Chrome on Android', location: 'Bengaluru, Karnataka, India' },
        ],
      }
    }
    const { data } = await apiClient.get<{ data: RiderActivity }>('/delivery/activity')
    return { statusHistory: data.data?.statusHistory ?? [], loginHistory: data.data?.loginHistory ?? [] }
  },

  /** Mock only: mirrors the backend's status log when the rider toggles. */
  mockRecordStatus(online: boolean) {
    if (!IS_MOCK) return
    mockStatusHistory.unshift({ online, reason: online ? null : 'SELF', message: online ? 'You went online' : 'You went offline', at: new Date().toISOString() })
  },

  /** Completes the delivery. The caller already holds the ActiveDelivery and flips it to DELIVERED itself. */
  async deliver(orderId: number, deliveryPin: string): Promise<void> {
    if (IS_MOCK) {
      await mockDelay(300)
      if (!currentActive || currentActive.id !== orderId) throw { message: 'No active delivery matches this order.' }
      if (deliveryPin !== MOCK_DELIVERY_PIN) throw { message: `Incorrect PIN. Ask the customer to read out their delivery PIN (mock mode: ${MOCK_DELIVERY_PIN}).` }
      const delivered: ActiveDelivery = { ...currentActive, status: 'DELIVERED', deliveredAt: new Date().toISOString() }
      sessionHistory.unshift({
        id: delivered.id,
        uniqueOrderId: delivered.uniqueOrderId,
        status: 'DELIVERED',
        restaurantName: delivered.restaurantName,
        customerAddress: delivered.customerAddress,
        payoutEstimate: delivered.payoutEstimate,
        distanceKm: delivered.distanceKm,
        createdAt: delivered.createdAt,
        deliveredAt: delivered.deliveredAt,
      })
      currentActive = null
      return
    }
    await apiClient.post(`/delivery/orders/${orderId}/deliver`, { deliveryPin })
  },

  /**
   * Every order currently assigned to this rider and not yet finished - self-accepted OR assigned
   * by an admin (GET /delivery/orders/active). Oldest first, so the one to work on next is [0].
   */
  async getActiveDeliveries(): Promise<ActiveDelivery[]> {
    if (IS_MOCK) {
      await mockDelay(120)
      const active = mockActiveNow()
      return active ? [active] : []
    }
    const { data } = await apiClient.get<{ data: ActiveDelivery[] }>('/delivery/orders/active')
    return (data.data ?? []).map(normalizeActiveDelivery)
  },

  async getActiveDelivery(): Promise<ActiveDelivery | null> {
    return (await deliveryOrderService.getActiveDeliveries())[0] ?? null
  },

  async history(): Promise<DeliveryHistoryEntry[]> {
    if (IS_MOCK) {
      await mockDelay()
      return [...sessionHistory, ...deliveryHistory].sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))
    }
    // Same DeliveryAssignmentResponse shape as /orders/active - a superset of DeliveryHistoryEntry.
    const { data } = await apiClient.get<{ data: DeliveryHistoryEntry[] }>('/delivery/orders/mine')
    return data.data ?? []
  },
}

