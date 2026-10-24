# Security

## Implemented controls

Production requires first-run CLI admin setup; no public registration or built-in password. Passwords use salted scrypt. Session tokens are random and stored hashed, with expiry; production cookies HttpOnly/Secure/SameSite=Strict. Mutations require same origin and a session CSRF token. Login/recovery are rate limited. A one-use recovery secret is generated at setup; keep it offline. Recovery invalidates old sessions. There is no MFA implementation yet.

Owner authorization applies at API and composite foreign-key boundaries. Zod validates request data. Financial operations are transactional, idempotent and protected by balance/ownership constraints. Generic changes are version checked. Audit records cover important events but are not an independently tamper-proof audit service.

Uploads check size, magic MIME and owner quota. PDF/PNG/JPEG/WebP only. UUID filenames and private storage prevent traversal/public static access. Downloads require a session; previews use authenticated fetched Blobs. Files are not encrypted at rest by the app and are not virus scanned. Use encrypted VPS volumes if required. Root/server administrators can access stored data. No documents or financial data should be placed in dist/.

Nginx fronts localhost-only Fastify. The dedicated systemd service limits writable paths and privileges. Secrets remain in a root-owned group-readable .env; never send it to Git or support logs. AI only sends the prompt explicitly provided after consent to the configured provider. Provider data handling remains your configuration responsibility. SSO is disabled pending verified compatibility.

## Trial boundaries

Owner-private hosted trial access is separate from production authentication. Trial records, files and finance stay in browser IndexedDB and are accessible to that browser profile. No backend sync/remote backup. Browser storage is not a private encrypted vault. Use disposable trial data, and export before clearing site data. Real mode also caches data in IndexedDB; logout clears its database. Device compromise and malicious browser extensions are outside these controls.

## Dependencies

Lockfile pins resolved versions. Dependency license declarations are in docs/DEPENDENCY_LICENSES.md. ExcelJS UUID is overridden to11.1.1 to address the older transitive bounds-check advisory, with workbook import tests. See the timestamped audit output and TEST_RESULTS.md; a clean npm audit is not a security guarantee. Excel input size/row limits do not fully protect against a specially crafted compressed workbook; import only files you trust. Native parser resource isolation is not implemented.

## Backup/recovery

scripts/backup.sh stops only febro-one during a consistent DB/files snapshot, encrypts the archive with age, and restarts a previously active service. Keep the age private identity off the VPS and keep encrypted copies offsite. Restore explicitly replaces the dedicated database and uploads; it requires a typed confirmation. Rehearse restore before relying on backups. The source ZIP and current schema version are needed alongside the backup.

## Before daily production use

Verify HTTPS/cookie settings, role access, second-user API isolation, upload privacy, recovery, actual backup restore and mobile workflows on the target VPS. No external penetration test, full accessibility audit, native Ubuntu acceptance or formal compliance assessment has been performed. Financial schedules use simplified personal-planning conventions; check them against actual lender statements.
