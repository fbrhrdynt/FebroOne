#!/usr/bin/env bash
set -euo pipefail
cd /opt/febro-one
exec runtime/node/bin/node --env-file=.env build/server.js
