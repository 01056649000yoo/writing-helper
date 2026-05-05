#!/bin/bash

set -euo pipefail

PROJECT_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
LOG_DIR="$PROJECT_ROOT/logs"
LOG_FILE="$LOG_DIR/deploy-webhook.log"
LOCK_DIR="/tmp/writing-helper-deploy.lock"

mkdir -p "$LOG_DIR"

exec >>"$LOG_FILE" 2>&1

echo "[$(date '+%Y-%m-%d %H:%M:%S')] webhook deploy started"

if ! mkdir "$LOCK_DIR" 2>/dev/null; then
  echo "[$(date '+%Y-%m-%d %H:%M:%S')] another deploy is already running"
  exit 0
fi

cleanup() {
  rmdir "$LOCK_DIR"
}

trap cleanup EXIT

cd "$PROJECT_ROOT"

echo "[$(date '+%Y-%m-%d %H:%M:%S')] pulling latest main"
git checkout main
git pull --ff-only origin main

echo "[$(date '+%Y-%m-%d %H:%M:%S')] installing dependencies"
npm install --include=dev

echo "[$(date '+%Y-%m-%d %H:%M:%S')] building app"
npm run build

echo "[$(date '+%Y-%m-%d %H:%M:%S')] restarting pm2 app"
npx pm2 restart writing-helper --update-env

echo "[$(date '+%Y-%m-%d %H:%M:%S')] webhook deploy finished"
