# Deploying this app

Same SPA-routing situation as the customer app (`pureeats-customer-react-app-2026/docs/DEPLOYMENT.md`) — this is also a client-side-routed React Router SPA, `npm run build` produces one `index.html` plus a bundle in `dist/`, and routes like `/deliveries/active` or `/profile/edit` only exist once React Router has loaded in the browser. A hard refresh or direct URL load needs the server to fall back to `index.html` (200, not a redirect) for any path that isn't a real file — the `vite-plugin-pwa` `workbox.navigateFallback: '/index.html'` setting in `vite.config.ts` covers this once the service worker is installed, but the **first** visit and any pre-service-worker check still need a server-side rewrite.

## This app's specific deploy target

`.github/workflows/deploy.yml` rsyncs `dist/` to `/var/www/driver.pureeats.in` on pushes to `main` (or via `workflow_dispatch`), reusing the same server/secrets as the customer and admin apps (`DEPLOY_SSH_KEY`, `DEPLOY_HOST`, deploy user `pureeats-deploy`).

**Important**: unlike the customer app (`/var/www/pureeats.in/html`) and admin app (`/var/www/admin.pureeats.in/html`), this path has **no `/html` suffix** — it's used exactly as provisioned. This is also a **separate Apache document root / vhost** from the other two apps, so it needs its **own** SPA-rewrite rule — the existing rewrite for `pureeats.in` does not cover `driver.pureeats.in`. Add, for the vhost serving `driver.pureeats.in`:

```apache
<Directory /var/www/driver.pureeats.in>
  RewriteEngine On
  RewriteBase /
  RewriteRule ^index\.html$ - [L]
  RewriteCond %{REQUEST_FILENAME} !-f
  RewriteCond %{REQUEST_FILENAME} !-d
  RewriteRule . /index.html [L]
</Directory>
```

(or the equivalent `<VirtualHost>` block for `driver.pureeats.in` — whichever matches how the other two vhosts are actually configured on this server; check `pureeats.in`'s existing Apache config as the template.)

## Secrets this workflow expects

Same repo/org secrets as the customer app (`DEPLOY_SSH_KEY`, `DEPLOY_HOST`), plus these are optional build-time values (all default to mock-mode-safe values per `src/config/env.ts` when unset):

- `VITE_DATA_SOURCE` — `mock` (default if unset) or `live`
- `VITE_API_BASE_URL` — defaults to `http://localhost:8081/api/v1`; set to the real backend's public URL for a live deploy
- `VITE_FIREBASE_API_KEY` / `_AUTH_DOMAIN` / `_PROJECT_ID` / `_STORAGE_BUCKET` / `_MESSAGING_SENDER_ID` / `_APP_ID` / `_VAPID_KEY` — same Firebase project the customer app uses (`pureeatsnotification`), needed for real push notifications; the app runs fine without them (falls back to polling for new orders)

## uat vs production

`npm run dev:uat` (local) and a `VITE_DATA_SOURCE=live` build both point at whatever `VITE_API_BASE_URL` resolves to — set the GitHub Actions secret per-environment if this workflow is ever split into separate uat/production jobs (it isn't yet; today it's a single `main`-branch deploy, matching the customer/admin apps' own current setup).
