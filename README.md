# Febro One

Your Entire Life. One Workspace.

A working personal workspace with a React client, Fastify API, PostgreSQL ledger, private uploads and a browser-local trial. This delivery is **not complete against every PRD acceptance criterion and is not certified production-ready**. Read FEATURE_MATRIX.md before deciding to use it for important records.

## Two operating modes

- Hosted trial: actual editable records, files and financial calculations stored in IndexedDB on your current browser/device. No sample account or invented transactions. Clearing browser storage removes trial data; export regularly. No cross-device sync, server backup, production login or external AI in this mode.
- Self-hosted: default production build calls same-origin `/api`, requires a first-run administrator, and persists data in PostgreSQL and private disk storage. There are no embedded credentials. VPS access was neither requested nor used.

## Start

For a local browser-only trial with Node 24: `npm ci`, then `npm run dev` (port 4173). For Ubuntu installation follow **INSTALL_UBUNTU.md**, which uses an isolated Node runtime, localhost API, PostgreSQL, Nginx and systemd. No Docker or PM2.

`npm test` runs domain/API/Excel tests. `npm run build` type-checks and builds frontend/backend. `npm run build:trial` produces a browser-local static frontend; do not install that build as your VPS production frontend.

## Daily use

Use Quick Add for tasks, events and notes; More opens all record groups. Edit a record to attach files, inspect versions and link related records. Archive has Undo. Finance starts with your own accounts/opening balances; enter transactions or import the documented CSV/XLSX format. Transaction correction uses reversal plus a new entry. Settings exports JSON metadata; download files separately. Production recovery uses the one-use code printed during admin creation.

CSV/XLSX first-row columns: `kind,accountId,toAccountId,amount,category,date,description,reference`. Kind is income/expense/transfer, amount is a positive decimal with up to 2 places, date YYYY-MM-DD. Use an exported file as the format example and actual account UUIDs. Reference must distinguish otherwise identical legitimate entries. Importing the same content/reference is idempotent; batch validation/booking is atomic. Financial imports are limited to 1 MB/1000 rows; Excel formulas are rejected. Exported transaction rows exclude reversals, opening balances, reconciliation and debt postings; JSON export retains the broader financial data.

## Documentation

- INSTALL_UBUNTU.md — install, HTTPS, status, updates, backup/restore
- FEATURE_MATRIX.md — scope and known omissions by module
- TEST_RESULTS.md — executed tests and validation limits
- ARCHITECTURE.md / DATABASE_SCHEMA.md — implementation and data relationships
- SECURITY.md — controls and remaining risks
- IMPLEMENTATION_LOG.md — checklist and changes
- docs/ORIGINAL_PRD.md — supplied PRD
- docs/DEPENDENCY_LICENSES.md — installed dependency license declarations

Source ZIP excludes dependencies, build output, credentials, runtime binaries and live databases. Run `npm ci` using the included lockfile to reproduce dependencies.
