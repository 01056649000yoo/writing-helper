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

export BUILD_VERSION
BUILD_VERSION="$(git rev-parse --short HEAD)"

echo "[$(date '+%Y-%m-%d %H:%M:%S')] stopping old local process managers"
launchctl bootout "gui/$(id -u)/com.jarvis.helper" >/dev/null 2>&1 || true
launchctl disable "gui/$(id -u)/com.jarvis.helper" >/dev/null 2>&1 || true
if [ -x "$PROJECT_ROOT/node_modules/.bin/pm2" ]; then
  "$PROJECT_ROOT/node_modules/.bin/pm2" delete writing-helper >/dev/null 2>&1 || true
  "$PROJECT_ROOT/node_modules/.bin/pm2" save --force >/dev/null 2>&1 || true
  "$PROJECT_ROOT/node_modules/.bin/pm2" kill >/dev/null 2>&1 || true
fi
pkill -f "npm run start" >/dev/null 2>&1 || true
pkill -f "next-server \\(v16\\.2\\.3\\)" >/dev/null 2>&1 || true

echo "[$(date '+%Y-%m-%d %H:%M:%S')] building docker image"
docker compose build

echo "[$(date '+%Y-%m-%d %H:%M:%S')] starting docker stack"
docker compose up -d --remove-orphans

echo "[$(date '+%Y-%m-%d %H:%M:%S')] webhook deploy finished"
