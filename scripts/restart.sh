#!/usr/bin/env bash
set -euo pipefail

PORT="${PORT:-8080}"
LOG_FILE="${LOG_FILE:-/tmp/new-project-8080.log}"
PID_FILE="${PID_FILE:-/tmp/new-project-8080.pid}"

PIDS="$(lsof -tiTCP:${PORT} -sTCP:LISTEN || true)"
if [ -n "${PIDS}" ]; then
  # shellcheck disable=SC2086
  kill ${PIDS}
  sleep 1
fi

nohup npm start > "${LOG_FILE}" 2>&1 &
echo $! > "${PID_FILE}"
sleep 1

if ! curl -sS "http://localhost:${PORT}/api/health"; then
  echo "server failed to start; recent logs:" >&2
  tail -n 40 "${LOG_FILE}" >&2 || true
  exit 1
fi
