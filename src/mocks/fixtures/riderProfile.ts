import type { RiderProfile } from '@/types/entities'

/** The seeded "already a rider" demo account's extended profile - keyed by userId. */
export const riderProfilesByUserId: Record<number, RiderProfile> = {
  501: {
    id: 9001,
    userId: 501,
    name: 'Demo Rider One',
    email: 'demo.rider1@pureeats.local',
    phone: '7000000021',
    photo: null,
    vehicleNumber: 'KA-05-HH-1234',
    age: 27,
    gender: 'MALE',
    description: 'Full-time rider, evenings preferred.',
    commissionRate: 80,
    maxAcceptDeliveryLimit: 1,
    rating: 4.7,
    isNotifiable: true,
    isOnline: false,
    isActive: true,
  },
}
