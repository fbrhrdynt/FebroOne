# Test results — 23 October 2026

## Executed automated checks

Environment: managed Linux development container, Node24.19.0, npm11.9; TypeScript/Vite production build. Database integration uses **PGlite (PostgreSQL WASM)**, not an installed native PostgreSQL daemon. Fastify API is exercised through app.inject with real SQL migrations, constraints and transactions. No fake bank transactions are shipped; all test fixtures are disposable.

`npm test`: **28 passed, 0 failed, 0 skipped**, approximately2.76s in the recorded run. Raw report: docs/test-run.txt.

Coverage includes exact decimal conversion, transfer invariants, reducing/flat/variable interest amortization and extra payments, recurrence/date/streak logic, engineering formulas/conversions, expiry notifications, negative reconciliation, Excel import/formula rejection, repeatable migration, login/logout/recovery/origin/CSRF behavior, owner isolation, CRUD/versions/conflict/archive/restore, all catalog module persistence, dependencies/recurring task completion, balances/idempotency/reversals, debt partial payments/interest/overpay/reversal, cross-owner links, magic-validated certificate upload/private download/delete, reminder generation, automation exactly-once, unconfigured AI and authenticated export, atomic import rollback/replay.

`npm run build`: **passed**, including TypeScript noEmit, Vite frontend and esbuild Node backend. Log: docs/build-run.txt. Vite warns that main/Excel chunks exceed500KB; this warning is not suppressed. Approximate production sizes: main639KB (206KB gzip), lazy rich editor408KB (130KB gzip), lazy Excel937KB (271KB gzip). Actual final names/sizes are in the log.

`npm audit --json`: **0 reported vulnerabilities** after overriding ExcelJS's transitive UUID to11.1.1. Report: docs/npm-audit.json. Dependency registry results are time-specific, not proof of absence of security defects. Workbook round-trip/parser test passed with the override.

Shell scripts were syntax checked with bash -n. Their privileged operations were not executed in this environment.

## Browser smoke checks

Cloud Chrome via supervised Vite trial preview. Earlier checks created a task, reloaded to confirm persistence, created an account with100000 opening and25000.50 expense, observed74999.50 balance and zero income. These are QA-only data, not seed data.

Responsive iframe widths390 and320 were inspected; bottom navigation Home/Calendar/Quick Add/Tasks/More is available. Calendar month and light/dark themes were visually checked at320; a body min-width horizontal overflow was found and removed. Quick Add opens the note editor. Desktop Home was inspected at1348px in the earlier run. These checks are limited smoke tests, not full automated end-to-end coverage of every control or an actual iPhone test. Test harness apps/web/qa.html is development-only and is not in the Vite production entry.

## Not executed / no passing claim

- Native PostgreSQL node-postgres/Drizzle transport against the target VPS
- Ubuntu24 systemd/Nginx/Certbot installation, network TLS or actual backup restore
- Lighthouse, LCP, INP, CLS; performance targets remain unmeasured
- Full mobile navigation E2E automation, real iOS/Safari keyboard/PWA checks
- Large-data concurrency/load, accessibility conformance, independent penetration testing
- External AI credentials/provider behavior, SSO or external app compatibility
- Full offline multi-device synchronization and real-world conflict scenarios

The delivered build passes the listed automated tests, but **the full PRD acceptance suite and production readiness have not passed**. Follow INSTALL_UBUNTU.md acceptance steps and FEATURE_MATRIX.md limitations before using private/financial production data.

Additional current-run browser result: a note titled QA mobile note with Markdown text was saved through Quick Add at320px and appeared in Home's recent notes and activity list. No QA browser data is included in source or deployment assets.
