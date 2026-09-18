// Firebase Cloud Messaging background handler — receives push notifications (order status
// updates, promotions/offers) while the app isn't in the foreground tab.
//
// A service worker is a plain static file, not part of Vite's build, so it can't read the
// backend-configured Firebase values (Settings → Push Notifications in the admin panel) the rest
// of this app uses at runtime — these are mirrored here by hand from that same project. If you
// rotate the Firebase project/config, update both there and here.
importScripts('https://www.gstatic.com/firebasejs/10.13.2/firebase-app-compat.js')
importScripts('https://www.gstatic.com/firebasejs/10.13.2/firebase-messaging-compat.js')

firebase.initializeApp({
  apiKey: 'AIzaSyDJo1GviFj-lZtA7ig9yn918vdIMJnqBKI',
  authDomain: 'pureeatsnotification.firebaseapp.com',
  projectId: 'pureeatsnotification',
  storageBucket: 'pureeatsnotification.firebasestorage.app',
  messagingSenderId: '97657025376',
  appId: '1:97657025376:web:6fefe3c9b3facd9f55a405',
})

const messaging = firebase.messaging()

// A custom onBackgroundMessage handler bypasses the browser's own default push rendering, so
// nothing here is auto-populated from the server's webpush notification config (image/actions/
// click link) — FcmSender mirrors those into the plain `data` payload specifically so this handler
// can reconstruct them (see FcmSender#buildDataPayload on the backend). `actions` arrives as a
// JSON string since FCM data values must be strings.
messaging.onBackgroundMessage((payload) => {
  // A SILENT push (see PushDisplayMode on the backend — order-status ticks, etc.) never has a
  // `notification` block, on purpose — that's the whole signal that nothing should pop up here.
  // The page itself (if open in another tab) still gets it via onMessage regardless.
  if (!payload.notification) return
  const title = payload.notification.title || 'PureEats'
  const body = payload.notification.body || ''
  const image = payload.notification.image
  const clickAction = payload.fcmOptions?.link || payload.data?.click_action
  let actions
  try {
    actions = payload.data?.actions ? JSON.parse(payload.data.actions) : undefined
  } catch {
    actions = undefined
  }
  self.registration.showNotification(title, {
    body,
    icon: '/pwa-icons/icon-192.png',
    image,
    actions,
    data: { clickAction },
  })
})

// Chrome/Edge-only actions (see FcmAction on the backend) land here as `event.action` (the button's
// own `action` id); clicking the notification body itself (no button) is an empty string.
self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const url = event.notification.data?.clickAction
  if (!url) return
  event.waitUntil(self.clients.openWindow(url))
})
