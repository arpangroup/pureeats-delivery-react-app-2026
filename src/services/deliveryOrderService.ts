import { apiClient } from '@/lib/apiClient'
import { mockDelay } from '@/lib/mockUtils'
import { IS_MOCK } from '@/config/env'
import { availableOrderTemplates } from '@/mocks/fixtures/availableOrders'
import { activeDeliveryDetailById, MOCK_DELIVERY_PIN } from '@/mocks/fixtures/activeDelivery'
import { deliveryHistory } from '@/mocks/fixtures/history'
import type { ActiveDelivery, AvailableOrder, DeliveryHistoryEntry } from '@/types/entities'

// --- Mock in-memory order-pool simulation -----------------------------
// Simulates the backend "new orders keep arriving" behavior without a server: a rolling window of
// visible orders that ages out and occasionally admits a fresh template, so useAvailableOrdersPolling
// has something new to diff against on its own even with zero user interaction.
const VISIBLE_TTL_MS = 45_000
let visibleOrders: AvailableOrder[] = []
let currentActive: ActiveDelivery | null = null
const sessionHistory: DeliveryHistoryEntry[] = []

function purgeStale() {
  const now = Date.now()
  visibleOrders = visibleOrders.filter((o) => now - new Date(o.createdAt).getTime() < VISIBLE_TTL_MS)
}

function maybeAdmitNewOrder() {
  const visibleIds = new Set(visibleOrders.map((o) => o.id))
  const candidates = availableOrderTemplates.filter((t) => !visibleIds.has(t.id))
  if (candidates.length === 0) return
  // ~45% chance per poll to admit one new order - frequent enough that a demo left running for
  // 10-20s reliably sees a fresh full-screen alert fire on its own.
  if (Math.random() < 0.45) {
    const template = candidates[Math.floor(Math.random() * candidates.length)]
    visibleOrders = [{ ...template, createdAt: new Date().toISOString() }, ...visibleOrders]
  }
}

export const deliveryOrderService = {
  async listAvailable(): Promise<AvailableOrder[]> {
    if (IS_MOCK) {
      await mockDelay(200)
      purgeStale()
      maybeAdmitNewOrder()
      return [...visibleOrders].sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))
    }
    const { data } = await apiClient.get<{ data: AvailableOrder[] }>('/delivery/orders/available')
    return data.data
  },

  async accept(orderId: number): Promise<ActiveDelivery> {
    if (IS_MOCK) {
      await mockDelay(200)
      const template = availableOrderTemplates.find((t) => t.id === orderId) ?? visibleOrders.find((o) => o.id === orderId)
      if (!template) throw { message: 'This order is no longer available.' }
      const detail = activeDeliveryDetailById[orderId]
      const now = new Date().toISOString()
      currentActive = {
        id: template.id,
        uniqueOrderId: template.uniqueOrderId,
        status: 'RIDER_ASSIGNED',
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

  async pickup(orderId: number): Promise<ActiveDelivery> {
    if (IS_MOCK) {
      await mockDelay(200)
      if (!currentActive || currentActive.id !== orderId) throw { message: 'No active delivery matches this order.' }
      currentActive = { ...currentActive, status: 'PICKED_UP', pickedUpAt: new Date().toISOString() }
      return currentActive
    }
    const { data } = await apiClient.post<{ data: ActiveDelivery }>(`/delivery/orders/${orderId}/pickup`)
    return data.data
  },

  async deliver(orderId: number, deliveryPin: string): Promise<ActiveDelivery> {
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
      return delivered
    }
    const { data } = await apiClient.post<{ data: ActiveDelivery }>(`/delivery/orders/${orderId}/deliver`, { deliveryPin })
    return data.data
  },

  /** Not in the original endpoint list - added so ActiveDeliveryPage can restore an in-progress
   * delivery after a reload. Mock: reads the in-memory "current active" state. Live: best-effort -
   * asks /delivery/orders/mine and picks the newest non-terminal order, since there's no dedicated
   * "current active delivery" endpoint yet. */
  async getActiveDelivery(): Promise<ActiveDelivery | null> {
    if (IS_MOCK) {
      await mockDelay(120)
      return currentActive
    }
    const { data } = await apiClient.get<{ data: ActiveDelivery[] }>('/delivery/orders/mine')
    const active = data.data.find((o) => o.status === 'RIDER_ASSIGNED' || o.status === 'PICKED_UP')
    return active ?? null
  },

  async history(): Promise<DeliveryHistoryEntry[]> {
    if (IS_MOCK) {
      await mockDelay()
      return [...sessionHistory, ...deliveryHistory].sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))
    }
    const { data } = await apiClient.get<{ data: DeliveryHistoryEntry[] }>('/delivery/orders/mine')
    return data.data
  },
}

