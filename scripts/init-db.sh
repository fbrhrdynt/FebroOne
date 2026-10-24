#!/usr/bin/env bash
set -euo pipefail
[[ $EUID -eq 0 ]] || { echo 'Run with sudo'; exit 1; }
[[ -d /opt/febro-one ]] || exit 1
[[ ! -e /opt/febro-one/.env ]] || { echo 'Existing .env found. No database changes made.'; exit 1; }
if sudo -u postgres psql -tAc "SELECT 1 FROM pg_roles WHERE rolname='febro_one'" | tr -d '[:space:]' | grep -q 1; then
  echo 'Database role already exists. No changes made. Configure DATABASE_URL manually.'; exit 1
fi
if sudo -u postgres psql -tAc "SELECT 1 FROM pg_database WHERE datname='febro_one'" | tr -d '[:space:]' | grep -q 1; then
  echo 'Database already exists. No changes made.'; exit 1
fi
# Hex password cannot contain SQL/shell syntax; it is never printed.
password="$(openssl rand -hex 32)"
printf "CREATE ROLE febro_one LOGIN PASSWORD '%s';\n" "$password" | sudo -u postgres psql -v ON_ERROR_STOP=1
sudo -u postgres createdb --owner=febro_one febro_one
sudo -u postgres psql -d febro_one -v ON_ERROR_STOP=1 -c 'REVOKE CREATE ON SCHEMA public FROM PUBLIC; GRANT ALL ON SCHEMA public TO febro_one;'
if [[ -e /opt/febro-one/.env ]]; then echo 'Existing .env retained. Use psql to set a new database password and update DATABASE_URL.'; exit 1; fi
umask 077
sed "s/CHANGE_ME/$password/" /opt/febro-one/.env.example > /opt/febro-one/.env
chown root:febro-one /opt/febro-one/.env
chmod 640 /opt/febro-one/.env
unset password
echo 'Dedicated database created and .env configured. Credentials were not printed.'
