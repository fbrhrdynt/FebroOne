# Database schema

Authoritative DDL: packages/db/migrations/001_initial.sql. UUID primary keys, timestamptz timestamps, owner-bound references; migration tracking is created by scripts/migrate.ts.

| Table | Purpose and relationships |
|---|---|
| users | Normalized email, scrypt password hash, recovery hash, profile/preferences |
| sessions | Hashed session token, user FK, CSRF secret, expiration |
| records | User FK, kind/title/tags, validated JSONB data, optimistic version, archive timestamp |
| record_versions | Immutable snapshots related to record and owner |
| entity_links | Typed relation between two owner-scoped records |
| files | Owner, optional record, UUID disk key, MIME, bytes, original name |
| accounts | Owner, name, account type; balance derives from postings |
| debts | Owner, initial principal, APR/model/term/rate changes, borrowed/lent direction |
| ledger_transactions | Owner, kind, date/category/description, idempotency key/hash, reversal link |
| ledger_postings | Transaction, owner, optional account, signed bigint amount |
| debt_payments | Debt and ledger transaction, principal and interest minor units |
| audit_logs | Owner, action/entity metadata and timestamp |
| notifications | Owner, source key, read status, message |
| automation_runs | Owner/rule/run key uniqueness to prevent duplicate executions |

General module data is validated by packages/shared/catalog.ts and domain.ts. Tasks, calendar events, training, notes, work and documents link through entity_links. Uploaded certificates may reference their certificate record, which can link to training/evidence. Financial records have their own normalized tables; general links do not yet support every finance-to-record relationship requested by the PRD.

Indexes cover owner/kind/archive and searchable record text, sessions, ledger dates and notification lookup. Some app searches currently use ILIKE rather than the full-text index. Database and API constraints both enforce ownership. A deferred ledger trigger rejects unbalanced postings at transaction commit. Test fixtures verify migration repeatability, balanced transfers, rollback and cross-owner access.

The ledger is a personal balance ledger with a null-account balancing counter-entry, not a full professional chart-of-accounts/general-ledger system. Currency is IDR with two decimal minor places. Multi-currency, exchange rates and tax accounting are outside this delivery.

Schema changes must be new numbered migrations, never edit an already applied migration. Back up before migration. No down migration is shipped; rollback a changed schema by restoring a tested backup with matching application source.
