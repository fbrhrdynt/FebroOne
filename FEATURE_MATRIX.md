# Feature completion matrix

Status: **partial implementation of the full PRD**. Every listed module has working stored data pathways, but that does not mean every requested advanced feature is complete. This matrix supersedes any blanket completion implication in the version filename. Trial data persists locally; the VPS build uses authenticated API/PostgreSQL. Neither is bank-connected.

| Module | Implemented behavior | Missing or limited |
|---|---|---|
| A Home | Actual agenda/tasks/overdue/notes/finance/work/training/recent summaries, Quick Add, global record search, notification inbox, widget preferences | Inbox is notifications, not full ingestion; no drag/reorder widgets; global search not all file contents |
| B Calendar | Day/week/month/year/agenda, event CRUD, calendar/category/color fields, notes/files, daily/weekly/monthly/yearly recurrence, exclusions, reminders, time blocks, simple ICS import/export, drag move nonrecurring events | Advanced RRULE BYDAY/COUNT/INTERVAL imports rejected; series occurrence editing limited; no live external calendar provider; timezone preference not consistently applied; monthly clamp can drift after short months |
| C Tasks | CRUD/category/priority/due/recurrence, parent/dependency/checklist metadata, Kanban/list, completion/version history, archive/undo, attachments, focus timer/time records, summary reports | No dedicated task calendar view, nested checklist interaction or dependency graph/cycle detection; dependency fields use record IDs; reports are basic |
| D Notes | TipTap rich text JSON, raw Markdown mode, folders as path metadata, tags/pins/favorites, journal/meeting/technical types, templates records, draft recovery, attachments, links/backlinks, versions, text search, Markdown export | No visual folder tree; Markdown and rich text are alternate modes rather than lossless conversion; no full-text attachment search; dedicated note PDF export absent |
| E Finance | Accounts/openings, income/expense/transfer, exact balances, reconciliation, reversal, categories, budgets/bills/savings/assets records, cash-flow/net-worth summaries, search/month filters, atomic CSV/XLSX import/export | Account/debt metadata edit/delete UI absent; no bank sync; bills/recurring transactions are records/reminders, not automatic bookings; emergency fund only savings metadata; finance list shows first100; receipt-to-ledger linking incomplete; no multicurrency |
| F Debt | Borrowed/lent registry, reducing/flat interest, variable APR schedule, principal balance, partial/extra payments/history, schedule simulation, ledger integration, due notices, priority sorting | Snowball/avalanche currently sorts debts only, not a combined optimized payoff simulation; no contractual-rate audit/fees/day-count conventions; schedule is an estimate |
| G Life | Activities/journal, habits/check-ins/streaks, goals/milestones, important dates/family events, travel/packing metadata, inventory, wellness and reviews | No rich packing checklist interaction or advanced goal visualizations; wellness is a personal journal, not medical guidance |
| H Career | Work/employment/company/position/assignment/project/timesheet/achievement records, responsibilities/skills/lessons fields, career timeline and exportable Markdown summaries | Basic analytics only; no confidential-company integrations, no AMT duplication |
| I Learning | Training/providers/categories/dates/hours, skill/competency level/assessment/evidence fields, certificate uploads/expiry/reminders, roadmap/history, learning summaries | Competency records do not provide a fully interactive matrix grid; evidence mapping uses generic links |
| J Documents | Secure upload/download/preview, folder/tag/category metadata, search metadata, expiry reminders, usage, authenticated file API | PDF/PNG/JPEG/WebP only, 10MB/file and100MB/user; no office preview/OCR/malware scanner; backup via server scripts; JSON export excludes file bytes; no folder tree |
| K Engineering | 7 calculators (cylinder, box, flow, Ohm, three-phase power, torque, hydrostatic pressure), pressure/density/volume/flow/electrical unit conversions, formula/steps/assumptions, history/save, browser-print PDF | Does not cover every possible engineering formula; idealized assumptions; not a certified engineering design tool |
| L AI/Automation | Provider configuration through environment, explicit setup state, prompt drafting/summarization, deterministic briefings/reviews/task suggestions, due notifications, scheduled create-task/notify rules | No autonomous agent, semantic RAG or automatic corpus summarization; no push/email/SMS; scheduler only VPS; AI disabled in hosted local trial |
| M Integrations | Configurable app launcher, labels/URLs for user apps, future integration entry point | No external application APIs or verified SSO. Inspected FebroEcosystem source returned empty/unavailable, so no authentication endpoints were invented |

## Cross-cutting acceptance

| Requirement | Actual status |
|---|---|
| React/TS/Vite/Tailwind/Radix shadcn-style/Lucide/Query/Router | Implemented; reusable components authored locally |
| Fastify/Zod/PostgreSQL/Drizzle/versioned migrations | Implemented; native PostgreSQL adapter still needs target-VPS acceptance |
| All domain tables fully normalized | Not met: common records store validated JSONB |
| Light/dark/mobile navigation, empty/error/loading states | Implemented; browser smoke checks, not exhaustive accessibility audit |
| Full offline sync across every module | Not met: local trial + limited real-mode note queue/conflict UI |
| Auth/ownership/CSRF/rate limits/private uploads | Implemented and API tested; no independent penetration test |
| MFA | Not implemented; extension point only |
| Account recovery | One-use offline recovery code, no email delivery |
| Performance >=90/LCP/INP/CLS targets | Not measured; no passing claim |
| Virtualized lists and large-data optimization | Not implemented |
| Ubuntu24/systemd/Nginx/Certbot deployment | Files and instructions provided, not executed on your VPS |
| Backup restore | Scripts supplied; actual restore rehearsal required |

Do not import your only copy of irreplaceable data until target-server installation, restore and security acceptance are complete. Test data created during QA is not shipped or seeded into the app.
