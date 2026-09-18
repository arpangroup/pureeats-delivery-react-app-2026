import { readFileSync } from 'node:fs'
import { fileURLToPath, URL } from 'node:url'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

const appVersion = JSON.parse(readFileSync(fileURLToPath(new URL('./package.json', import.meta.url)), 'utf-8')).version as string

// https://vitejs.dev/config/
export default defineConfig({
  define: {
    // The app's own build version - same pattern as the customer app's vite.config.ts, kept here
    // for parity even though this app doesn't yet have an /app-config-driven update banner.
    __APP_VERSION__: JSON.stringify(appVersion),
  },
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg', 'pwa-icons/icon.svg', 'pwa-icons/apple-touch-icon.png'],
      manifest: {
        name: 'PureEats Rider',
        short_name: 'PE Rider',
        description: 'Accept and deliver PureEats orders on the go.',
        theme_color: '#16a34a',
        background_color: '#f0fdf4',
        display: 'standalone',
        start_url: '/',
        icons: [
          { src: '/pwa-icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: '/pwa-icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: '/pwa-icons/icon-512-maskable.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
          { src: '/pwa-icons/icon.svg', sizes: 'any', type: 'image/svg+xml' },
        ],
      },
      workbox: {
        // App-shell only - API responses are never cached so mock/live data always stays fresh.
        globPatterns: ['**/*.{js,css,html,svg,ico}'],
        // This is a client-side-routed SPA - /deliveries/active, /orders/available, etc. aren't real
        // files, only index.html is. This makes the service worker serve the cached shell for every
        // navigation once installed, independent of what the host does for unmatched paths.
        navigateFallback: '/index.html',
      },
    }),
  ],
  resolve: {
    alias: {
      // Must mirror the "@/*" path in tsconfig.app.json - that file only affects type-checking,
      // this is what actually resolves the import at build/dev time.
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  server: {
    // 5173 is the admin app, 5273 is the customer app - this must not collide with either.
    port: 5373,
  },
})
