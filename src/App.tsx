import { AppRoutes } from '@/routes/AppRoutes'
import { IncomingOrderProvider } from '@/context/IncomingOrderContext'
import { FullScreenOrderAlert } from '@/components/order/FullScreenOrderAlert'
import { PushNotificationBootstrap } from '@/components/layout/PushNotificationBootstrap'
import { RiderSessionProvider } from '@/context/RiderSessionContext'
import { AssignedOrderAlert } from '@/components/order/AssignedOrderAlert'

// Provider tree, trimmed to what a rider app actually needs - no cart/favorites/location/app-config
// providers like the customer app (none of that is shopping-specific state this app has). See
// pureeats-customer-react-app-2026/docs/ARCHITECTURE.md for the nesting-order reasoning this
// borrows from: AuthProvider lives in main.tsx (outside App), IncomingOrderProvider is the one
// piece of cross-page state this app actually needs shared - both the polling hook and the push
// handler write into it, and FullScreenOrderAlert reads it, all independent of routing.
export default function App() {
  return (
    <IncomingOrderProvider>
      {/* App-wide rider runtime (online status, GPS pings, order polling, assignments) - lives here,
          not in HomePage, so it keeps running whichever tab is open. */}
      <RiderSessionProvider>
        <PushNotificationBootstrap />
        <FullScreenOrderAlert />
        <AssignedOrderAlert />
        <AppRoutes />
      </RiderSessionProvider>
    </IncomingOrderProvider>
  )
}
