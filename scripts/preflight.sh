#!/usr/bin/env bash
set -euo pipefail
printf '=== Febro One read-only preflight ===\n'
uname -m
node --version || true
nginx -t
ss -ltnp '( sport = :3471 )'
if ss -ltnH '( sport = :3471 )' | read -r _; then echo 'Port 3471 occupied. Stop installation and choose another port in .env and this host Nginx file.'; exit 1; fi
if [[ -e /etc/nginx/conf.d/one.febro.id.conf || -e /etc/systemd/system/febro-one.service ]]; then echo 'Existing Febro One config found. Use update procedure; do not overwrite.'; exit 1; fi
nginx -T 2>/dev/null | grep -E 'server_name.*one\.febro\.id' && { echo 'Domain already configured'; exit 1; } || true
systemctl status postgresql --no-pager || true
dig +short one.febro.id
