# Febro One Bento V2 progress

- Source, routes, API, PWA, systemd and PostgreSQL integration inspected.
- Previous application source/build backed up at `backups/bento-v2-initial/application.tar.gz`; `.env` excluded and untouched.
- Baseline: 35 tests passed, one opt-in PostgreSQL test skipped.
- Active work: shared Bento shell/components; task and calendar interfaces; real-data dashboard and finance/report refinements.
- Checklist reopening rule corrected; priority query validated server-side; mismatched company/project links rejected.
- Active-session management added with owner-scoped queries and CSRF-protected revoke-other-sessions action.
- Deployment pending production build, tests, and browser verification. No service restart yet.
