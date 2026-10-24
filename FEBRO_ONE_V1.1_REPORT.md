# Febro One V1.1 continuation report

Verified 2026-10-23 (Asia/Jakarta). Continued the existing implementation in `/opt/febro-one`; no replacement application was created.

## Initial inspection and preservation

- This installation has no `.git` repository, so a Git diff/baseline could not be obtained. No previous `FEBRO_ONE_V1.1_REPORT.md` existed.
- Inspected the existing source, both SQL migrations, tests, previous production build log, generated build, and running `febro-one.service`.
- PostgreSQL already had `001_initial.sql` and `002_v11.sql` applied. No migration was needed or applied in this continuation.
- Took a fresh PostgreSQL custom-format backup at `/opt/febro-one/backups/v11-20261023/database.dump`, directory mode 0700/file mode 0600. `pg_restore --list` successfully read its catalog (133 lines). A full restore rehearsal was not performed.
- Existing `.env`, Nginx configuration, existing application accounts/data, and other applications were not modified. Port 3471 remained listening before and after deployment. Febro One continues on its existing port 3470 behind HTTPS.

## Features present and verified

1. **Workspace menus:** category expand/collapse, Expand All and Collapse All, accessibility expansion state, and owner-specific PostgreSQL preferences. Preferences survive application recreation; live HTTPS preference persistence passed.
2. **Tasks:** multiple editable, reorderable checklist items persist inside PostgreSQL record JSON. The API derives To Do (none checked), In Progress (some checked), Completed (all checked), and percentage. Reopening items updates status. Legacy checklist text remains supported. Parent task references and cycle rejection are implemented. Separately linked child task records do not aggregate their statuses into parents; automatic progress derives from the parent's checklist.
3. **Persistence:** production records, relational IDs, preferences, sessions, versions, notifications, push subscriptions, VAPID keys, and delivery state are PostgreSQL-backed. IndexedDB supports caching and explicitly queued offline note drafts; localStorage includes transient/UI state such as the focus timer and theme. Trial mode deliberately uses local data and is separate from production.
4. **Relations:** company/category/project dropdowns reference reusable records. API validation enforces owner, kind and active references; PostgreSQL stores relational columns with owner-scoped foreign keys. Migration tests cover legacy text conversion without deleting historical labels.
5. **Record tables:** searchable/sortable/paginated record views and relationship/status filters. Fixed the prior implementation that fetched every record before paginating: production list views now request 30 records per page from PostgreSQL. Added server tag searching, combined relationship filtering, status filtering and pending-task counts. Global search now requests at most 30 matching records instead of downloading the whole database. Record list reference loading is restricted to relevant master types (and habit entries for habits). CSV labels explicitly identify page exports in paginated mode. Finance transaction lists now have date/amount sorting and 30-row pagination, replacing the silent first-100-match cutoff.
6. **PWA:** standalone manifest with scope/id/start URL, 192/512 PNG icons, 180px Apple touch icon, Apple standalone metadata, service-worker registration, shell/offline handling, and push/click event handlers. Private API responses are excluded from service-worker caching. HTTPS manifest, service worker and Apple icon returned successfully.
7. **Push implementation:** authenticated VAPID subscription registration/removal, owner isolation, provider validation, permission request triggered by a button, iPhone Safari Add to Home Screen instructions, and server scheduling every minute. Recurring reminders use the user's timezone and handle DST. Delivery claims suppress concurrent sends; expired subscriptions are deleted. Fixed failed/stale delivery claims remaining permanently stuck: unsent claims can retry after five minutes. Automated tests exercise transient failure, delayed retry, successful deduplication, recurrence, and expired devices using a simulated push sender.

## Tests and build

- Final `npm test`: **36 tests; 35 passed, 0 failed, 1 skipped**. The skipped test requires explicit PostgreSQL opt-in.
- Ran that PostgreSQL production-adapter test separately against the configured database: **1 passed, 0 failed**. It exercised shared record CRUD across catalog kinds, text-array binding, versions, persistence, archive/restore, and rolled back its synthetic data.
- Integration tests cover authenticated/CSRF/owner boundaries, checklist transitions, relational validation, parent cycles, preference persistence, table pagination/filtering/sorting, push registration/scheduling/retry, and migration replay/data preservation. Most integration tests use isolated PGlite databases.
- Production `npm run build`: **passed**, including TypeScript, Vite and bundled API. Nonfatal existing Zod annotation and large-bundle warnings remain.
- Logs: `/tmp/febro-v11-tests-final.log`, `/tmp/febro-v11-build-final.log`. These temporary logs may be removed by host maintenance.

## Deployment and live verification

- Restarted **only** `febro-one.service` after successful production builds, including the final Finance pagination fix. Confirmed active/running state and reviewed the service journal. An immediate post-restart request briefly returned HTTP 502 before the listener was ready; the subsequent full HTTPS CRUD verification and health check passed. This deployment uses restart, not zero-downtime replacement.
- `https://one.febro.id/`: HTTP 200.
- `/api/health`: HTTP 200, status ok, version 1.1.0.
- Unauthenticated `/api/records`: HTTP 401.
- Using an isolated temporary account through actual public HTTPS, verified login, persisted Workspace preferences, company creation, related task creation, To Do → In Progress → Completed checklist updates, tag search/pagination/relation filtering, archive, restore, and logout.
- Removed the temporary account, records, versions and audit entries afterward; verified zero remaining live-verification users. Existing user records were not used for these writes.
- Ports 3470 and 3471 remained listening. No Nginx configuration was changed.

## Remaining limitations and unverified behavior

- **Real Web Push delivery is NOT verified.** No real browser/device subscription or APNs/FCM delivery was exercised. Simulated transport tests do not establish that notifications reach an iPhone.
- Actual iPhone Safari installation, permission grant in the installed Home Screen app (iOS 16.4+), background/locked-device notification display, notification tap, and device revocation still require physical-device acceptance testing. Permission denial or unsupported browser behavior is reported by the UI; installation instructions are present.
- There was no interactive browser available in this verification. Responsive layout, touch interaction and visual appearance were not manually exercised.
- Record list pagination is server-side; task board mode, record forms/link pickers, dashboards and some other views still load their relevant collections. Finance has client-side filtering/sorting/pagination and still loads its financial state as a collection. Therefore this continuation does **not** claim comprehensive large-dataset pagination across every application screen. General search currently uses ILIKE; very large installations may need indexed search and performance testing.
- A network interruption after push-provider acceptance but before database acknowledgement can result in a retry; end-to-end exactly-once delivery is not guaranteed.
- Backup catalog validation passed; full disaster-recovery restoration was not tested.
