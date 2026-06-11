#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
API_DIR=""
if [[ -d "$ROOT_DIR/../api" ]]; then
  API_DIR="$(cd "$ROOT_DIR/../api" && pwd)"
fi

if [[ -z "$API_DIR" || ! -f "$API_DIR/package.json" ]]; then
  echo "Kon ../api niet vinden vanaf: $ROOT_DIR"
  exit 1
fi

cd "$API_DIR"

if [[ ! -d "node_modules" ]]; then
  echo "API dependencies ontbreken, voer npm install uit..."
  npm install
fi

if [[ ! -f ".env" && -f ".env.example" ]]; then
  cp .env.example .env
  echo "'.env.example' is gekopieerd naar '.env' in ../api"
fi

API_PORT="54321"
if [[ -f ".env" ]]; then
  while IFS= read -r line; do
    [[ "$line" =~ ^[[:space:]]*# ]] && continue
    if [[ "$line" =~ ^[[:space:]]*PORT[[:space:]]*=[[:space:]]*([0-9]+)[[:space:]]*$ ]]; then
      API_PORT="${BASH_REMATCH[1]}"
    fi
  done < ".env"
fi

is_port_listening() {
  local port="$1"

  if command -v ss > /dev/null 2>&1; then
    ss -ltn "sport = :$port" 2> /dev/null | grep -q ":$port"
    return
  fi

  if command -v lsof > /dev/null 2>&1; then
    lsof -nP -iTCP:"$port" -sTCP:LISTEN > /dev/null 2>&1
    return
  fi

  return 1
}

if is_port_listening "$API_PORT"; then
  echo "Laurierboom API lijkt al actief op poort $API_PORT."
  exit 0
fi

echo "Start Laurierboom API in dev-modus vanuit: $API_DIR"
exec npm run dev
