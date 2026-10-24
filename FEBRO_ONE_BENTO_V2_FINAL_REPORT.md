# Febro One Bento Grid v2 final report

## Implementation
Continued the existing implementation; no rewrite. Shared responsive Bento shell/cards, dashboard panels using persisted data, task checklist/progress and priority filters, relationship selectors, calendar views, finance/report refinements, profile/theme controls, active-session management and service-worker cache versioning are complete. Existing modules and server persistence remain in place. Fixed dashboard empty-state action overflow in narrow mobile summary cards. Theme switching now preserves default dashboard widgets for accounts without saved widget preferences; a browser assertion covers this regression. Fixed browser harness to scope login to the form, await successful authentication, and distinguish attached sidebar markup from its mobile visibility. Mobile Quick Add targets the visible bottom navigation.

## Inspection and configuration
No Git repository exists in /opt/febro-one. Source comparison used backups/bento-v2-initial/application.tar.gz. Production previously ran the 18:35 build. Confirmed febro-one.service uses bundled Node 24.19.0, build/server.js, production HTTPS origin and loopback port 3471. Inspected /etc/nginx/conf.d/one.febro.id.conf: static dist and existing API proxy. No Nginx, ports, environment, runtime or unrelated services changed. Both 001_initial.sql and 002_v11.sql are already applied; no migration needed.

## Files changed relative to initial Bento backup
- apps/api/src/app.ts
- packages/shared/domain.ts
- apps/web/public/sw.js
- apps/web/src/App.tsx, CalendarPage.tsx, FinancePage.tsx, Home.tsx, Insights.tsx, PushSettings.tsx, RecordForm.tsx, RecordsPage.tsx, Settings.tsx, main.tsx, ui.tsx
- apps/web/src/bento.css and money.ts (new)
- tests/bento-ui.test.ts (new), tests/integration.test.ts
- scripts/bento-browser.mts, scripts/bento-production-smoke.mts (new validation harnesses)
- vite.config.ts (vendor splitting)
- dist/ and build/server.js (production artifacts)
- docs/bento-v2-* (validation logs, browser result and screenshots)
- FEBRO_ONE_BENTO_V2_FINAL_REPORT.md

## Validation
- TypeScript --noEmit: passed.
- Full suite on system Node 22 and service Node 24: 40 passed, 0 failed, 0 cancelled, 1 explicitly opt-in PostgreSQL test skipped.
- Opt-in real PostgreSQL adapter test run separately against configured database: 1 passed, synthetic owner and all records verified absent after rollback.
- Earlier four cancellations did not reproduce on either runtime. No evidence of a remaining open-handle, async cleanup or database-connectivity failure. PGlite integration teardown and app restart checks complete. No security control weakened or artificial keepalive added.
- Production frontend and backend built in .bento-stage without replacing live artifacts during validation. Commands: `npx tsc --noEmit`; bundled Node 24 invoking `node_modules/vite/bin/vite.js build --configLoader runner --outDir ../../.bento-stage/dist`; `node_modules/.bin/esbuild apps/api/src/server.ts --bundle --platform=node --packages=external --format=esm --outfile=.bento-stage/build/server.js`. The runner avoids a root-owned Vite temporary-directory write; dependencies and permissions were left unchanged.
- Final browser run: 252 route/viewport visits (42 routes at 375, 390, 430, 768, 1366 and 1920 pixels), zero horizontal overflow and zero browser runtime errors. Mobile Quick Add persisted a task. Theme persisted after reload and preserved all ten default dashboard panels. Synthetic PGlite database was isolated from production.
- Final production checks: homepage HTTP 200; /api/health HTTP 200 with status ok; anonymous /api/records HTTP 401. All linked static assets and all 42 SPA routes returned expected content. Real HTTPS password login, Secure session cookie, identity, task/note/event/certificate/work CRUD, archive/restore, finance reads, notifications, sessions and push configuration passed.
- Temporary production test accounts and their records, sessions and audit entries were removed. A final database check found zero bento-%@example.test QA users. Existing accounts were not modified.
- Evidence: docs/bento-v2-tests.log, bento-v2-postgres.log, bento-v2-build.log, bento-v2-browser.log, bento-v2-browser-results.json, bento-v2-mobile.png, bento-v2-desktop.png and bento-v2-deployment.log.

## Limitations
Existing ExcelJS export/import chunk remains approximately 937 KB minified, 271 KB gzip; dynamically loaded only when needed. Editor is also lazy loaded. No new dependencies added. Build emits existing size and third-party annotation warnings. Dashboard summary panels for reminders/projects/habits/documents/goals are always included; the existing customization dialog controls the five primary widgets. Browser route validation cannot establish every possible user-data combination or external AI/push-provider delivery.

## Backup and rollback
Root-only backups/bento-v2-final/application.tar.gz contains pre-deployment source and working dist/build, excluding environment and runtime. database.dump is a validated PostgreSQL custom-format dump; uploads.tar.gz preserves application uploads. No existing user records are intentionally edited.

For application rollback, from /opt/febro-one:
```
sudo tar -xzf backups/bento-v2-final/application.tar.gz -C /opt/febro-one dist build
sudo systemctl restart febro-one.service
curl -fsS https://one.febro.id/api/health
```
New hashed assets may remain harmlessly in dist/assets. Database restore is unnecessary for this deployment; no schema migration is applied. Do not restore the dump over newer user data without an explicitly planned database recovery.


## Final production deployment
Successful, 2026-10-23, Asia/Jakarta (UTC+07:00).

| Artifact | Build timestamp |
| --- | --- |
| dist/index.html (final frontend) | 2026-10-23 22:33:40 +07:00 |
| build/server.js (backend) | 2026-10-23 22:26:50 +07:00 |
| Previous frontend/backend | 2026-10-23 18:35:24 +07:00 |
| Final service start | 2026-10-23 22:35:53 +07:00 |

Only febro-one.service was restarted. New hashed assets were published before replacing index.html; old hashed assets were retained for existing tabs and rollback. Service is active and serves the validated production build at https://one.febro.id on the existing backend port 3471.

The first deployment automatically rolled back when temporary QA-user cleanup encountered its audit-log foreign key, even though endpoint checks had passed. Cleanup was corrected to remove only that synthetic owner's audit entries, the stranded temporary owner was removed, and subsequent deployments passed cleanup. A final screenshot review also caught the new-account theme/widget fallback regression; it was fixed, rebuilt and revalidated before the final deployment. Brief HTTP 502 responses occurred while the service restarted; readiness retries recovered and final HTTPS checks passed. No database restore or schema change was needed.
