import type { User } from '@/types/entities'

/**
 * Demo accounts for the rider app.
 *
 * `demo.rider1@pureeats.local` is already a DELIVERY-role account - logging in as this user goes
 * straight into the app shell (instant login demo path).
 *
 * `demo.customer1@pureeats.local` matches the same seed email the customer app uses against the
 * backend's real DemoUserSeeder (role CUSTOMER there) - logging in as this user exercises the
 * "authenticated but not yet a rider" onboarding path (see RiderOnboardingPage).
 */
export const users: User[] = [
  { id: 501, name: 'Demo Rider One', email: 'demo.rider1@pureeats.local', phone: '7000000021', photo: null, role: 'delivery-guy', defaultAddressId: null, dob: null, gender: 'MALE' },
  { id: 502, name: 'Demo Customer One', email: 'demo.customer1@pureeats.local', phone: '7000000009', photo: null, role: 'customer', defaultAddressId: null, dob: null, gender: null },
]
