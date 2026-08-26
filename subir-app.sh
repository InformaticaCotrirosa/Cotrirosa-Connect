#!/usr/bin/env bash
# Sobe backend (Express) e frontend (Vite) do Cotrirosa-Connect.
# Portas exclusivas: backend 3010 | frontend 5174
# (não mexe em 3000/5173 do npscotri nem 4000/8080 do HelpDesk)
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$ROOT"

BACKEND_PORT="${BACKEND_PORT:-3010}"
FRONTEND_PORT="${FRONTEND_PORT:-5174}"

echo "→ Liberando apenas portas do Connect ($FRONTEND_PORT, $BACKEND_PORT)…"
fuser -k "${FRONTEND_PORT}/tcp" 2>/dev/null || true
fuser -k "${BACKEND_PORT}/tcp" 2>/dev/null || true
sleep 1

# Env do frontend
if [[ ! -f "$ROOT/.env" ]]; then
  echo "→ Criando .env a partir de .env.example…"
  cp "$ROOT/.env.example" "$ROOT/.env"
fi

# Env do backend (obrigatório)
if [[ ! -f "$ROOT/backend/.env" ]]; then
  echo "→ Criando backend/.env a partir de backend/.env.example…"
  cp "$ROOT/backend/.env.example" "$ROOT/backend/.env"
  echo "AVISO: revise backend/.env (Oracle / JWT) antes de usar em produção."
fi

# Dependências
if [[ ! -d "$ROOT/node_modules" ]]; then
  echo "→ npm install (frontend)…"
  npm install --prefix "$ROOT"
fi
if [[ ! -d "$ROOT/backend/node_modules" ]]; then
  echo "→ npm install (backend)…"
  npm install --prefix "$ROOT/backend"
fi

echo "→ Backend (porta $BACKEND_PORT)…"
: >>"$ROOT/logs-backend.txt"
(
  cd "$ROOT/backend"
  export PORT="$BACKEND_PORT"
  # Instant Client (Thick): libs precisam estar no LD_LIBRARY_PATH
  if [[ -f .env ]]; then
    ORACLE_CLIENT_LIB_VAL="$(grep -E '^ORACLE_CLIENT_LIB=' .env | tail -1 | cut -d= -f2- | tr -d '"' | tr -d "'")"
    if [[ -n "${ORACLE_CLIENT_LIB_VAL:-}" && -d "$ORACLE_CLIENT_LIB_VAL" ]]; then
      export LD_LIBRARY_PATH="${ORACLE_CLIENT_LIB_VAL}${LD_LIBRARY_PATH:+:$LD_LIBRARY_PATH}"
      # Ubuntu recente: Instant Client procura libaio.so.1
      if [[ ! -e "${ORACLE_CLIENT_LIB_VAL}/libaio.so.1" && -e /usr/lib/x86_64-linux-gnu/libaio.so.1t64 ]]; then
        ln -sf /usr/lib/x86_64-linux-gnu/libaio.so.1t64 "${ORACLE_CLIENT_LIB_VAL}/libaio.so.1" 2>/dev/null || true
      fi
    fi
  fi
  nohup npm run start >>"$ROOT/logs-backend.txt" 2>&1 &
  echo $! >"$ROOT/.run-backend.pid"
)

echo "→ Aguardando API em http://127.0.0.1:${BACKEND_PORT}/health…"
API_OK=0
for _ in $(seq 1 60); do
  if curl -sf "http://127.0.0.1:${BACKEND_PORT}/health" >/dev/null 2>&1; then
    API_OK=1
    break
  fi
  sleep 1
done

start_frontend() {
  echo "→ Frontend (porta $FRONTEND_PORT)…"
  : >>"$ROOT/logs-frontend.txt"
  nohup npm run dev -- --host 0.0.0.0 --port "$FRONTEND_PORT" --strictPort >>"$ROOT/logs-frontend.txt" 2>&1 &
  echo $! >"$ROOT/.run-frontend.pid"
  sleep 2
}

if [[ "$API_OK" -ne 1 ]]; then
  echo "AVISO: API não respondeu em 60s. Veja: $ROOT/logs-backend.txt"
  echo "       Causa comum: Oracle (alias PROD sem tnsnames.ora / Easy Connect)."
  echo "       Outros apps (npscotri/HelpDesk) não foram afetados."
  echo "       Subindo só o frontend para você abrir a UI…"
  start_frontend
  echo ""
  echo "Frontend: http://127.0.0.1:${FRONTEND_PORT}/"
  echo "Backend:  parado — ajuste ORACLE_CONNECTION_STRING ou TNS_ADMIN em backend/.env e rode de novo."
  exit 1
fi

start_frontend

IP_LAN="$(hostname -I 2>/dev/null | awk '{print $1}')"
echo ""
echo "Pronto. Abra no navegador:"
echo "  http://127.0.0.1:${FRONTEND_PORT}/"
if [[ -n "${IP_LAN:-}" ]]; then
  echo "  http://${IP_LAN}:${FRONTEND_PORT}/"
fi
echo "  Backend health: http://127.0.0.1:${BACKEND_PORT}/health"
echo "Logs: $ROOT/logs-backend.txt | $ROOT/logs-frontend.txt"
echo ""

if [[ "${1:-}" == "--sem-terminal" ]]; then
  exit 0
fi

if [[ -n "${DISPLAY:-}" ]] && command -v gnome-terminal >/dev/null 2>&1; then
  gnome-terminal --title="Cotrirosa-Connect — logs" -- bash -c "tail -n 30 -f \"$ROOT/logs-backend.txt\" \"$ROOT/logs-frontend.txt\"; exec bash" &
elif [[ -n "${DISPLAY:-}" ]] && command -v x-terminal-emulator >/dev/null 2>&1; then
  x-terminal-emulator -T "Cotrirosa-Connect — logs" -e bash -c "tail -n 30 -f \"$ROOT/logs-backend.txt\" \"$ROOT/logs-frontend.txt\"; exec bash" &
else
  echo "(Para ver logs: tail -f logs-backend.txt logs-frontend.txt)"
fi
