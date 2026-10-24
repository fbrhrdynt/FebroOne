#!/usr/bin/env bash
set -euo pipefail
cd /opt/febro-one
export PATH="/opt/febro-one/runtime/node/bin:$PATH"
unset VITE_TRIAL
npm ci
npm test
npm run build
