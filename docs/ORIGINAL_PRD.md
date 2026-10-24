# FEBRO ONE — PRODUCT REQUIREMENTS DOCUMENT
**Version:** 1.0 | **Date:** 22 October 2026 | **Status:** Build-ready specification

## 1. Product vision
Febro One is a private, mobile-first Personal Life Operating System that consolidates productivity, personal finance, debts, life activity, work and career evidence, knowledge, and personal tools. The product must feel fast and usable with one hand on an iPhone. Product URL: `https://one.febro.id`; DNS A record has been configured by owner to `161.248.116.14` (verify propagation). Brand: Febro One; internal workspace area: Febro Workspace. Primary user: one owner; architecture allows additional accounts later without exposing the owner's data. No equipment maintenance module or duplicate AMT.

## 2. Non-negotiable constraints
- Install under `/opt/febro-one`, Ubuntu VPS, Nginx + **systemd**, **no PM2 and no Docker** for Febro One. Bind API to `127.0.0.1:3470` only after checking port availability. Never modify other virtual hosts, processes, services or ports.
- Responsive, mobile-first PWA, accessible with one hand; clean, flat, understated white/ice-blue UI with fully tested dark theme. Respect anti-slop design: no gratuitous gradients, giant hero banners, decorative metrics or meaningless animations.
- Production-ready persistent storage; **no fake or hard-coded demo records in production**. Demo/seed data only behind an explicit dev flag.
- Separate personal data from employer/client confidential data. Never ingest protected Halliburton/Baroid materials without authorization. No claim to replace AMT, HSE approval, or company systems.
- Do not store bank credentials, access tokens in browser localStorage, or plaintext secrets. Financial integration only via supported, authorized provider APIs; start with manual/CSV imports.
- All calculations use decimal-safe amounts in IDR minor units or equivalent decimal representation; no floating-point currency drift. Track currencies explicitly.

## 3. Navigation and information architecture
Mobile bottom navigation: Home | Calendar | Quick Add | Tasks | More. Desktop collapsible sidebar and global search/command palette. More exposes sections, not a flat 50-item list.

| Group | Submenus |
|---|---|
| Home | Dashboard, My Day, Unified Inbox, Daily Timeline, Global Search |
| Productivity | Calendar, Agenda, Tasks, Reminders, Habits, Time Tracking, Routines |
| Notes & Knowledge | All Notes, Daily Journal, Meeting Notes, Knowledge Base, Bookmarks, Ideas |
| Finance | Overview, Accounts/Wallets, Transactions, Categories, Budgets, Cash Flow, Recurring Bills, Savings Goals, Assets, Net Worth, Reports, Imports |
| Debt | Loans & Debts, Installments, Payment Schedule, Payoff Planner, Receivables, Payment History |
| Workspace | Work Records, Job History, Assignments, Projects, Timesheets, Achievements |
| Career | Employment History, Training, Competency Matrix, Skills, Certificates, Career Timeline, Learning Plan |
| Life | Activities, Goals, Family/Important Dates, Travel, Personal Inventory, Wellness Journal |
| Files | Documents, Certificate Vault, Attachments, Templates, Expiry Tracker |
| Tools | Engineering Calculator, Unit Converter, App Launcher, File Utilities |
| Intelligence | Personal Insights, Reviews, Automations, AI Assistant (opt-in) |
| Settings | Profile, Appearance, Notifications, SSO, Security, Data Import/Export, Backup Status |

## 4. Cross-module behavior
Every record has owner_id, created_at, updated_at, optional archived_at, timezone-aware dates and an immutable stable ID. Optional typed links between records (e.g. task -> calendar event, training -> certificate -> competency evidence; expense -> trip; work record -> skill). Universal Quick Add can create note/task/event/expense/activity/work record from anywhere. Avoid silently creating financial transactions or competency achievements; require confirmation. Inbox captures uncategorized items. Unified search respects authorization and handles partial matches. Support local timezone Asia/Jakarta by default, configurable per user.

## 5. Functional requirements and acceptance criteria
### 5.1 My Day & Calendar (P0)
Day/week/month/agenda views; create, edit, delete, drag/reschedule events; all-day and multi-day; categories Work/Personal/Training; recurrence with exceptions; linked tasks and reminders. My Day lists today's schedule, overdue tasks, next reminders and quick notes. **Acceptance:** a recurring event survives reload and timezone changes; event edits do not accidentally alter unrelated recurrence instances; no duplicates on sync.

### 5.2 Tasks, reminders, habits (P0 tasks; P1 habits)
Task statuses Inbox, To Do, In Progress, On Hold, Completed, Cancelled; priority, due date, subtasks, checklist, attachments, tags, project, recurring rules, audit trail. Views: list, Kanban, today, upcoming, completed. Notifications in-app; web push when supported and explicitly permitted, email fallback optional. **Acceptance:** completed tasks remain searchable; overdue logic honors timezone; recurring tasks do not duplicate after refresh; notifications degrade gracefully on iOS.

### 5.3 Notes & Journal (P0)
Rich text with Tiptap or compatible permissively licensed editor; autosave, tags, folders, pinned notes, links to other records, image/file attachments, full-text search, daily journal prompts optional. Markdown export. **Acceptance:** no data loss on network interruption; XSS sanitized; offline drafts show sync state and conflict handling.

### 5.4 Finance (P0 core, P1 advanced)
Multiple accounts (bank, cash, e-wallet), opening balances, income, expense, transfers, categories, transaction attachments, split transactions, budget periods, recurring bills, savings goals, assets/liabilities, net worth, CSV import with preview/deduplication, export. Support IDR default, future multicurrency with explicit FX provenance. Use double-entry-style ledger invariants or equivalent auditable postings. **Acceptance:** transfers do not inflate income/expenses; transaction edit/delete reverses balance impact correctly; account reconciliation reports discrepancy; imports are idempotent; monthly rollovers deterministic.

### 5.5 Debt & Receivables (P0)
Track amount borrowed/lent, creditor/debtor nickname, APR or flat-rate model, start/due date, installments, fees, principal, interest, outstanding balance, payment history, reminders. Payoff projection supports snowball and avalanche as simulations with assumptions displayed. **Acceptance:** installment payment updates ledger and outstanding balance exactly once; early payment and variable interest are handled or explicitly marked unsupported; cannot overpay without confirmation; projections are clearly estimates.

### 5.6 Work Records & Career (P0)
Work logs (date range, role, activity, contribution, skills, evidence), employment history, job history, projects, achievements, training record (provider, date, duration, completion status), competency matrix (level, evidence, assessment date), certificate upload (issuer, ID optional, issued/expiry, file), expiry reminders at configurable intervals. **Acceptance:** a training record can link to several skills and one or more certificates; expired certificates are clearly flagged; career export generates a structured summary; no confidential employer records required.

### 5.7 Life & goals (P1)
Daily activity timeline, recurring habits, goals/milestones, important dates, travel planner, personal inventory and optional wellness journal. No diagnosis or clinical claims. Link expenses to trips and milestones to tasks.

### 5.8 Files & tools (P1)
Private file upload/download with authorization, MIME validation, size limits, virus scanning when available, quota, previews for safe formats, no direct public Nginx exposure. App launcher links existing Febro apps without copying them. Engineering tools must show units, formulas, assumptions, precision, and warning that field use requires verification.

### 5.9 Insights, AI, automations (P2)
Weekly/monthly reviews (completed tasks, learning hours, expense trends, debt progress), scheduled rules and reminders, AI-assisted notes/summaries/search only after opt-in. AI provider is configurable; redact sensitive content by default; no external transmission without consent. Display sources for AI answers from notes. AI failures must not affect core CRUD.

## 6. UX / design requirements
- Target 320px to desktop widths; minimum 44x44px touch areas; bottom bar safe-area aware; sticky Quick Add; no horizontal scroll for primary pages.
- Primary actions within 1–2 taps; progressive disclosure on complex forms; keyboard shortcuts on desktop; skeletons only when needed, explicit empty/error/success states.
- Design tokens: neutral background, subtle pale-blue accent, restrained semantic success/warning/danger; system fonts or optimized local fonts; WCAG AA contrast target.
- Finance private-view toggle masks balances in overview and app switcher where feasible; never confuse visual masking with encryption.
- Offline: first ship online CRUD with resilient local draft capture; later IndexedDB queued writes with idempotency keys, sync status, conflict UI. Never promise full offline capability without test coverage.
- No automatic download of PDF viewer, analytics charting, rich editor or AI bundle on initial dashboard route.

## 7. Recommended architecture
Monorepo: `apps/web` React + TypeScript + Vite + TanStack Query/Router; `apps/api` Node.js + Fastify; `packages/db` PostgreSQL + Drizzle ORM; `packages/ui` shared primitives; `packages/shared` types and Zod schemas. React frontend served as static assets by Nginx; API proxied under `/api` to localhost systemd service. PostgreSQL local or secured private network. Migrations mandatory. File storage outside public root; backup to separate protected location. Prefer proven permissively licensed OSS components (Tiptap editor, FullCalendar Standard, Dexie, dnd-kit, shadcn/ui); review exact version licenses, dependencies and security before use. Avoid embedding full external apps with incompatible licenses. Auth: verify existing Febro Ecosystem SSO implementation; use standards-based OIDC only if actually supported; otherwise secure local auth until integration is verified. Cookies HttpOnly, Secure, SameSite, CSRF defenses as appropriate; session rotation and rate limiting.

### Suggested domain model
users, sessions, preferences, events, event_recurrences, tasks, task_subtasks, reminders, notes, note_versions, tags, entity_links, attachments, projects, work_records, employments, trainings, competencies, competency_evidence, certificates, financial_accounts, ledger_transactions, ledger_postings, categories, budgets, budget_lines, recurring_rules, debts, debt_schedules, debt_payments, savings_goals, assets, activities, habits, habit_entries, goals, milestones, notifications, audit_logs, import_jobs, idempotency_keys. Add indexes on owner_id + date/status and full-text search; enforce referential integrity, decimal-safe finance values, and ownership at every API boundary.

## 8. Security, privacy and operations
Threat model: stolen phone/session, leaked backup, unauthorized file download, malicious upload, CSRF/XSS, accidental finance duplication, accidental cross-user access. Security requirements: password hashing (Argon2id if local), MFA optional, secure sessions, RBAC/ownership checks, upload validation, request size limits, audit logs for sensitive edits, no secret logging, TLS, backup encryption, restore drills, least-privilege Unix user, systemd hardening, CSP, dependency scanning, retention/export/delete policies. Never include actual user credentials, company secrets, real financial details or certificates in repo or ZIP. `.env.example` only.

## 9. Performance targets and testing
Targets measured on representative mobile network/device: LCP <=2.5s, INP <=200ms, CLS <=0.1, Lighthouse >=90 under documented conditions; aim initial JS <=200KB gzip where practical. Lazy-load routes, paginated lists, indexed DB queries, responsive images, bundle analysis. Unit tests: ledger invariant, debt amortization, recurrence/timezone, reminder scheduling, competency links. Integration tests: auth, CRUD ownership, uploads, migrations, import idempotency. E2E tests: iPhone-sized viewport, calendar/task/note flow, expense+debt payment, training+certificate, refresh, backup restore. Accessibility checks, dark mode, slow network, error recovery.

## 10. Phased delivery and definition of done
**M0 — foundation:** working responsive shell, secure login, DB migrations, API health, empty states, theme, systemd/Nginx example, README.
**M1 — productivity:** calendar, task, note, reminders, My Day, cross-links; fully working CRUD.
**M2 — finance:** accounts, transaction ledger, budget, debt and installment, CSV import; reconciliation tests.
**M3 — career:** work records, training, competency, certificates, career timeline, secure uploads.
**M4 — life & files:** goals, habits, activity journal, travel, vault, app launcher.
**M5 — intelligence & offline:** analytics, AI opt-in, robust offline sync, automations.
Every milestone requires real persistence, working UI/API, test results, documentation, and no placeholder buttons. If full scope cannot fit one execution, complete M0+M1 well, report exact remaining items and provide executable next steps. Never falsely label unbuilt modules complete.

## 11. Required source ZIP and VPS installation deliverables
Output `febro-one-source-v1.0.zip` with source code (no `node_modules`, build cache, secrets, uploaded user data, `.env` or database dumps), `README.md`, `INSTALL_UBUNTU.md`, `DEPLOY.md`, `.env.example`, DB migrations, systemd unit template, Nginx vhost template, backup/restore scripts, tests, license/attribution notices and release notes. Provide SHA-256 checksum. Tutorial must:
1. Preflight inspect `node -v`, `nginx -t`, `ss -ltnp`, current vhosts, `systemctl` and PostgreSQL before choosing ports/users.
2. Create least-privilege service user, `/opt/febro-one` with correct ownership and restricted environment file permissions.
3. Install pinned dependencies, configure PostgreSQL database and restricted DB user, apply migrations, build frontend/API.
4. Configure systemd unit (Restart=on-failure, environment file, working directory, restricted privileges), `daemon-reload`, enable/start, check `journalctl`.
5. Add **only** `one.febro.id` Nginx server block; serve static assets and reverse proxy `/api` to localhost; test `nginx -t` before reload.
6. Verify DNS with `dig one.febro.id +short`, request TLS cert with Certbot only after DNS and HTTP reachability checks.
7. Run HTTPS, `/api/health`, login, database persistence, uploads, financial invariant and mobile smoke tests.
8. Explain update, backup, restore and rollback procedures; backup before migrations; avoid overwriting any existing services.
9. Include copy-pasteable commands with shell continuations when needed, and clearly label placeholders that require owner input.

## 12. Instructions for implementation agent
Implement actual running software, not a screenshot, PRD rewrite or UI-only mockup. Build in milestone order. Review open-source licenses. Do not use PM2/Docker. Do not claim external DNS, SSO, VPS deployment, security audit, or live preview completed without verifying. Use test data only in dev mode. Produce source ZIP and detailed install tutorial. When blocked by missing credentials/SSO details, isolate via adapter and document safe manual setup, rather than inventing values. Provide precise completion matrix per feature: implemented/tested/deferred.
