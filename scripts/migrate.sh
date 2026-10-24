#!/usr/bin/env bash
set -euo pipefail
cd /opt/febro-one
export PATH="/opt/febro-one/runtime/node/bin:$PATH"
exec npm run migrate
