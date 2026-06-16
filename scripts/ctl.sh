#!/usr/bin/env bash
#
# ctl.sh - background launcher for Balanced Work Life.
# Usage: ./scripts/ctl.sh start|stop|restart|open|status|logs|install|uninstall [dev|prod] [--fg]
# Env:   BALANCE_PORT=4327 ./scripts/ctl.sh open
#        BALANCE_INSTALL_DIR=/usr/local/bin ./scripts/ctl.sh install
# Flags: --fg  run in foreground (blocks terminal, logs to stdout)
#
set -euo pipefail

APP_NAME="Balanced Work Life"
DEFAULT_PORT="4327"
COMMAND="${1:-help}"
MODE="${2:-${BALANCE_MODE:-dev}}"
PORT="${BALANCE_PORT:-${PORT:-$DEFAULT_PORT}}"

FG=0
for arg in "$@"; do
  [[ "${arg}" == "--fg" ]] && FG=1
done
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
    echo "Port ${PORT} is already in use by pid ${owner}." >&2
    echo "Stop that process or choose another port with BALANCE_PORT=..." >&2
    exit 1
  fi
}

start_server() {
  if [[ "${FG}" == "1" ]]; then
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

  clear_stale_pid

  if pid_is_running; then
    echo "${APP_NAME} is already running on ${URL} (pid $(current_pid))."
    echo "  balance open     open in browser"
    echo "  balance restart  restart the server"
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
    echo "Unknown mode: ${MODE} (expected dev|prod)" >&2
    exit 1
  fi

  echo "$!" >"${PID_FILE}"
  echo "${APP_NAME} started on ${URL} (pid $(current_pid))."
  echo "  balance open     open in browser"
  echo "  balance logs     tail server logs"
  echo "  balance stop     stop the server"
}

stop_server() {
  clear_stale_pid

  if ! pid_is_running; then
    echo "${APP_NAME} is not running."
    echo "Hint: balance open   to start and open in browser"
    return
  fi

  local pid
  pid="$(current_pid)"
  kill "${pid}" >/dev/null 2>&1 || true

  for _ in 1 2 3 4 5; do
    if ! kill -0 "${pid}" >/dev/null 2>&1; then
      break
    fi
    sleep 1
  done

  if kill -0 "${pid}" >/dev/null 2>&1; then
    kill -9 "${pid}" >/dev/null 2>&1 || true
  fi

  rm -f "${PID_FILE}"
  echo "Stopped ${APP_NAME}."
  echo "  balance open     start again and open in browser"
}

status_server() {
  clear_stale_pid

  if pid_is_running; then
    echo "${APP_NAME} is running on ${URL} (pid $(current_pid))."
    echo "  balance logs     tail server logs"
    echo "  balance stop     stop the server"
    echo "  open ${URL}"
  else
    echo "${APP_NAME} is not running."
    echo "  balance open     start and open in browser"
    echo "  balance start    start in background"
    echo "  balance start --fg   start in foreground (logs to stdout)"
  fi
}

open_app() {
  if [[ "${FG}" == "1" ]]; then
    (sleep 3 && open "${URL}") &
    start_server
  else
    start_server
    open "${URL}"
  fi
}

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
    echo "Skipped ${INSTALL_PATH}; it was not installed by this project." >&2
  else
    echo "${INSTALL_PATH} is not installed."
  fi

  local profile
  while IFS= read -r profile; do
    remove_path_block_from_file "${profile}"
  done < <(profile_files)
}

show_help() {
  cat <<EOF
${APP_NAME} — dev server controller

Usage:
  ./balance <command> [mode] [--fg]

Commands:
  open        Start server and open in browser (default)
  start       Start server in background
  stop        Stop server
  restart     Restart server
  status      Show running status and PID
  logs        Tail server logs
  install     Symlink 'balance' into ~/bin and add to PATH
  uninstall   Remove symlink and PATH entry

Modes:    dev (default) | prod
Flags:    --fg  run in foreground (blocks terminal, logs to stdout)
Env:      BALANCE_PORT=4327  BALANCE_MODE=dev  BALANCE_INSTALL_DIR=~/bin

Examples:
  ./balance                    Show this help
  ./balance open               Start + open browser
  ./balance start prod         Start production server in background
  ./balance start --fg         Start dev server in foreground
  ./balance install            Install 'balance' command globally
EOF
}

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
    touch "${LOG_FILE}"
    tail -f "${LOG_FILE}"
    ;;
  *)
    echo "Unknown command: ${COMMAND}" >&2
    echo "Run './balance help' for usage." >&2
    exit 1
    ;;
esac
