# Febro One deployment report

Verified on 2026-10-23 (Asia/Jakarta).

## Running deployment

- URL: https://one.febro.id — homepage HTTP 200; HTTP redirects to HTTPS (301).
- API: https://one.febro.id/api/health returns `{"status":"ok","app":"Febro One"}` and checks PostgreSQL connectivity.
- Service: `febro-one.service`, enabled at boot and active under dedicated `febro-one` user. No PM2 or Docker used for this app.
- API listener: `127.0.0.1:3471`; not publicly bound.
- Isolated runtime: `/opt/febro-one/runtime/node/bin/node`, v24.19.0; official archive SHA256 verified. npm 11.17.0. Global Node settings unchanged.
- Dependencies: `npm ci` completed, audit reported zero vulnerabilities at installation.
- Build: TypeScript, Vite, and esbuild completed successfully; output in `dist/` and `build/server.js`. Build output retained in `production-build.log`.
- Database: dedicated PostgreSQL role/database `febro_one`; migration `001_initial.sql` applied. Fifteen public schema tables including migration tracking. Repeat migration succeeded without checksum errors.
- Persistent uploads: `/var/lib/febro-one/uploads`, owned by service user with private directory permissions.
- Environment: `/opt/febro-one/.env`, root:febro-one, mode 0640; no secrets included in this report.
- Service unit: `/etc/systemd/system/febro-one.service`; systemd hardening enabled and application directory owned by root.
- Nginx host: `/etc/nginx/conf.d/one.febro.id.conf`; static production assets and API proxy to port 3471. Configuration test passed; applied via graceful reload.
- TLS: Certbot issued and installed a certificate for `one.febro.id`, valid until 2027-01-21 04:48:54 UTC. Existing enabled/active `certbot.timer` handles renewal.

## Verification

- All 28 automated tests passed, including authentication, CSRF, migrations, owner isolation, finance, uploads, and automation (integration suite uses PGlite).
- Production service restart succeeded; public health recovered after the brief expected startup interval. Migration remained recorded. No crash restarts observed.
- Chromium loaded the actual public HTTPS login page: title Febro One, email/password inputs present, no JavaScript exceptions. Expected unauthenticated `/api/auth/me` response: 401; API health succeeded.
- Desktop and mobile screenshots captured at `/tmp/febro-one-desktop.png` and `/tmp/febro-one-mobile.png`; mobile viewport 390x844 had no horizontal overflow. Mobile login rendering visually inspected.
- `/.env` request denied with HTTP 403.
- DNS A resolved to 161.248.116.14; no AAAA response observed.
- Certificate renewal dry run: `certbot renew --cert-name one.febro.id --dry-run` exited 0; simulated renewal succeeded. Only this certificate was tested.

## Isolation and preserved state

- Existing port 3470 process retained PID 65746 throughout deployment; listener remained active. No action taken against its service.
- SHA256 comparison confirmed every pre-existing Nginx host configuration and `/etc/nginx/nginx.conf` remained unchanged, including after Certbot.
- Baseline hashes retained at `/var/backups/febro-one/deployment-20261023/nginx-before.sha256`.
- Existing PostgreSQL and Nginx were reused; no package installation or PostgreSQL restart required. SSH, firewall, global Node, existing databases and unrelated app files were not changed.

## Fixes and limitations

- Resolved stale port 3470 references in deployment preflight and installation guide to 3471. Existing .bak reference files retained untouched.
- Replaced script dependency on `rg` with system `grep` because sudo PATH did not provide ripgrep. Initial role/database absence was independently verified before creation.
- Interrupted production build was rerun successfully; existing database/environment were retained.
- Vite reported large frontend chunks and third-party annotation warnings; build succeeded. No dependency upgrades were performed.
- First admin has not been created: database contains zero users. Awaiting owner email/display name; no invented account or default password was installed. Use `npm run admin` with the isolated runtime and the documented protected environment flow in INSTALL_UBUNTU.md, or provide identity details for secure provisioning.
- Authenticated production CRUD, real-device acceptance, performance targets and backup/restore rehearsal have not been verified. Automated integration tests are distinct from these production checks.
- systemd verifier emitted a pre-existing warning from unrelated `febro-pocketbase.service`; that unit was left untouched.
