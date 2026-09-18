// Canonical app-level types for the rider app. Every component consumes these - never the raw
// backend wire shape directly. Each services/* function is responsible for mapping mock fixtures
// AND live API responses into this same shape.

export type UserRole = 'admin' | 'employee' | 'restaurant-owner' | 'delivery-guy' | 'customer'

export type Gender = 'MALE' | 'FEMALE' | 'OTHER'

/** The identity carried in the JWT - same shape across every PureEats frontend. */
export interface User {
  id: number
  name: string
  email: string
  phone: string
  photo: string | null
  role: UserRole
  defaultAddressId: number | null
  dob: string | null
  gender: Gender | null
}

export type OrderStatus =
  | 'PLACED'
  | 'RESTAURANT_ACCEPTED'
  | 'READY_FOR_PICKUP'
  | 'RIDER_ASSIGNED'
  | 'PICKED_UP'
  | 'DELIVERED'
  | 'SELF_PICKUP_COMPLETED'
  | 'CANCELLED'

/** A {lat,lng} waypoint - used for the restaurant/customer pins and the demo-route fixtures. */
export interface RoutePoint {
  lat: number
  lng: number
}

/** A not-yet-accepted order the rider can pick up - shown in the full-screen alert and the browse list. */
export interface AvailableOrder {
  id: number
  uniqueOrderId: string
  restaurantName: string
  restaurantAddress: string
  restaurantLat: number
  restaurantLng: number
  customerAddress: string
  customerLat: number
  customerLng: number
  distanceKm: number
  payoutEstimate: number
  itemsCount: number
  createdAt: string
}

export interface ActiveDeliveryItem {
  name: string
  quantity: number
}

/**
 * The order the rider has accepted and is currently working. Unlike AvailableOrder, this carries
 * enough detail to drive the whole RIDER_ASSIGNED -> PICKED_UP -> DELIVERED flow.
 *
 * Deliberately has NO real `deliveryPin` field - the customer holds the PIN and reads it aloud to
 * the rider at the doorstep; the backend never sends it to the delivery app. `deliveryPin` is only
 * ever collected as free-text input on ActiveDeliveryPage and posted to `deliver()`. Mock mode
 * shows `mockDeliveryPinHint` in a dev banner so the demo flow can be completed without a customer
 * app open alongside it - this must never be populated from a live API response.
 */
export interface ActiveDelivery {
  id: number
  uniqueOrderId: string
  status: OrderStatus
  restaurantName: string
  restaurantAddress: string
  restaurantLat: number
  restaurantLng: number
  restaurantContactNumber: string
  customerName: string
  customerAddress: string
  customerLat: number
  customerLng: number
  customerPhone: string
  items: ActiveDeliveryItem[]
  payoutEstimate: number
  distanceKm: number
  createdAt: string
  acceptedAt: string | null
  pickedUpAt: string | null
  deliveredAt: string | null
  /** Mock mode only - a dev-visible hint of the PIN the customer would read out. Never set in live mode. */
  mockDeliveryPinHint?: string
}

/** A completed (or cancelled) delivery, as shown on DeliveryHistoryPage. */
export interface DeliveryHistoryEntry {
  id: number
  uniqueOrderId: string
  status: OrderStatus
  restaurantName: string
  customerAddress: string
  payoutEstimate: number
  distanceKm: number
  createdAt: string
  deliveredAt: string | null
}

/** The rider's own extended profile - separate from the base `User` identity, fetched once a rider account exists. */
export interface RiderProfile {
  id: number
  userId: number
  name: string
  email: string
  phone: string
  photo: string | null
  vehicleNumber: string
  age: number | null
  gender: Gender | null
  description: string
  commissionRate: number
  maxAcceptDeliveryLimit: number
  rating: number
  isNotifiable: boolean
  isOnline: boolean
  isActive: boolean
}

export interface WalletTransaction {
  id: number
  type: 'credit' | 'debit'
  amount: number
  note: string | null
  createdAt: string
}
