# Architecture — PureEats Rider (delivery partner app)

Sibling to `pureeats-customer-react-app-2026` and `pureeats-admin-react-app-2026`, same Spring Boot backend, same `IS_MOCK` mock-vs-live pattern (`src/config/env.ts` — every `src/services/*` function branches on it once, nothing else in the app knows which mode is active). Mobile-only: there is no desktop layout anywhere in this app.

## Provider tree (`src/main.tsx` → `src/App.tsx`)

```
main.tsx
  BrowserRouter
    AuthProvider          — JWT, OTP login, DELIVERY-role gate
      App.tsx
        IncomingOrderProvider   — the one piece of shared state this app needs:
                                  the current full-screen new-order alert, if any
          PushNotificationBootstrap   (side-effect only: registers FCM token,
                                        writes push payloads into IncomingOrderContext)
          FullScreenOrderAlert        (mounted once, outside routing — overlays
                                        any page when IncomingOrderContext has an order)
          AppRoutes
            AuthLayout (public: /login, /register, /verify, /onboarding)
            AppShell (everything else — bottom tab bar + the actual pages)
```

Deliberately trimmed vs. the customer app: no cart/favorites/location/theme/app-config providers — none of that is state this app has. `AuthProvider` also gates on the JWT's `role` claim (must be `DELIVERY`), not just presence of a token — an authenticated non-rider account routes to `RiderOnboardingPage` instead of the app shell.

## The centerpiece: new-order alerts

Two independent producers feed **one** `IncomingOrderContext`, and exactly one consumer (`FullScreenOrderAlert`) renders it — this is the whole point of centralizing it, so polling and push never fight over separate UIs:

- `useAvailableOrdersPolling` (active only when `!HAS_FIREBASE_CONFIG || Notification.permission !== 'granted'`, i.e. push isn't actually usable on this device) — polls `deliveryOrderService.listAvailable()` every ~9s, diffs against the previous poll's order-id set, surfaces the newest new order.
- `usePushNotifications` — FCM foreground handler; checks `payload.data.type === 'NEW_ORDER'` (the backend's wire contract: it sends `category` internally but that lands as `data.type`, confirmed against `PushNotificationSender.java`) and surfaces that order directly, no extra fetch needed if the payload carries enough fields.

`FullScreenOrderAlert` itself owns the 20s countdown/auto-dismiss and the swipe-to-accept interaction (`SwipeToAcceptButton`, raw pointer events, no gesture library) — accepting calls `deliveryOrderService.accept(orderId)` and routes to `/deliveries/active`.

## Online status / GPS

`useOnlineStatus` (toggle, `POST /delivery/status`) and `useLocationReporting` (effect keyed on `isOnline`; while true, `setInterval` ~15s calling `getCurrentPosition()` then `POST /delivery/location`; stops immediately on going offline) are two separate hooks, both surfaced on `HomePage`'s top banner — the most visible instantiation of "online riders report location, offline riders don't."

## Backend endpoints this app talks to (live mode)

Shared with the customer app: `/auth/*` (OTP login/refresh/logout).
New to this app: `/users/me/rider-profile` (onboarding), `/delivery/orders/available|mine`, `/delivery/orders/{id}/accept|pickup|deliver`, `/delivery/status`, `/delivery/location`, `/users/me/wallet`, `/users/me/wallet/transactions`, `/notifications/push-token` (with `audience: 'DELIVERY'`).

See the sibling `pureeats-backend-2026` repo for the server side of all of this.
