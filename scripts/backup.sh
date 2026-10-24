#!/usr/bin/env bash
set -euo pipefail
[[ $EUID -eq 0 ]] || { echo 'Run with sudo'; exit 1; }
cd /opt/febro-one
# .env is an operator-controlled file. Never execute an uploaded untrusted .env.
set -a
source .env
set +a
: "${BACKUP_AGE_RECIPIENT:?Set BACKUP_AGE_RECIPIENT in .env first}"
command -v age >/dev/null
command -v pg_dump >/dev/null
umask 077
mkdir -p /var/backups/febro-one
work="$(mktemp -d)"
was_active=0
systemctl is-active --quiet febro-one && was_active=1
cleanup(){ rm -rf "$work"; if [[ "$was_active" == 1 ]]; then systemctl start febro-one; fi; }
trap cleanup EXIT
# Pause only this application so files and database share a consistent checkpoint.
if [[ "$was_active" == 1 ]]; then systemctl stop febro-one; fi
DATABASE_URL="$DATABASE_URL" /opt/febro-one/runtime/node/bin/node --input-type=module <<'JS' > "$work/pg.env"
const u=new URL(process.env.DATABASE_URL);
for(const [k,v] of Object.entries({PGHOST:u.hostname,PGPORT:u.port||'5432',PGDATABASE:u.pathname.slice(1),PGUSER:decodeURIComponent(u.username),PGPASSWORD:decodeURIComponent(u.password)}))console.log(k+'='+"'"+v.replaceAll("'","'\\''")+"'");
JS
set -a
source "$work/pg.env"
set +a
pg_dump --format=custom --file="$work/database.dump"
mkdir "$work/uploads"
cp -a /var/lib/febro-one/uploads/. "$work/uploads/"
cp .env "$work/environment.env"
cp package-lock.json "$work/package-lock.json"
rm "$work/pg.env"
out="/var/backups/febro-one/febro-one-$(date -u +%Y%m%dT%H%M%SZ).tar.age"
tar -C "$work" -cf - database.dump uploads environment.env package-lock.json | age -r "$BACKUP_AGE_RECIPIENT" -o "$out"
sha256sum "$out" > "$out.sha256"
echo "Encrypted backup: $out"
