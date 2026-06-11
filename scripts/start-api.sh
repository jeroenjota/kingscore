#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
API_DIR="$(cd "$ROOT_DIR/../api" 2>/dev/null && pwd || true)"

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

echo "Start Laurierboom API in dev-modus vanuit: $API_DIR"
exec npm run dev