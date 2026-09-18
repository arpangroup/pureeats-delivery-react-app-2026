import type { ActiveDeliveryItem } from '@/types/entities'

/** Static per-order-id detail used by the mock deliveryOrderService when an available-order
 * template is accepted - keyed by AvailableOrder.id (see availableOrders.ts). Falls back to a
 * generic detail for anything not listed here. */
export const activeDeliveryDetailById: Record<number, { restaurantContactNumber: string; customerName: string; customerPhone: string; items: ActiveDeliveryItem[] }> = {
  9101: {
    restaurantContactNumber: '080-41234567',
    customerName: 'Rahul Sharma',
    customerPhone: '9900011122',
    items: [
      { name: 'Andhra Chicken Biryani', quantity: 2 },
      { name: 'Gongura Mutton', quantity: 1 },
    ],
  },
  9102: {
    restaurantContactNumber: '080-41234568',
    customerName: 'Sneha Iyer',
    customerPhone: '9900022233',
    items: [
      { name: 'Truffle Mushroom Pizza', quantity: 1 },
      { name: 'Garlic Bread', quantity: 2 },
      { name: 'Iced Tea', quantity: 1 },
    ],
  },
  9103: {
    restaurantContactNumber: '080-41234569',
    customerName: 'Karthik Reddy',
    customerPhone: '9900033344',
    items: [{ name: 'Butter Chicken Combo', quantity: 1 }],
  },
  9104: {
    restaurantContactNumber: '080-41234570',
    customerName: 'Ananya Das',
    customerPhone: '9900044455',
    items: [
      { name: 'Chicken 65', quantity: 1 },
      { name: 'Bisi Bele Bath', quantity: 1 },
    ],
  },
  9105: {
    restaurantContactNumber: '080-41234571',
    customerName: 'Vikram Nair',
    customerPhone: '9900055566',
    items: [
      { name: 'Egg Paratha', quantity: 3 },
      { name: 'Paneer Paratha', quantity: 2 },
    ],
  },
}

/** The PIN the mock backend "assigns" to any accepted order - shown to the rider via a dev-only hint banner (ActiveDelivery.mockDeliveryPinHint), never in live mode. */
export const MOCK_DELIVERY_PIN = '1234'
