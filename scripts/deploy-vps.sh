#!/usr/bin/env bash
set -Eeuo pipefail
APP_DIR="/opt/febro-one"
REPO="https://github.com/fbrhrdynt/FebroOne.git"
BRANCH="feat/dashboard-bilingual-passkeys"
NODE_BIN="$APP_DIR/runtime/node/bin"
BACKUP_DIR="/var/backups/febro-one/deploy"
[[ $EUID -eq 0 ]] || { echo "Jalankan dengan sudo." >&2; exit 1; }
[[ -d "$APP_DIR/.git" && -f "$APP_DIR/.env" && -x "$NODE_BIN/node" ]] || { echo "Checkout/.env/Node runtime project tidak ditemukan." >&2; exit 1; }
export PATH="$NODE_BIN:$PATH"
node -e 'if(Number(process.versions.node.split(".")[0])!==24)process.exit(1)' || { echo "Project membutuhkan Node 24." >&2; exit 1; }
install -d -m 700 "$BACKUP_DIR"
STAMP="$(date +%Y%m%d-%H%M%S)"
tar --exclude=node_modules --exclude=runtime --exclude=.git -czf "$BACKUP_DIR/source-$STAMP.tar.gz" -C "$APP_DIR" . || exit 1
bash "$APP_DIR/scripts/backup.sh" || { echo "Backup aplikasi gagal; deployment dibatalkan." >&2; exit 1; }
WORK="$(mktemp -d /opt/febro-one-release.XXXXXX)"
trap 'rm -rf "$WORK"' EXIT
git clone --depth 1 --branch "$BRANCH" "$REPO" "$WORK/source"
cd "$WORK/source"
npm ci
npm test
npm run build
rsync -a --delete --exclude='.env' --exclude='runtime/' --exclude='node_modules/' --exclude='uploads/' "$WORK/source/" "$APP_DIR/"
chown -R root:root "$APP_DIR"
chown root:febro-one "$APP_DIR/.env"
chmod 640 "$APP_DIR/.env"
sudo -u febro-one env PATH="$NODE_BIN:$PATH" bash "$APP_DIR/scripts/migrate.sh"
systemctl restart febro-one
for attempt in {1..30}; do
  curl --fail --silent http://127.0.0.1:3471/api/health >/dev/null && { echo "Febro One sehat."; exit 0; }
  sleep 2
done
journalctl -u febro-one -n 80 --no-pager >&2 || true
echo "Health check gagal. Backup tersedia di $BACKUP_DIR." >&2
exit 1
