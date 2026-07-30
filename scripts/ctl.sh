#!/usr/bin/env bash
#
# ctl.sh - background launcher for Balanced Work Life.
# Usage: ./scripts/ctl.sh start|stop|restart|open|status|logs|install|uninstall [dev|prod] [--watch]
# Env:   BALANCE_PORT=4327 ./scripts/ctl.sh open
#        BALANCE_INSTALL_DIR=/usr/local/bin ./scripts/ctl.sh install
# Flags: --watch  keep terminal open and stream logs (alias: --fg)
#
set -euo pipefail

# Source nvm so pnpm is on PATH in non-interactive shells
export NVM_DIR="${NVM_DIR:-${HOME}/.nvm}"
[ -s "${NVM_DIR}/nvm.sh" ] && source "${NVM_DIR}/nvm.sh"

# Check pnpm is available — give actionable help if not
require_pnpm() {
  if ! command -v pnpm >/dev/null 2>&1; then
    echo "Error: pnpm is not installed or not on PATH." >&2
    echo "" >&2
    echo "Install it with one of:" >&2
    echo "  npm install -g pnpm          (if you have Node/npm)" >&2
    echo "  brew install pnpm            (macOS with Homebrew)" >&2
    echo "  curl -fsSL https://get.pnpm.io/install.sh | sh   (standalone installer)" >&2
    echo "" >&2
    echo "Then open a new terminal and try again." >&2
    echo "See https://pnpm.io/installation for full instructions." >&2
    exit 1
  fi
}

require_deps() {
  # next is installed into node_modules/.bin — if it's missing, deps haven't been installed
  if [[ ! -x "${ROOT_DIR}/node_modules/.bin/next" ]]; then
    echo "Dependencies not installed. Running pnpm install..."
    pnpm --dir "${ROOT_DIR}" install
    echo ""
  fi
}

APP_NAME="Balanced Work Life"
DEFAULT_PORT="4327"
COMMAND="${1:-help}"
PORT="${BALANCE_PORT:-${PORT:-$DEFAULT_PORT}}"

# Derive the invocation name so help text is accurate whether installed or not (#10)
INVOCATION="$(basename "$0")"

WATCH=0
MODE=""
for arg in "${@:2}"; do
  if [[ "${arg}" == "--watch" || "${arg}" == "--fg" ]]; then
    WATCH=1
  elif [[ -z "${MODE}" && "${arg}" != --* ]]; then
    MODE="${arg}"
  fi
done
MODE="${MODE:-${BALANCE_MODE:-dev}}"
URL="http://localhost:${PORT}"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"
STATE_DIR="${ROOT_DIR}/.balance"
PID_FILE="${STATE_DIR}/server.pid"
LOG_FILE="${STATE_DIR}/server.log"
INSTALL_DIR="${BALANCE_INSTALL_DIR:-${HOME}/bin}"
INSTALL_NAME="balance"
INSTALL_PATH="${INSTALL_DIR}/${INSTALL_NAME}"
WRAPPER_PATH="${SCRIPT_DIR}/balance"
PATH_BLOCK_BEGIN="# >>> balanced-work-life path >>>"
PATH_BLOCK_END="# <<< balanced-work-life path <<<"

mkdir -p "${STATE_DIR}"

# ---------------------------------------------------------------------------
# Output helpers (#8)
# ---------------------------------------------------------------------------

# Print an error message to stderr with a visible "Error:" prefix.
err() {
  echo "Error: $*" >&2
}

# Print a warning to stderr.
warn() {
  echo "Warning: $*" >&2
}

# Return the command hint prefix — "balance" if installed globally, else "./scripts/balance" (#9)
cmd() {
  if command -v balance >/dev/null 2>&1; then
    echo "balance"
  else
    echo "./scripts/balance"
  fi
}

# ---------------------------------------------------------------------------
# Process / port helpers
# ---------------------------------------------------------------------------

pid_is_running() {
  [[ -f "${PID_FILE}" ]] || return 1

  local pid
  pid="$(cat "${PID_FILE}")"
  [[ -n "${pid}" ]] || return 1

  kill -0 "${pid}" >/dev/null 2>&1
}

current_pid() {
  cat "${PID_FILE}"
}

# Returns 0 (true) if the PID file exists but the process is already dead — i.e. a crash (#7)
pid_is_stale() {
  [[ -f "${PID_FILE}" ]] || return 1
  local pid
  pid="$(cat "${PID_FILE}")"
  [[ -n "${pid}" ]] || return 1
  ! kill -0 "${pid}" >/dev/null 2>&1
}

clear_stale_pid() {
  if [[ -f "${PID_FILE}" ]] && ! pid_is_running; then
    rm -f "${PID_FILE}"
  fi
}

port_owner() {
  lsof -ti:"${PORT}" 2>/dev/null | head -n 1 || true
}

ensure_port_available() {
  local owner
  owner="$(port_owner)"

  if [[ -n "${owner}" ]]; then
    err "Port ${PORT} is already in use by pid ${owner}."
    err "Stop that process or choose another port with BALANCE_PORT=..."
    exit 1
  fi
}

kill_process_tree() {
  local pid="$1"
  local children

  children="$(pgrep -P "${pid}" 2>/dev/null)" || true
  for child in ${children}; do
    kill_process_tree "${child}"
  done
  kill "${pid}" >/dev/null 2>&1 || true
}

kill_port_processes() {
  local pids
  pids="$(lsof -ti TCP:"${PORT}" 2>/dev/null)" || true
  for pid in ${pids}; do
    kill -9 "${pid}" >/dev/null 2>&1 || true
  done
}

# ---------------------------------------------------------------------------
# Readiness polling (#1 #3 #5)
# Poll localhost:PORT until it responds or the timeout is reached.
# Prints progress dots and returns 0 when ready, 1 on timeout.
# ---------------------------------------------------------------------------
wait_for_server() {
  local timeout="${1:-60}"
  local elapsed=0
  printf "Waiting for server to be ready"
  while (( elapsed < timeout )); do
    # Use --max-time 1 (total) with no -f so any HTTP response — including 302
    # or a Next.js dev splash — counts as "server is up". We only care that the
    # TCP connection was accepted and the server sent back something, not that
    # the response is 2xx.
    if curl -s -o /dev/null --max-time 1 "${URL}" 2>/dev/null; then
      echo ""
      return 0
    fi
    printf "."
    sleep 1
    (( elapsed++ )) || true
  done
  echo ""
  return 1
}

# ---------------------------------------------------------------------------
# Start
# ---------------------------------------------------------------------------

start_server() {
  require_pnpm
  require_deps
  if [[ "${WATCH}" == "1" ]]; then
    ensure_port_available
    cd "${ROOT_DIR}"
    if [[ "${MODE}" == "prod" || "${MODE}" == "production" || "${MODE}" == "start" ]]; then
      echo "Building ${APP_NAME}..."
      pnpm next build
      exec pnpm next start -p "${PORT}"
    else
      exec pnpm next dev -p "${PORT}"
    fi
    return
  fi

  # Check for crash before clearing stale PID (#7)
  if pid_is_stale; then
    warn "Previous server process crashed or was killed."
    echo "  Check the logs: $(cmd) logs"
    rm -f "${PID_FILE}"
  fi

  clear_stale_pid

  if pid_is_running; then
    echo "${APP_NAME} is already running on ${URL} (pid $(current_pid))."
    echo "  $(cmd) open     open in browser"
    echo "  $(cmd) restart  restart the server"
    return
  fi

  ensure_port_available

  cd "${ROOT_DIR}"

  if [[ "${MODE}" == "prod" || "${MODE}" == "production" || "${MODE}" == "start" ]]; then
    echo "Building ${APP_NAME} before starting production server..."
    pnpm next build
    nohup pnpm next start -p "${PORT}" >"${LOG_FILE}" 2>&1 &
  elif [[ "${MODE}" == "dev" ]]; then
    nohup pnpm next dev -p "${PORT}" >"${LOG_FILE}" 2>&1 &
  else
    err "Unknown mode: ${MODE} (expected dev|prod)"
    exit 1
  fi

  local server_pid="$!"
  echo "${server_pid}" >"${PID_FILE}"

  # Brief crash check: give the process a moment then verify it is still alive (#2)
  sleep 1
  if ! kill -0 "${server_pid}" >/dev/null 2>&1; then
    err "Server failed to start. Last log output:"
    tail -n 20 "${LOG_FILE}" >&2
    rm -f "${PID_FILE}"
    exit 1
  fi

  # Wait for the server to accept connections before declaring it ready (#3)
  if wait_for_server 60; then
    echo "${APP_NAME} is ready at ${URL} (pid ${server_pid})."
  else
    err "Server process is running (pid ${server_pid}) but did not respond within 60 s."
    echo "  $(cmd) logs     check server logs"
    echo "  $(cmd) stop     stop the server"
    exit 1
  fi

  echo "  $(cmd) open     open in browser"
  echo "  $(cmd) logs     stream server logs"
  echo "  $(cmd) stop     stop the server"
}

# ---------------------------------------------------------------------------
# Stop
# ---------------------------------------------------------------------------

stop_server() {
  clear_stale_pid

  local pid
  if pid_is_running; then
    pid="$(current_pid)"
  else
    # No PID file — fall back to port-based lookup
    pid="$(lsof -ti TCP:"${PORT}" 2>/dev/null | head -1)"
    if [[ -z "${pid}" ]]; then
      echo "${APP_NAME} is not running."
      echo "  $(cmd) open   start and open in browser"
      return
    fi
    warn "No PID file found; stopping process on port ${PORT} (pid ${pid})."
  fi

  # Tell the browser to clear SW cache before killing the server
  curl -s -X POST "http://localhost:${PORT}/api/shutdown" >/dev/null 2>&1 || true

  kill_process_tree "${pid}"

  for _ in 1 2 3 4 5; do
    if ! kill -0 "${pid}" >/dev/null 2>&1; then
      break
    fi
    sleep 1
  done

  if kill -0 "${pid}" >/dev/null 2>&1; then
    kill -9 "${pid}" >/dev/null 2>&1 || true
  fi

  # Safety net: kill any remaining processes still on the port
  kill_port_processes

  rm -f "${PID_FILE}"
  echo "Stopped ${APP_NAME}."
  echo "  $(cmd) open   start again and open in browser"
}

# ---------------------------------------------------------------------------
# Status
# ---------------------------------------------------------------------------

status_server() {
  # Detect crash before clearing stale PID (#7)
  if pid_is_stale; then
    echo "${APP_NAME} crashed or was killed (stale PID found)."
    echo "  $(cmd) logs     check what went wrong"
    echo "  $(cmd) start    start again in background"
    rm -f "${PID_FILE}"
    return
  fi

  clear_stale_pid

  if pid_is_running; then
    echo "${APP_NAME} is running on ${URL} (pid $(current_pid))."
    echo "  $(cmd) logs     stream server logs"
    echo "  $(cmd) stop     stop the server"
    echo "  open ${URL}"
  else
    echo "${APP_NAME} is not running."
    echo "  $(cmd) open          start and open in browser"
    echo "  $(cmd) start         start in background"
    echo "  $(cmd) start --watch keep terminal open and stream logs"
  fi
}

# ---------------------------------------------------------------------------
# Open (#1 #5)
# ---------------------------------------------------------------------------

open_app() {
  # If something is already on the port, just open the browser — don't error
  if [[ -n "$(port_owner)" ]]; then
    echo "${APP_NAME} is already running at ${URL}"
    open "${URL}"
    return
  fi

  if [[ "${WATCH}" == "1" ]]; then
    # Poll for readiness in a subshell, then open browser — no hardcoded sleep (#5)
    (wait_for_server 60 >/dev/null 2>&1 && open "${URL}") &
    start_server
  else
    start_server
    open "${URL}"
  fi
}

# ---------------------------------------------------------------------------
# Logs (#6)
# ---------------------------------------------------------------------------

show_logs() {
  # Warn the user if the server is not currently running (#6)
  if ! pid_is_running; then
    if [[ -f "${LOG_FILE}" ]]; then
      warn "Server is not running. Showing last log output ($(cmd) start to restart):"
      echo ""
    else
      warn "Server is not running and no log file exists yet."
      echo "  $(cmd) start   start the server"
      return
    fi
  fi

  touch "${LOG_FILE}"
  tail -f "${LOG_FILE}"
}

# ---------------------------------------------------------------------------
# Install / uninstall
# ---------------------------------------------------------------------------

preferred_profile_file() {
  case "$(basename "${SHELL:-}")" in
    bash)
      echo "${HOME}/.bashrc"
      ;;
    zsh|*)
      echo "${HOME}/.zshrc"
      ;;
  esac
}

profile_files() {
  printf '%s\n' \
    "${HOME}/.zshrc" \
    "${HOME}/.zprofile" \
    "${HOME}/.bashrc" \
    "${HOME}/.bash_profile"
}

path_has_install_dir() {
  case ":${PATH}:" in
    *":${INSTALL_DIR}:"*) return 0 ;;
    *) return 1 ;;
  esac
}

profile_has_path_block() {
  local profile
  while IFS= read -r profile; do
    [[ -f "${profile}" ]] || continue
    grep -Fq "${PATH_BLOCK_BEGIN}" "${profile}" && return 0
  done < <(profile_files)

  return 1
}

add_path_to_profile() {
  local profile
  profile="$(preferred_profile_file)"
  touch "${profile}"

  if grep -Fq "${PATH_BLOCK_BEGIN}" "${profile}"; then
    return
  fi

  {
    echo ""
    echo "${PATH_BLOCK_BEGIN}"
    echo "export PATH=\"${INSTALL_DIR}:\$PATH\""
    echo "${PATH_BLOCK_END}"
  } >>"${profile}"

  echo "Added ${INSTALL_DIR} to PATH in ${profile}."
  echo "Open a new terminal or run: source ${profile}"
}

remove_path_block_from_file() {
  local profile temp
  profile="$1"

  [[ -f "${profile}" ]] || return 0
  grep -Fq "${PATH_BLOCK_BEGIN}" "${profile}" || return 0

  temp="$(mktemp)"
  awk \
    -v begin="${PATH_BLOCK_BEGIN}" \
    -v end="${PATH_BLOCK_END}" \
    '$0 == begin { skipping = 1; next }
     $0 == end { skipping = 0; next }
     !skipping { print }' \
    "${profile}" >"${temp}"
  mv "${temp}" "${profile}"
  echo "Removed managed PATH block from ${profile}."
}

install_command() {
  mkdir -p "${INSTALL_DIR}"
  ln -sfn "${WRAPPER_PATH}" "${INSTALL_PATH}"
  echo "Installed ${INSTALL_NAME} -> ${WRAPPER_PATH}"

  if path_has_install_dir; then
    echo "${INSTALL_DIR} is already on PATH."
  elif profile_has_path_block; then
    echo "${INSTALL_DIR} is already managed in a shell profile."
    echo "Open a new terminal for PATH changes to take effect."
  else
    add_path_to_profile
  fi

  echo "  ${INSTALL_NAME} open     start and open in browser"
}

uninstall_command() {
  if [[ -L "${INSTALL_PATH}" ]] && [[ "$(readlink "${INSTALL_PATH}")" == "${WRAPPER_PATH}" ]]; then
    rm -f "${INSTALL_PATH}"
    echo "Removed ${INSTALL_PATH}."
  elif [[ -e "${INSTALL_PATH}" ]]; then
    err "Skipped ${INSTALL_PATH}; it was not installed by this project."
  else
    echo "${INSTALL_PATH} is not installed."
  fi

  local profile
  while IFS= read -r profile; do
    remove_path_block_from_file "${profile}"
  done < <(profile_files)
}

# ---------------------------------------------------------------------------
# Help (#10)
# ---------------------------------------------------------------------------

show_help() {
  cat <<EOF
${APP_NAME} — dev server controller

Usage:
  ${INVOCATION} <command> [mode] [--watch]

Commands:
  open        Start server and open in browser (default)
  start       Start server in background
  stop        Stop server
  restart     Restart server
  status      Show running status and PID
  logs        Stream server logs
  install     Symlink 'balance' into ~/bin and add to PATH
  uninstall   Remove symlink and PATH entry

Modes:    dev (default) | prod
Flags:    --watch  keep terminal open and stream logs live
Env:      BALANCE_PORT=4327  BALANCE_MODE=dev  BALANCE_INSTALL_DIR=~/bin

Examples:
  ${INVOCATION}                       Show this help
  ${INVOCATION} open                  Start + open browser
  ${INVOCATION} start prod            Start production server in background
  ${INVOCATION} start --watch         Start dev server and stream logs
  ${INVOCATION} install               Install 'balance' command globally
EOF
}

# ---------------------------------------------------------------------------
# Dispatch
# ---------------------------------------------------------------------------

case "${COMMAND}" in
  help|--help|-h)
    show_help
    ;;
  install)
    install_command
    ;;
  uninstall)
    uninstall_command
    ;;
  start)
    start_server
    ;;
  stop)
    stop_server
    ;;
  restart)
    stop_server
    start_server
    ;;
  open)
    open_app
    ;;
  status)
    status_server
    ;;
  logs)
    show_logs
    ;;
  *)
    err "Unknown command: ${COMMAND}"
    err "Run '${INVOCATION} help' for usage."
    exit 1
    ;;
esac
