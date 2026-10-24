# iPhone Web Push test

- Test time: 2026-10-23T15:59:36.714Z (UTC).
- Result: **Accepted by the push provider**, HTTP **201**, empty response body. No provider error returned.
- Exactly **one** real Web Push request was made. No retry or broadcast was performed.
- Device receipt: **not confirmed**. Provider acceptance does not establish delivery or display on the iPhone.

## Target identification

Read-only PostgreSQL inspection found one application user, one unexpired session belonging to that user, and one push subscription belonging to that same user. The subscription label identifies an iPhone running iOS 18.7, and its endpoint uses the Apple push provider. Its expirationTime is null (no declared expiration; this alone does not prove current device permission). These unique matching records identified the target without selecting among other users or devices. No browser session cookie was available to independently bind this terminal to the browser; identification relied on the single-user, single-session, single-subscription database state, rechecked immediately before sending.

Subscription ID fingerprint (SHA-256 prefix): `54e8d986d8f8`. No subscription endpoints, authentication tokens, or key material are included in this report.

## Infrastructure inspected

- `apps/web/src/PushSettings.tsx`: registers the browser subscription with the server and labels it using the user agent.
- `apps/api/src/app.ts`: authenticates using a hashed session cookie and unexpired PostgreSQL session, scopes requests to its owner, and requires CSRF validation for mutations. Notification routes list owner notifications and mark an owner notification as read.
- `apps/api/src/push.ts`: authenticated GET/POST/DELETE `/api/push` routes manage owner subscriptions. VAPID keys are persisted in PostgreSQL `push_config`, rather than configured as environment VAPID values. Existing keys passed library validation and their public/private pair matched cryptographically; no keys were generated or changed.
- `push_subscriptions` stores owner, endpoint, subscription JSON, label, and creation time. It has no active-state or device-receipt field. `push_deliveries` tracks scheduled sender attempts.
- `apps/api/src/server.ts`: runs automation and the scheduled push sender every minute. The sender processes pending notifications across subscriptions, uses fixed reminder content, and records successful sends or handles errors (including deleting expired 404/410 subscriptions). It was not invoked for this test because it is not a single-device test operation.
- `build/server.js` contains the corresponding push routes and sender settings.
- `apps/web/public/sw.js` and `dist/sw.js`: display push bodies, but hardcode the visible notification title to `Febro One`, ignoring the payload title. No service-worker receipt acknowledgment is implemented.

## Single send

Used the application's installed `web-push` package, the existing PostgreSQL subscription and VAPID pair, and the sender's existing VAPID subject (`https://one.febro.id`), TTL (3600 seconds), and timeout (10000 milliseconds). No dedicated test-send endpoint exists. The library was called directly once against the verified subscription, avoiding creation of notification rows that the scheduler could fan out or resend.

Exact payload content:

- Title: `Febro One - Test Notification`
- Body: `Push notification berhasil dikirim dari Febro One.`
- URL: `/`
- Tag: `febro-one-single-push-test`

The requested title was included in the transmitted payload. The inspected service worker will display its hardcoded title if that version handles the push; actual device presentation was not observed.

## Changes

Only this report was created. No application code, UI, database records, services, or Nginx configuration were modified. All database queries for this test were executed in read-only transactions. No mock subscriptions or simulated success results were used.
