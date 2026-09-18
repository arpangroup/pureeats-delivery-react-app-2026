import { Navigate, Route, Routes } from 'react-router-dom'
import { AppShell } from '@/components/layout/AppShell'
import { RequireAuth } from '@/components/auth/RequireAuth'

import AuthLayout from '@/pages/auth/AuthLayout'
import LoginPage from '@/pages/auth/LoginPage'
import RegisterPage from '@/pages/auth/RegisterPage'
import VerifyPage from '@/pages/auth/VerifyPage'
import RiderOnboardingPage from '@/pages/RiderOnboardingPage'

import HomePage from '@/pages/HomePage'
import AvailableOrdersPage from '@/pages/AvailableOrdersPage'
import ActiveDeliveryPage from '@/pages/ActiveDeliveryPage'
import DeliveryHistoryPage from '@/pages/DeliveryHistoryPage'
import RiderProfilePage from '@/pages/RiderProfilePage'
import EditRiderProfilePage from '@/pages/EditRiderProfilePage'
import WalletPage from '@/pages/WalletPage'

export function AppRoutes() {
  return (
    <Routes>
      <Route element={<AuthLayout />}>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
        <Route path="/verify" element={<VerifyPage />} />
      </Route>

      {/* Authenticated but not yet role DELIVERY - not wrapped in RequireAuth (which would just
          redirect back here), and not under AppShell (no bottom-tab chrome until onboarded). */}
      <Route path="/onboarding" element={<RiderOnboardingPage />} />

      <Route
        element={
          <RequireAuth>
            <AppShell />
          </RequireAuth>
        }
      >
        <Route path="/" element={<HomePage />} />
        <Route path="/orders/available" element={<AvailableOrdersPage />} />
        <Route path="/deliveries/active" element={<ActiveDeliveryPage />} />
        <Route path="/deliveries/history" element={<DeliveryHistoryPage />} />
        <Route path="/profile" element={<RiderProfilePage />} />
        <Route path="/profile/edit" element={<EditRiderProfilePage />} />
        <Route path="/profile/wallet" element={<WalletPage />} />
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
