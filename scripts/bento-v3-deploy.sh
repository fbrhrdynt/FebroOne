#!/usr/bin/env bash
set -euo pipefail
cd /opt/febro-one
[[ -s .bento-v3-stage/dist/index.html && -s .bento-v3-stage/build/server.js ]]
[[ -s docs/bento-v3/browser-results.json ]]
runtime/node/bin/node --input-type=module -e 'import fs from "node:fs";import {createHash} from "node:crypto";const r=JSON.parse(fs.readFileSync("docs/bento-v3/browser-results.json"));if(r.visited!==252||r.overflow.length||r.errors.length||!(["quickAdd","themePersistence","checklistTransitions","focusTimesheet","privacyPreference","sidebarPersistence","logout","calendarViews","emptyDashboard","keyboardDialogs"].every(key=>r[key]==="passed"))||r.artifactHash!==createHash("sha256").update(fs.readFileSync(".bento-v3-stage/dist/index.html")).digest("hex"))process.exit(1);'
published=0
rollback(){
  code=$?
  trap - ERR
  if [[ "$published" == 1 ]]; then
    echo 'Verification failed; restoring prior frontend/backend artifacts.'
    sudo -n tar -xzf backups/bento-v3/application.tar.gz -C /opt/febro-one dist build
    sudo -n systemctl restart febro-one.service
  fi
  exit "$code"
}
trap rollback ERR
# Preserve previous hashed assets for open tabs and rollback.
sudo -n cp -a .bento-v3-stage/dist/assets/. dist/assets/
for file in .bento-v3-stage/dist/*; do
  [[ -f "$file" ]] || continue
  name="${file##*/}"
  [[ "$name" != index.html && "$name" != sw.js ]] || continue
  sudo -n install -m 644 "$file" "dist/$name"
done
published=1
sudo -n install -m 644 .bento-v3-stage/build/server.js build/server.js
sudo -n install -m 644 .bento-v3-stage/dist/index.html dist/index.v3.next
sudo -n mv dist/index.v3.next dist/index.html
sudo -n install -m 644 .bento-v3-stage/dist/sw.js dist/sw.js
sudo -n systemctl restart febro-one.service
curl --retry 12 --retry-delay 1 --retry-connrefused --retry-all-errors -fsS http://127.0.0.1:3471/api/health
curl --retry 8 --retry-delay 1 --retry-all-errors -fsS https://one.febro.id/api/health
curl -fsS https://one.febro.id/ | cmp - .bento-v3-stage/dist/index.html
curl -fsS https://one.febro.id/sw.js | cmp - .bento-v3-stage/dist/sw.js
[[ "$(curl -sS -o /dev/null -w '%{http_code}' https://one.febro.id/api/records)" == 401 ]]
sudo -n -u febro-one runtime/node/bin/node --env-file=.env --import tsx scripts/bento-production-smoke.mts
sudo -n systemctl is-active febro-one.service
date --iso-8601=seconds
trap - ERR
echo 'Bento v3 deployment and HTTPS checks passed.'
