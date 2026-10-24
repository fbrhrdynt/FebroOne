# Febro One Bento v3 implementation report

## Design changes

Continued the existing React application and its shared components. Added the requested blue, sky, mint, lavender, orange, pink and cyan palette, 18–24px card corners, quieter shadows, clearer typography, accessible action colors, and matching dark surfaces. The dashboard uses a 12-column desktop grid and compact two-column mobile sections. Screenshots are in `docs/bento-v3/` and use synthetic data in an isolated PGlite database, never invented production figures.

The personalized dashboard now includes task completion, active-task checklist progress, agenda, account balances, monthly cashflow, recent transactions, projects, reminders, notes, habits, training/work totals, documents, goals, focus timer and Quick Add. Its data comes from existing records and finance APIs. Empty records show actions; loading financial values do not show fabricated balances. Monthly cashflow uses Decimal arithmetic and follows the existing Finance calculation: transfers and principal are excluded, debt interest is included, reversed transactions are excluded. Starting/stopping a focus session uses the existing `focus-start` storage key and persists a timesheet through the existing record API.

## Updated modules

- Home: real-data Bento dashboard, greeting, completion ring, checklist progress, cashflow bars, transactions, timer, and compact capture actions.
- Tasks: colored status badges; existing list, board, search, filters, relationships, server pagination, checklist progress and automatic completion retained.
- Calendar: mobile agenda default, month/week/day/agenda/year retained, keyboard-accessible date selection, selected/today states, distinct task/reminder/event colors and larger targets. Existing recurrence, drag/drop and ICS behavior retained.
- Finance/debts: colored account/cashflow statistics and saved privacy preference respected when opening the module. Existing ledger, budget, debt calculations, reversal/import/export and transaction filtering retained.
- Navigation: reusable mobile bottom navigation, module icons and accents, module search results in workspace search, persistent desktop sidebar collapse. Existing server-persisted accordion preferences retained.
- All 34 record modules, Settings, Reports/Insights, Tools and More inherit the shared card, form, modal, navigation, table, status and theme system. Existing route implementations and pagination remain in use.
- Added reusable ActivityCard, ChartCard, ModuleHeader, QuickAction, MobileBottomNavigation, CompletionRing, StatusDot and ModuleIcon. Existing BentoCard, StatCard, ProgressCard, StatusBadge, SearchableSelect, FilterDropdown, DataTable, ResponsiveModal and EmptyState retained; SkeletonLoader aliases the existing accessible loader.

## Production safety

No Git repository exists in `/opt/febro-one`; file comparison uses the pre-change archive. Root-only `backups/bento-v3/application.tar.gz` contains relevant source and original production frontend/backend artifacts. `backups/bento-v3/database.dump` is a PostgreSQL custom-format dump validated with `pg_restore --list`; evidence is in `docs/bento-v3/backup-validation.log`. No migrations or schema changes were needed. No existing user data or relationships were intentionally changed. No secrets, environment files, VAPID keys, Nginx configurations, port, authentication or API contracts were changed.

Manifest and icon files are unchanged. The service worker change only increments its shell cache namespace to `febro-one-shell-bento-v3`; API exclusion, push display/click handlers and registration remain in place. Push sender/subscription code and schedules are unchanged.

## Files changed

- `apps/web/src/App.tsx`, `Bento.tsx` (new), `CalendarPage.tsx`, `FinancePage.tsx`, `FocusTimer.tsx` (new), `Home.tsx`, `RecordsPage.tsx`, `WorkspaceCategories.tsx`, `bento.css`, `money.ts`, `ui.tsx`.
- `apps/web/public/sw.js`.
- `tests/bento-v3.test.ts` (new accounting regressions).
- `scripts/bento-v3-browser.mts`, `scripts/bento-v3-deploy.sh` (new validation/deployment tools).
- Generated frontend/backend artifacts published to `dist/` and `build/`, with reviewed copies in `.bento-v3-stage/`; validation evidence and light/dark desktop/mobile screenshots are in `docs/bento-v3/`.
- This report. Source comparison list: `docs/bento-v3/changed-files.txt`.

## Test results

- TypeScript `--noEmit`: passed on bundled Node 24.
- Full existing suite plus new cashflow tests: 42 passed, 0 failed, 1 PostgreSQL opt-in test skipped in the ordinary suite. See `docs/bento-v3/tests.log`.
- Opt-in PostgreSQL production adapter test: separately passed, using a synthetic owner inside an outer transaction with rollback. See `docs/bento-v3/postgres.log`.
- Production frontend build and backend esbuild bundle: passed into `.bento-v3-stage`, leaving live artifacts untouched during validation. Commands use the installed Node 24, TypeScript, Vite `--configLoader runner`, and esbuild. The runner avoids the existing root-owned Vite temporary-directory permissions. No dependency changes. The backend bundle is byte-identical to the previous production bundle.
- Expanded interaction and keyboard smoke passed against the isolated database: Quick Add task, checklist completion/reopening and derived progress, focus timesheet persistence, saved privacy preference, sidebar collapse persistence, theme reload persistence and logout. Calendar views, empty/light/dark dashboard layouts, dialog keyboard focus, Quick Add handoff focus, Escape dismissal, bounds, navigation target sizing, header overlap and bottom-navigation clearance also passed. See `docs/bento-v3/interactions-final.log` and `docs/bento-v3/accessibility-results.json`.
- Final frozen-build browser sweep: 252 route/viewport visits (42 routes at 375, 390, 430, 768, 1366 and 1920 pixels), zero horizontal overflow, zero browser runtime errors. Empty dashboards, dark dashboards, critical workflow assertions and keyboard/modal checks also passed. See `docs/bento-v3/browser-final.log`, `browser-results.json` and `accessibility-results.json`.
- Production HTTPS checks: all 42 SPA routes and linked static assets passed; authenticated login, Secure cookie, identity, five-module create/update/archive/restore, finance reads, notifications, sessions and push configuration passed. Synthetic owner, records and audit entries were removed, with cleanup verified by the smoke script. Public anonymous records access returns 401.
- Public HTML, all linked JS/CSS, service worker, manifest and iOS/PWA PNG icons were byte-compared to the staged build and matched. Local and public database-backed health endpoints returned HTTP 200 / `status: ok`. Evidence: `docs/bento-v3/deployment.log` and `public-assets.log`.

## Performance observations

Existing route, rich-text editor, spreadsheet, CSV and ICS lazy imports remain intact. Initial JS entry is approximately 378 KB minified / 124 KB gzip; shared vendor chunks remain separate. Initial-asset comparison is recorded in `docs/bento-v3/performance.json`. No dependency added. The existing ExcelJS chunk remains about 937 KB minified / 271 KB gzip and the editor about 408 KB / 130 KB gzip, loaded on demand. The build still reports the ExcelJS size warning and upstream Zod comment-annotation warnings. No lab performance score or real-device performance improvement is claimed. Reduced-motion behavior is preserved.

## Deployment status

Successfully deployed on **2026-10-23 at 23:34 WIB (UTC+07:00)** to https://one.febro.id.

Only `febro-one.service` was restarted; its active timestamp is 23:34:37 WIB. The backend remains on port 3471. New frontend assets were published before atomic index replacement; prior hashed assets were retained. Backend output is byte-identical to the prior production build. No migration, Nginx reload, environment update, dependency installation or unrelated service restart occurred.

The first two local readiness requests briefly encountered connection refusal while the authorized service restart completed; retries recovered. All final local/public checks and production CRUD smoke passed. No rollback was needed.

Published HTML SHA-256: `25f385d82cc7996f523df6fe05cd8282b0701a340961d90252358796787e6b82`. This equals the HTML hash recorded by the successful browser run and the staged build. `scripts/bento-v3-deploy.sh` checks this artifact hash and workflow results before deployment and restores prior runtime artifacts on a verification failure.

## Validation incident

One overlapping build/test/browser attempt exceeded the host's memory. Kernel logs confirmed termination of QA Chromium and a QA Node process. The existing production service retained its original active timestamp and stayed healthy; no deployment had taken place. Validation was rerun sequentially with `--test-concurrency=1`. The passing suite and browser results supersede that interrupted attempt; its logs remain in `docs/bento-v3/tests-concurrent-attempt.log` and `docs/bento-v3/browser-interrupted.log`. No server memory settings or unrelated services were changed.

The keyboard checks also found and fixed the inherited modal opener-focus issue. The shared modal now restores focus and handles the Quick Add-to-form handoff. A previous checklist browser assertion was adjusted to await the real asynchronous server update rather than expecting synchronous checkbox state.

## Known limitations

Browser automation uses headless Chromium viewport sizes, not a physical iPhone or iOS Safari. iOS Home Screen installation, operating-system notification presentation and external push-provider delivery have not been exercised on a real device in this change. Notification scheduling/subscription tests cover the existing backend behavior; no real notifications were sent. Automated route sweeps cannot exhaust every form, user-data combination or attachment workflow. Dashboard summary panels remain always present; the existing customization dialog controls its five primary widgets. Existing full-record dashboard fetching is retained, so very large personal datasets may merit a separate aggregate API project. The focus timer retains the existing browser-local session model.

## Rollback instructions

From `/opt/febro-one`, restore only prior runtime artifacts and restart only this service:

```bash
sudo tar -xzf backups/bento-v3/application.tar.gz -C /opt/febro-one dist build
sudo systemctl restart febro-one.service
curl --retry 8 --retry-delay 1 --retry-all-errors -fsS https://one.febro.id/api/health
```

Previous hashed assets remain available for older open tabs. The archive also contains the original source if a source rollback is required; restore selected source paths deliberately. No database rollback is needed because this is a frontend change with no migration. Do not restore the database dump over newer user data without a separate recovery plan. Environment and secrets are excluded from the application archive and must remain untouched.
