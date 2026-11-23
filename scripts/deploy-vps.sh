#!/usr/bin/env bash
set -Eeuo pipefail

APP_DIR="/opt/febro-one"
REPO_URL="https://github.com/fbrhrdynt/FebroOne.git"
BRANCH="main"
NODE_BIN="$APP_DIR/runtime/node/bin"
BACKUP_DIR="/var/backups/febro-one/deploy"
HEALTH_URL="http://127.0.0.1:3471/api/health"
PUBLIC_URL="https://one.febro.id"
SERVICE="febro-one.service"
WORK_DIR=""
SOURCE_BACKUP=""

log(){ printf '\n[%s] %s\n' "$(date -Is)" "$*"; }
die(){ echo "ERROR: $*" >&2; exit 1; }
cleanup(){ [[ -z "$WORK_DIR" ]] || rm -rf "$WORK_DIR"; }
restore_source(){
  local restore_dir
  restore_dir="$(mktemp -d /opt/febro-one-rollback.XXXXXX)"
  tar -xzf "$SOURCE_BACKUP" -C "$restore_dir"
  rsync -a --delete \
    --exclude='.git/' \
    --exclude='.env' \
    --exclude='runtime/' \
    --exclude='uploads/' \
    --exclude='logs/' \
    "$restore_dir/" "$APP_DIR/"
  rm -rf "$restore_dir"
}
trap cleanup EXIT

[[ $EUID -eq 0 ]] || die "Jalankan script dengan sudo."
[[ -d "$APP_DIR/.git" ]] || die "Git checkout tidak ditemukan di $APP_DIR."
[[ -f "$APP_DIR/.env" ]] || die ".env tidak ditemukan; deployment dibatalkan."
cd "$APP_DIR"
[[ "$(git remote get-url origin)" == "$REPO_URL" ]] || die "Origin repository VPS tidak cocok; deployment dibatalkan."
[[ "$(git branch --show-current)" == "$BRANCH" ]] || die "Branch lokal bukan $BRANCH; deployment dibatalkan."
[[ -z "$(git status --porcelain)" ]] || die "Working tree VPS memiliki perubahan lokal; commit/stash dengan prosedur terpisah sebelum deployment."
LOCAL_HEAD="$(git rev-parse HEAD)"
REMOTE_HEAD="$(git ls-remote "$REPO_URL" "refs/heads/$BRANCH" | awk '{print $1}')"
[[ -n "$REMOTE_HEAD" ]] || die "Tidak dapat membaca HEAD remote."
[[ "$(git merge-base "$LOCAL_HEAD" "$REMOTE_HEAD")" == "$LOCAL_HEAD" ]] || die "Branch VPS tidak ancestor dari remote; deployment dibatalkan untuk mencegah overwrite/force update."
[[ -x "$NODE_BIN/node" && -x "$NODE_BIN/npm" ]] || die "Runtime Node project tidak ditemukan."
command -v git >/dev/null || die "git tidak tersedia."
command -v rsync >/dev/null || die "rsync tidak tersedia."
command -v curl >/dev/null || die "curl tidak tersedia."
export PATH="$NODE_BIN:$PATH"
node -e 'if(Number(process.versions.node.split(".")[0])!==24)process.exit(1)' || die "Febro One membutuhkan Node.js 24."
id febro-one >/dev/null 2>&1 || die "User service febro-one tidak ditemukan."
systemctl cat "$SERVICE" >/dev/null 2>&1 || die "Unit $SERVICE tidak ditemukan."

install -d -m 700 "$BACKUP_DIR"
STAMP="$(date +%Y%m%d-%H%M%S)"
SOURCE_BACKUP="$BACKUP_DIR/source-$STAMP.tar.gz"

log "Membuat snapshot source sebelum deployment."
tar -czf "$SOURCE_BACKUP" \
  --exclude='./.git' \
  --exclude='./.env' \
  --exclude='./runtime' \
  --exclude='./uploads' \
  --exclude='./logs' \
  -C "$APP_DIR" . || die "Snapshot source gagal."

log "Membuat encrypted backup database, lampiran, environment, dan lockfile."
bash "$APP_DIR/scripts/backup.sh" || die "Backup terenkripsi gagal; production tidak diubah."

WORK_DIR="$(mktemp -d /opt/febro-one-release.XXXXXX)"
log "Mengambil branch $BRANCH dari GitHub."
git clone --depth 1 --branch "$BRANCH" "$REPO_URL" "$WORK_DIR/source" || die "Clone source gagal."

cd "$WORK_DIR/source"
log "Menyelaraskan npm lockfile dengan dependency WebAuthn."
npm install --package-lock-only --ignore-scripts --no-audit --no-fund || die "Resolusi dependency/lockfile gagal."
npm ci --no-audit --no-fund || die "Instalasi dependency gagal."

log "Menjalankan automated tests."
npm test || die "Test gagal; production tidak diubah."

log "Membangun frontend dan backend."
npm run build || die "Build gagal; production tidak diubah."

log "Memasang release sambil mempertahankan .env, runtime, dan upload production."
rsync -a --delete \
  --exclude='.git/' \
  --exclude='.env' \
  --exclude='runtime/' \
  --exclude='uploads/' \
  --exclude='logs/' \
  "$WORK_DIR/source/" "$APP_DIR/" || die "Copy release gagal."

chown root:febro-one "$APP_DIR/.env"
chmod 640 "$APP_DIR/.env"

log "Menjalankan migrasi additive."
if ! bash "$APP_DIR/scripts/migrate.sh"; then
  log "Migrasi gagal. Mengembalikan source sebelum deployment."
  restore_source
  systemctl restart "$SERVICE" || true
  die "Migrasi gagal; source dipulihkan. Database tidak dihapus."
fi

log "Restart hanya service Febro One."
systemctl restart "$SERVICE" || {
  restore_source
  systemctl restart "$SERVICE" || true
  die "Restart gagal; source dipulihkan."
}

HEALTH_OK=0
for attempt in $(seq 1 30); do
  if curl --fail --silent --show-error "$HEALTH_URL" >/dev/null 2>&1; then
    HEALTH_OK=1
    break
  fi
  sleep 2
done

if [[ "$HEALTH_OK" -ne 1 ]]; then
  log "Health check gagal. Memulihkan source release sebelumnya."
  journalctl -u "$SERVICE" -n 80 --no-pager >&2 || true
  restore_source
  systemctl restart "$SERVICE" || true
  die "Production belum sehat. Source lama dipulihkan. Backup: $SOURCE_BACKUP"
fi

log "Memverifikasi endpoint publik HTTPS."
HTTP_CODE="$(curl -L -sS -o /dev/null -w '%{http_code}' "$PUBLIC_URL" || true)"
[[ "$HTTP_CODE" == "200" ]] || log "Peringatan: public HTTP status $HTTP_CODE; API lokal sudah sehat."

log "Deployment Febro One selesai. API health check OK."
printf 'Source backup: %s\n' "$SOURCE_BACKUP"
printf 'Local health: %s\n' "$HEALTH_URL"
printf 'Public URL: %s\n' "$PUBLIC_URL"
