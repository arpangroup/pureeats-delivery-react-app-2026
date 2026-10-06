import { useRiderSession } from '@/context/RiderSessionContext'
import { distanceKm } from '@/lib/format'
import type { AvailableOrder } from '@/types/entities'

/**
 * Rider -> restaurant distance. Prefers the app's own latest GPS fix (fresher than the server's copy
 * of the last ping), falls back to the server's pickupDistanceKm, and is null when neither exists.
 */
export function usePickupDistance(order: Pick<AvailableOrder, 'restaurantLat' | 'restaurantLng' | 'pickupDistanceKm'>): number | null {
  const { lastPosition } = useRiderSession()
  if (lastPosition && (order.restaurantLat || order.restaurantLng)) {
    return distanceKm(lastPosition.latitude, lastPosition.longitude, order.restaurantLat, order.restaurantLng)
  }
  return order.pickupDistanceKm
}
