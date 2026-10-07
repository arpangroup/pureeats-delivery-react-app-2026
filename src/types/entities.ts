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
  | 'PREPARING'
  | 'READY_FOR_PICKUP'
  | 'RIDER_ASSIGNED'
  | 'PICKED_UP'
  | 'ON_THE_WAY'
  | 'ARRIVED'
  | 'DELIVERED'
  | 'SELF_PICKUP_COMPLETED'
  | 'CANCELLED'
  | 'REJECTED'
  | 'RETURNED'
  | 'AUTO_CANCELLED'

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
  /** Restaurant -> customer (same as dropDistanceKm; kept for older backends). */
  distanceKm: number
  /** Commission only - the tip is separate (tipAmount). */
  payoutEstimate: number
  itemsCount: number
  createdAt: string
  /** Customer's tip, paid to the rider in full on delivery on top of payoutEstimate. */
  tipAmount: number
  /** Rider -> restaurant, from the rider's last reported position; null before the first ping (the app prefers its own live GPS - see usePickupDistance). */
  pickupDistanceKm: number | null
  /** Restaurant -> customer. */
  dropDistanceKm: number
  /** Kitchen status - RESTAURANT_ACCEPTED, PREPARING or READY_FOR_PICKUP. */
  orderStatus?: OrderStatus
  /** COD, RAZORPAY, WALLET... - shown as COD vs Prepaid. */
  paymentMode?: string | null
  /** When the food should be ready (acceptance + prep time) - drives the pickup countdown. */
  pickupDueAt?: string | null
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
  /** 'ADMIN' when ops assigned this order to the rider directly, 'DELIVERY' when the rider accepted it themself. */
  assignedBy?: 'ADMIN' | 'DELIVERY'
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
  /** Customer's tip - paid in full on delivery. */
  tipAmount?: number
  /** COD, RAZORPAY, WALLET... - shown as COD vs Prepaid. */
  paymentMode?: string | null
  /** Order total (what a COD customer pays in cash). */
  payable?: number
  /** True once the store/admin marked the food ready - pickup is blocked until then. */
  foodReady?: boolean
  /** When the food should be ready - drives the pickup countdown. */
  pickupDueAt?: string | null
  /** Pickup photos taken so far (1-3 needed before pickup). */
  pickupPhotoCount?: number
  /** Handover photos taken so far (1-3 needed after arriving, before delivery). */
  deliveryPhotoCount?: number
  /** The customer's note for the order (e.g. "leave at the door"), or null. */
  orderComment?: string | null
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
  /** Only APPROVED partners can go online and take orders; legacy accounts report APPROVED. */
  approvalStatus?: ApprovalStatus
  rejectionReason?: string | null
  licenseNumber?: string | null
  licensePhotoUrl?: string | null
  idProofType?: IdProofType | null
  idProofNumberMasked?: string | null
  vehicleType?: VehicleType | null
  payoutMethod?: PayoutMethod | null
  bankAccountHolder?: string | null
  bankAccountNumberMasked?: string | null
  bankIfsc?: string | null
  upiId?: string | null
}

export type ApprovalStatus = 'PENDING' | 'APPROVED' | 'REJECTED'
export type IdProofType = 'AADHAAR' | 'PAN'
export type VehicleType = 'BIKE' | 'CYCLE' | 'EV'
export type PayoutMethod = 'BANK' | 'UPI'

/** What a partner submits to apply (and resubmits after a rejection). */
export interface PartnerApplication {
  name: string
  licenseNumber: string
  idProofType: IdProofType
  idProofNumber: string
  vehicleType: VehicleType
  vehicleNumber: string
  payoutMethod: PayoutMethod
  bankAccountHolder: string
  bankAccountNumber: string
  bankIfsc: string
  upiId: string
}

export interface WalletTransaction {
  id: number
  type: 'credit' | 'debit'
  amount: number
  note: string | null
  createdAt: string
}

/** One delivered trip as an earning - GET /delivery/earnings. */
export interface RiderEarning {
  tripId: number
  orderId: number
  uniqueOrderId: string
  restaurantName: string
  customerAddress: string | null
  deliveredAt: string
  distanceKm: number
  orderTotal: number | null
  deliveryCharge: number | null
  paymentMode: string | null
  commissionRate: number | null
  /** FULL_ORDER or DELIVERY_CHARGE_ONLY. */
  commissionBasis: string | null
  commissionBase: number | null
  /** The rate shown is the rider's current one (old trip recorded before rate snapshots existed). */
  rateIsCurrent: boolean
  /** Commission + tip. */
  earning: number
  /** Tip included in earning. */
  tipAmount: number
  /** COD cash collected from the customer - held by the rider until settlement. */
  codCollected: number
  settled: boolean
  settlementId: number | null
  settledAt: string | null
}

/** BOTH = COD cash collected and earnings paid in the same settlement (they're never netted). */
export type SettlementDirection = 'PAID_TO_RIDER' | 'COLLECTED_FROM_RIDER' | 'EVEN' | 'BOTH'

export interface RiderSettlement {
  id: number
  earningsAmount: number
  codAmount: number
  netAmount: number
  direction: SettlementDirection
  tripCount: number
  transactionMode: string | null
  transactionReference: string | null
  note: string | null
  createdAt: string
  /** REQUESTED = a withdrawal waiting for the admin; PAID; REJECTED. */
  status?: 'REQUESTED' | 'PAID' | 'REJECTED'
  requestedAt?: string | null
  paidAt?: string | null
}

/** Where the rider stands - GET /delivery/earnings/summary. netPending = pendingEarnings - cashInHand. */
export interface RiderEarningsSummary {
  lifetimeEarnings: number
  lifetimeTrips: number
  pendingEarnings: number
  cashInHand: number
  netPending: number
  netDirection: SettlementDirection
  unsettledTrips: number
  settledEarnings: number
  lastSettlement: RiderSettlement | null
  /** Delivered orders not fully settled yet, and what customers paid for them. */
  openOrders?: number
  openOrderValue?: number
  /** COD orders whose cash the rider still holds (cashInHand is their total). */
  codOrders?: number
  /** Earnings in the wallet - credited at delivery, not yet withdrawn/paid out. */
  walletBalance?: number
  /** Withdrawal requests waiting for the admin. */
  pendingWithdrawals?: number
  /** What can be withdrawn now. */
  availableToWithdraw?: number
  /** Where withdrawals are paid, e.g. "UPI ravi@okhdfcbank"; null when none is on file. */
  payoutTo?: string | null
}

export type AnalyticsPeriod = 'DAY' | 'WEEK' | 'MONTH' | 'CUSTOM'

export interface AnalyticsTotals {
  earnings: number
  trips: number
  averagePerTrip: number
  distanceKm: number
  averageDistanceKm: number
  codCollected: number
  activeDays: number
}

export interface AnalyticsBucket {
  label: string
  from: string
  to: string
  earnings: number
  trips: number
}

/** GET /delivery/earnings/analytics. */
export interface RiderEarningsAnalytics {
  period: AnalyticsPeriod
  currentFrom: string
  currentTo: string
  current: AnalyticsTotals
  previousFrom: string
  previousTo: string
  previous: AnalyticsTotals
  changePercent: number | null
  bucketSize: 'DAY' | 'WEEK' | 'MONTH'
  buckets: AnalyticsBucket[]
  bestBucket: AnalyticsBucket | null
  byHour: { hour: number; earnings: number; trips: number }[]
  byWeekday: AnalyticsBucket[]
  paymentSplit: { codTrips: number; codCollected: number; onlineTrips: number }
  topRestaurants: { restaurantId: number; restaurantName: string; trips: number; earnings: number }[]
}

/** A wallet ledger entry linked to its cause - GET /delivery/wallet/transactions. */
export interface RiderWalletTransaction {
  id: number
  type: 'credit' | 'debit'
  amount: number
  note: string | null
  createdAt: string
  kind: 'EARNING' | 'SETTLEMENT' | 'ADJUSTMENT'
  orderId: number | null
  uniqueOrderId: string | null
  settlementId: number | null
}

/** pickup = the packed order at the restaurant; delivery = handing it to the customer. */
export type OrderPhotoKind = 'pickup' | 'delivery'

/** A photo of the order taken by the partner (at pickup or at handover). */
export interface PickupPhoto {
  id: number
  url: string
  takenAt: string
}

/** GET /delivery/activity - the rider's online/offline changes and sign-ins, newest first. */
export interface RiderActivity {
  statusHistory: { online: boolean; reason: 'SELF' | 'INACTIVITY' | 'ADMIN' | null; message: string; at: string }[]
  loginHistory: { at: string; method: string | null; status: string; device: string | null; location: string }[]
}
