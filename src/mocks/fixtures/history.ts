import type { DeliveryHistoryEntry } from '@/types/entities'

function hoursAgo(h: number): string {
  return new Date(Date.now() - h * 60 * 60 * 1000).toISOString()
}

/** Seed history so DeliveryHistoryPage has content before the rider completes any deliveries this session. */
export const deliveryHistory: DeliveryHistoryEntry[] = [
  { id: 8801, uniqueOrderId: 'PE-2026-000901', status: 'DELIVERED', restaurantName: 'Meghana Foods - Indiranagar', customerAddress: '5th Cross, Domlur, Bengaluru', payoutEstimate: 62, distanceKm: 2.3, createdAt: hoursAgo(2.4), deliveredAt: hoursAgo(2) },
  { id: 8802, uniqueOrderId: 'PE-2026-000888', status: 'DELIVERED', restaurantName: 'Truffles - Koramangala', customerAddress: 'Sector 2, HSR Layout, Bengaluru', payoutEstimate: 45, distanceKm: 1.6, createdAt: hoursAgo(6.5), deliveredAt: hoursAgo(6) },
  { id: 8803, uniqueOrderId: 'PE-2026-000850', status: 'DELIVERED', restaurantName: 'Empire Restaurant - Church Street', customerAddress: 'MG Road, Bengaluru', payoutEstimate: 58, distanceKm: 2.0, createdAt: hoursAgo(28.5), deliveredAt: hoursAgo(28) },
  { id: 8804, uniqueOrderId: 'PE-2026-000801', status: 'CANCELLED', restaurantName: 'Nagarjuna - Residency Road', customerAddress: 'Richmond Town, Bengaluru', payoutEstimate: 0, distanceKm: 1.4, createdAt: hoursAgo(50), deliveredAt: null },
]
