#!/usr/bin/env bash
#
# launch.sh — one-command app launcher.
# Usage: ./scripts/launch.sh [dev|start]   (default: dev)
# Env:   PORT=4000 ./scripts/launch.sh dev (default port: 3000)
# Frees the port if stale, starts the server, opens the browser.
# Wired to `pnpm dev:open` and `pnpm start:open` in package.json.
#
set -euo pipefail

MODE="${1:-dev}"
PORT="${PORT:-3000}"
URL="http://localhost:${PORT}"

if lsof -ti:"${PORT}" >/dev/null 2>&1; then
  echo "Port ${PORT} in use — killing stale process."
  lsof -ti:"${PORT}" | xargs kill -9 || true
fi

(sleep 3 && open "${URL}") &

case "${MODE}" in
  dev)
    exec pnpm next dev -p "${PORT}"
    ;;
  start)
    pnpm next build
    exec pnpm next start -p "${PORT}"
    ;;
  *)
    echo "Unknown mode: ${MODE} (expected dev|start)" >&2
    exit 1
    ;;
esac
