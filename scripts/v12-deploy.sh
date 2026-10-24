#!/usr/bin/env bash
set -euo pipefail
cd /opt/febro-one
runtime/node/bin/node --input-type=module <<'JS'
import fs from 'node:fs';import assert from 'node:assert/strict';import {createHash} from 'node:crypto';
const r=JSON.parse(fs.readFileSync('docs/v12/browser-results.json'));
assert.equal(r.visited,260);assert.deepEqual(r.overflow,[]);assert.deepEqual(r.errors,[]);
for(const key of ['checklistCRUD','routeForms','relationships','trashRestore','accordions','failureRecovery','duplicatePrevention','financeRoutesAndDraft','darkThemePersistence'])assert.equal(r[key],'passed');
assert.equal(r.artifactHash,createHash('sha256').update(fs.readFileSync('.v12-stage/dist/index.html')).digest('hex'));
assert.match(fs.readFileSync('docs/v12/tests.log','utf8'),/fail 0/);assert.match(fs.readFileSync('docs/v12/postgres.log','utf8'),/pass 1/);assert.equal(fs.readFileSync('docs/v12/typecheck.log','utf8').trim(),'');
assert.match(fs.readFileSync('docs/v12/build.log','utf8'),/built in/);
JS
sha256sum --quiet -c docs/v12/source.sha256
fingerprint(){
 sudo -n -u postgres psql -d febro_one -Atq -c "SELECT md5(COALESCE(string_agg(row_to_json(r)::text,'' ORDER BY id),'')) FROM (SELECT id,owner_id,kind,title,tags,data,version,archived_at FROM records) r; SELECT md5(COALESCE(string_agg(row_to_json(s)::text,'' ORDER BY id),'')) FROM push_subscriptions s; SELECT md5(COALESCE(string_agg(row_to_json(p)::text,''),'')) FROM push_config p;"
}
sudo -n -u postgres pg_dump -Fc febro_one | sudo -n tee backups/v12/pre-deploy.dump >/dev/null
sudo -n chmod 600 backups/v12/pre-deploy.dump
fingerprint > docs/v12/database-before.fingerprint
sudo -n -u febro-one runtime/node/bin/node --env-file=.env --import tsx scripts/migrate.ts
fingerprint > docs/v12/database-after.fingerprint
cmp docs/v12/database-before.fingerprint docs/v12/database-after.fingerprint
printf '%s\n' 'PASS: migration preserved existing records, push subscriptions and VAPID configuration fingerprints'
published=0
rollback(){
 code=$?;trap - ERR
 if [[ "$published" == 1 ]];then
  sudo -n tar -xzf backups/v12/application.tar.gz -C /opt/febro-one dist build
  sudo -n systemctl restart febro-one.service
  echo 'Verification failed; restored previous production assets and server. Additive migration retained.'
 fi
 exit "$code"
}
trap rollback ERR
# Retain old hashed assets for existing open tabs.
sudo -n cp -a .v12-stage/dist/assets/. dist/assets/
for file in .v12-stage/dist/*;do
 [[ -f "$file" ]] || continue
 name="${file##*/}"
 [[ "$name" != index.html && "$name" != sw.js ]] || continue
 sudo -n install -m 644 "$file" "dist/$name"
done
published=1
sudo -n install -m 644 .v12-stage/build/server.js build/server.js
sudo -n install -m 644 .v12-stage/dist/index.html dist/index.v12.next
sudo -n mv dist/index.v12.next dist/index.html
sudo -n install -m 644 .v12-stage/dist/sw.js dist/sw.js
sudo -n systemctl restart febro-one.service
curl --retry 12 --retry-delay 1 --retry-connrefused --retry-all-errors -fsS http://127.0.0.1:3471/api/health
curl --retry 8 --retry-delay 1 --retry-all-errors -fsS https://one.febro.id/api/health
curl -fsS https://one.febro.id/ | cmp - .v12-stage/dist/index.html
curl -fsS https://one.febro.id/sw.js | cmp - .v12-stage/dist/sw.js
[[ "$(curl -sS -o /dev/null -w '%{http_code}' https://one.febro.id/api/records)" == 401 ]]
sudo -n -u febro-one runtime/node/bin/node --env-file=.env --import tsx scripts/v12-production-smoke.mts
sudo -n systemctl is-active febro-one.service
date --iso-8601=seconds
trap - ERR
echo 'V1.2 deployment and HTTPS authenticated smoke checks passed.'
