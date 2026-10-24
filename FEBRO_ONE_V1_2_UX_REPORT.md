# Febro One V1.2 UX report

Implementation date: 23–24 October 2026, Asia/Jakarta.

## Features implemented

- Tasks opens directly in Board. Six existing statuses remain intact. Compact responsive columns have filtered server-side counts, 30-record server pagination, search, priority/relationship filters, sort, CSV and Markdown export. View/filter/page state is retained in the URL. Cards navigate to dedicated task details; changing status requires an intentional edit.
- Authenticated record routes follow existing conventions: `/records/:kind/new`, `/records/:kind/:id`, and `/records/:kind/:id/edit`. Shared record creation/editing, Home actions, Calendar forms and Quick Add use these routes. Existing attachments, history, templates and linking remain in the routed form. Global search now opens the matched record.
- Task Detail shows title, status and checklist first, followed by a visible Edit Task action and compact read-only metadata. Checklist add, edit, delete confirmation and completion are inline. Inputs trim whitespace, reject empty text and retain text on failed saves. Saving indicators, disabled controls and an immediate request lock prevent duplicate submissions. Successful saves update the authoritative record cache without a page reload. Existing optimistic version validation rejects concurrent stale saves.
- Checklist progress derives from nonempty checklists. All checked items complete a task; unchecking or adding unchecked work reopens completion. On Hold and Cancelled remain protected. Explicitly completed tasks without checklists remain explicit completions; an empty checklist never triggers completion. The existing transaction and dependency checks remain in effect.
- Archive, Restore, Move to Trash and Permanently Delete are distinct. Trash retains records, relationships, versions and attachments. Active/archived searches exclude Trash; each record module has a Trash view. Destructive actions use inline confirmation. Permanent deletion requires a 30-day Trash period, exact title, ownership, and no dependent records, attachments, links, notifications, automation runs or version history. A short exclusive records lock prevents concurrent relationship writes during the destructive check. Audit events record archive, trash, restore and permanent deletion.
- Finance account, transaction, debt, payment, reconciliation, schedule and import interfaces use `/finance/new/:action` and `/debts/new/:action`. Account and ledger behavior is preserved. Financial forms retain draft fields and transaction idempotency keys in owner-specific session draft storage. Ordinary native browser confirmations were replaced with explicit inline actions.
- Relationship selectors search authenticated authoritative records in batches of 30, with pagination and selected-record recovery. Company selection filters project options; server ownership and company/project checks remain authoritative. Board responses include related labels in one bounded query. Legacy archived relationships can be retained while editing. Templates and record-link options support search and pagination.
- Workspace groups default to collapsed and retain expansion preferences on the server, with accessible headings and keyboard interaction.
- Existing Bento colors, theme controls and bottom navigation remain. Forms use 16px controls, practical 44px buttons, safe-area spacing, wrapping layouts and scroll margins. Browser history scroll positions are restored, with bounded layout retries that stop on user scrolling.
- Existing PWA manifest and subscriptions remain. Service-worker shell cache is versioned for V1.2, APIs stay outside the cache, and notification taps open same-origin record deep links. External notification destinations fall back to Home. Push registration, VAPID key storage, scheduling and delivery deduplication are preserved.

## Source files changed

Existing files:

- `apps/api/src/app.ts`, `apps/api/src/push.ts`
- `apps/web/src/App.tsx`, `RecordsPage.tsx`, `RecordForm.tsx`, `FinancePage.tsx`, `Settings.tsx`, `WorkspaceCategories.tsx`, `main.tsx`, `bento.css`
- `apps/web/public/sw.js`
- `packages/shared/domain.ts`, `packages/shared/catalog.ts`, `packages/db/schema.ts`
- `tests/integration.test.ts` (new V1.2 assertions and migration count updated), `tests/postgres-crud.test.ts` (native PostgreSQL V1.2 assertions)
- `package.json`, `package-lock.json` (release version 1.2.0; dependency versions unchanged)

New files:

- `apps/web/src/RecordPage.tsx`, `apps/web/src/NavigationState.tsx`
- `packages/db/migrations/003_v12.sql`
- `tests/v12.test.ts`
- `scripts/v12-browser.mts`, `scripts/v12-production-smoke.mts`, `scripts/v12-deploy.sh`
- This report and verification artifacts under `docs/v12/`.

## Database and backups

The live PostgreSQL `records` schema, foreign keys, relationship trigger, version history and migration runner were inspected before changes. Migration `003_v12.sql` adds nullable `deleted_at` and a partial index for per-owner Trash listings. It does not rewrite existing record data, identifiers, ownership or relationships. The existing migration runner applies changes transactionally with checksum tracking.

Root-readable backups are in `backups/v12/`:

- `application.tar.gz`: original sources, manifests, tests, production frontend and server.
- `database.dump`: pre-change PostgreSQL custom-format backup; archive listing verified.
- `uploads.tar.gz`: existing upload directory.
- `configuration.tar.gz`: original environment, target systemd unit and target Nginx configuration.
- `pre-deploy.dump`: created immediately before production migration by the deployment script.

No environment values are printed in this report. Nginx configuration, backend port 3471 and other services are unchanged. The isolated PostgreSQL QA database was removed after testing.

## Automated verification

- TypeScript: `runtime/node/bin/node node_modules/typescript/bin/tsc --noEmit`; see `docs/v12/typecheck.log` (empty on success).
- Full suite: 47 tests, 46 passed, 0 failed, 1 optional PostgreSQL test skipped in the default run. See `docs/v12/tests.log`.
- That PostgreSQL adapter test was separately enabled against a new isolated PostgreSQL database: 1 passed, 0 failed, 0 skipped. All shared module CRUD/archive/restore paths, relation-array binding, board counts, Trash and guarded permanent deletion were exercised inside a rollback. See `docs/v12/postgres.log`.
- Integration coverage includes checklist completion/reopening, On Hold/Cancelled, zero items, stale version conflicts, owner isolation, Trash/Archive separation, restore, permanent-delete retention/title guards and allowed unlinked permanent deletion. Existing finance, attachments, migration, notification, recurrence and security tests remain passing.
- Service-worker tests validate manifest/icons, exclusion of private APIs, notification handlers and same-origin deep links.
- Browser results and screenshots: `docs/v12/browser-results.json`, `docs/v12/browser.log`, `docs/v12/task-detail-390.png`, `docs/v12/task-detail-dark-390.png`. A supplemental interaction recheck and fully rendered dark screenshot are recorded in `docs/v12/browser-recheck.log` and `browser-recheck-results.json`. Initial sweep passed 260 route/viewport checks at 375, 390, 430, 768 and 1366px, with no horizontal overflow or browser errors. The final artifact-matched run passed save-failure recovery, duplicate submission prevention, finance draft testing and dark-theme persistence; its result is recorded below.

## Production build

The production pipeline ran TypeScript, Vite production build into `.v12-stage/dist`, and the bundled Node backend into `.v12-stage/build/server.js`. Staging avoided overwriting the running production build before verification. Vite used `--configLoader runner` because the existing root-owned `node_modules/.vite-temp` directory is not writable by the workspace user.

See `docs/v12/build.log`. Representative emitted assets:

| Asset | Raw | Gzip |
| --- | ---: | ---: |
| Task/record detail route | 6.22 kB | 2.28 kB |
| Records route | 11.66 kB | 4.40 kB |
| Finance route | 22.79 kB | 7.21 kB |
| Main entry | 381.28 kB | 124.90 kB |
| Rich editor, loaded on demand | 408.36 kB | 130.15 kB |
| Spreadsheet parser, loaded on demand | 936.99 kB | 270.75 kB |

The spreadsheet chunk still causes Vite's >500 kB warning; it is dynamically imported through the finance import flow, rather than loaded by unrelated screens. Zod emits existing annotation warnings. Neither warning is a build failure. No new UI dependencies were installed.

## Deployment and final evidence

Deployed successfully at **2026-10-24T00:14:44+07:00** with `scripts/v12-deploy.sh`. The release gate checked the browser result against the staged frontend SHA-256, test/build/typecheck logs and the source manifest before any production changes.

Actual verification:

| Check | Result |
| --- | --- |
| Final browser sweep | 260/260 route/viewport visits; zero overflow; zero page errors |
| Task/detail/inline CRUD, error recovery, duplicate prevention | Passed |
| Finance route creation and draft recovery | Passed |
| Relationships, Trash/restore, Workspace preferences | Passed |
| Dark theme after refresh | Passed |
| Migration | `003_v12.sql` applied; all three migration rows present |
| Existing record, subscription and push-configuration fingerprints | Exact match before/after migration |
| Service | `febro-one.service` active |
| Backend health, port 3471 | HTTP 200, version `1.2.0` |
| Public website | HTTP 200 |
| Public `/api/health` | HTTP 200, `{"status":"ok","app":"Febro One","version":"1.2.0"}` |
| Public HTML, service worker and built backend | Match staged artifacts byte-for-byte |
| Linked public static assets and 42 HTTPS SPA routes | Passed |
| HTTPS secure-cookie login and authenticated generic CRUD | Passed for Tasks, Notes, Events, Certificates and Work |
| HTTPS checklist completion/reopen, protected statuses, linked masters | Passed |
| HTTPS Trash/restore, re-login persistence, permanent-delete retention guard | Passed |
| Finance, notification, session and push read endpoints | Passed |
| Synthetic production QA account and records | Removed in cleanup; verified absent |
| `.env`, target Nginx configuration and systemd unit checksums | Unchanged |

During restart the first two local health attempts encountered connection refusal; configured retries succeeded once the service started. No rollback was needed. The expected HTTP 503 in the isolated browser log is the deliberate save-failure injection, not a production failure. One earlier long-lived browser renderer crashed during a sweep; rerunning with a fresh context per viewport completed successfully.

Evidence: `docs/v12/deployment.log`, `browser-results.json`, `browser.log`, `public-headers.txt`, `deployed-assets.sha256`, `database-before.fingerprint`, `database-after.fingerprint`, `configuration.sha256` and `backups.sha256`. Database fingerprints use MD5 for before/after comparison; asset, source, backup and configuration manifests use SHA-256.

Published frontend index SHA-256: `26015d287d5c6391abfbb54a36d4bb604a906a4d4ff28f28e2ef8623c7515d2b`.
Published backend SHA-256: `74f8c73c24a56a41ac9200e3083580274bfcfee50e079d31a9092b9db9d92d08`.

The application and database backups remain available under `backups/v12/`; no existing user account, record, attachment or subscription was removed by the upgrade.

## Remaining limitations

- Physical iPhone Safari, Home Screen installation, software keyboard behavior and real APNs/Web Push delivery were not tested on hardware. Browser viewport checks and service-worker tests do not establish physical-device delivery.
- The Board intentionally paginates 30 tasks globally; status headings show counts across the filtered dataset. A column can have a nonzero total while its cards are on another page.
- Permanent deletion deliberately refuses records with retained history or related data. Such records remain recoverable in Trash. Ledger transactions retain the existing reversal/audit workflow rather than destructive deletion.
- Search, Quick Add module choice, notification center, account menu and dashboard customization can still use overlays; ordinary record and financial CRUD forms are route pages.
- No claim is made of fully offline financial CRUD. Existing note draft/offline behavior is preserved; server records remain authoritative.

## Rollback

Routine application rollback retains the additive migration and all subsequent user data:

```bash
cd /opt/febro-one
sudo tar -xzf backups/v12/application.tar.gz -C /opt/febro-one dist build
sudo systemctl restart febro-one.service
curl -fsS http://127.0.0.1:3471/api/health
curl -fsS https://one.febro.id/api/health
sudo systemctl is-active febro-one.service
```

To also restore original source files, extract `apps packages scripts tests package.json package-lock.json vite.config.ts` from that archive. New V1.2 source files may remain unused; the original production artifacts run independently. Do not overwrite `.env` or Nginx during routine rollback.

Do not automatically restore the database dump: doing so discards records created after the snapshot. A full database/uploads restore requires a scheduled maintenance window and an operator-selected recovery point. Keep `deleted_at` during application rollback; older code ignores the additive column, and trashed records remain archived rather than being physically removed. The deployment script automatically restores previous frontend/backend artifacts and restarts only `febro-one.service` if post-publication verification fails.
