#!/usr/bin/env bash
# Para apenas o Cotrirosa-Connect (portas 3010 e 5174).
# Não encerra npscotri (3000/5173) nem HelpDesk (4000/8080).
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$ROOT"

BACKEND_PORT="${BACKEND_PORT:-3010}"
FRONTEND_PORT="${FRONTEND_PORT:-5174}"

echo "→ Encerrando Connect nas portas $FRONTEND_PORT e $BACKEND_PORT…"
fuser -k "${FRONTEND_PORT}/tcp" 2>/dev/null || true
fuser -k "${BACKEND_PORT}/tcp" 2>/dev/null || true
sleep 1

for f in .run-backend.pid .run-frontend.pid; do
  if [[ -f "$ROOT/$f" ]]; then
    PID="$(cat "$ROOT/$f" 2>/dev/null || true)"
    if [[ -n "${PID:-}" ]] && kill -0 "$PID" 2>/dev/null; then
      kill "$PID" 2>/dev/null || true
    fi
    rm -f "$ROOT/$f"
  fi
done

echo "Serviços do Cotrirosa-Connect parados (outros apps intactos)."
