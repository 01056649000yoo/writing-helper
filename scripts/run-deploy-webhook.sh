#!/bin/zsh
set -euo pipefail

export PATH="/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin"

cd /Users/seunghyeonmaegmini/writing-helper
exec node scripts/deploy-webhook-server.mjs
