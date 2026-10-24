# Architecture

## Deployment

Browser → Nginx HTTPS → static Vite files or localhost Fastify :3470 → PostgreSQL. Private file bytes live outside the public web root at /var/lib/febro-one/uploads. Only the authenticated file API reads them. systemd runs a dedicated unprivileged account. The frontend and API are same-origin.

`apps/web/src`: React Router lazy pages, TanStack Query server cache, reusable Radix/shadcn-style components with CVA, Tailwind plus explicit responsive CSS, Lucide icons. TipTap, ICS and Excel parsing load on demand. Home aggregates actual records. All catalog forms use shared field definitions. The navigation adapts from a bottom bar on mobile to a desktop sidebar. Theme uses CSS variables; system fonts avoid external font tracking.

`packages/shared`: Zod validation, record catalog, decimal money, debt schedules, recurrence, notifications and unit/formula implementation. `apps/api/src`: Fastify routes/session guards, ledger functions, private upload and scheduled rule processing. `packages/db`: SQL migration plus Drizzle declarations. `scripts`: migration, admin setup and operational commands. `tests`: Node test runner with PGlite integration database.

## Persistence and consistency

General records use a shared owner-scoped versioned JSONB model, not one normalized table per module. Finance, authentication, links, files and audits are normalized. This is an explicit deviation from the requested fully normalized per-domain model. Drizzle executes parameterized SQL through a node-postgres adapter; migrations are versioned SQL, tracked transactionally. Some Drizzle schema declarations cover only core tables; SQL is authoritative.

The ledger stores integer minor units as PostgreSQL bigint and calculates money with bigint/Decimal, never binary floating point. A transaction's postings must sum to zero through a deferred database trigger. Transfers debit and credit two accounts and do not enter income totals. Opening balances and reconciliation are separate kinds. Debt principal reduces outstanding balance; only interest is an expense. Financial mutations serialize per owner, validate account ownership, and use idempotency keys plus payload hashes. Reversals retain history.

General records use optimistic integer versions and return 409 on conflict. Soft archives preserve history. Foreign keys include ownership where applicable, so cross-owner links/postings are rejected. API queries always include owner filtering.

## Offline and trial

The build-time VITE_TRIAL flag chooses Dexie or API behavior. Trial is deliberately browser-local, without production session/AI/scheduler semantics. Real mode caches previously loaded data; note edits can queue and conflicts are exposed in Settings for local export/server selection. This is not full multi-module offline synchronization; login reload offline and first-time lazy routes may be unavailable. Service worker caches shell/visited assets, never authenticated API responses. Dexie caches are removed on logout; shared-device browser storage remains a privacy consideration.

## Automation and integrations

Production runs a minute scheduler for due record notifications and supported rules (create task/notify), with unique run keys. No email/SMS/push transport or arbitrary workflow engine. AI is a configurable OpenAI-compatible HTTP provider called only after explicit prompt consent; no keys reach the browser. No autonomous external actions or vector RAG. Launcher URLs are supplied by the user. Febro Ecosystem SSO remains disabled because the inspected repository did not expose verifiable authentication endpoints.

## Known scaling limits

Single-user use is the intended load. Records API paginates, but client aggregates all records for dashboard/search. There is no list virtualization, finance server pagination or large-data performance certification. Initial bundle exceeds the original 200 KB gzip aspiration. Browser printing supplies some PDF reports; no server PDF pipeline. See TEST_RESULTS.md for measurements actually performed.
