#!/usr/bin/env bash
# Prepara el servidor para arrancar la aplicación.
#
# GitHub no incluye en su ZIP los archivos que empiezan por punto
# (.env, .dockerignore), así que este script los crea a partir de
# env.example y dockerignore. También genera una contraseña segura
# y arranca los contenedores.
#
# Uso:
#   bash install.sh              # prepara todo y arranca
#   bash install.sh --no-start   # sólo prepara los archivos

set -euo pipefail
cd "$(dirname "$0")"

# --- .env ---
if [[ -f .env ]]; then
  echo "• .env ya existe: no se modifica."
else
  cp env.example .env
  if command -v openssl >/dev/null 2>&1; then
    pass="$(openssl rand -base64 30 | tr -dc 'A-Za-z0-9' | cut -c1-28)"
  else
    pass="$(head -c 200 /dev/urandom | tr -dc 'A-Za-z0-9' | cut -c1-28)"
  fi
  sed -i "s|^POSTGRES_PASSWORD=.*|POSTGRES_PASSWORD=${pass}|" .env
  echo "• Creado .env con una contraseña generada automáticamente."
fi

# --- .dockerignore ---
if [[ ! -f .dockerignore && -f dockerignore ]]; then
  cp dockerignore .dockerignore
  echo "• Creado .dockerignore."
fi

# --- Dependencias Node ---
if [[ ! -f package.json ]]; then
  echo "✗ No se encontró package.json. Ejecuta este script desde la raíz del proyecto." >&2
  exit 1
fi
if [[ ! -f package-lock.json ]]; then
  echo "! package-lock.json no está presente. El Dockerfile usará npm install y generará las dependencias durante el build."
  echo "  Para builds 100% reproducibles, sube package-lock.json a GitHub."
fi

# --- Docker ---
if ! command -v docker >/dev/null 2>&1; then
  echo "✗ Docker no está instalado en este equipo."
  echo "  Instálalo con:  curl -fsSL https://get.docker.com | sh"
  exit 1
fi
if docker compose version >/dev/null 2>&1; then
  COMPOSE="docker compose"
elif command -v docker-compose >/dev/null 2>&1; then
  COMPOSE="docker-compose"
else
  echo "✗ No se encontró 'docker compose' ni 'docker-compose'." >&2
  exit 1
fi

if [[ "${1:-}" == "--no-start" ]]; then
  echo "Listo. Arranca la aplicación con:  ${COMPOSE} up -d --build"
  exit 0
fi

echo "• Construyendo y arrancando contenedores (la primera vez tarda unos minutos)…"
${COMPOSE} up -d --build

sleep 2
port="$(grep -E '^APP_PORT=' .env | cut -d= -f2 | tr -d '[:space:]')"
port="${port:-3000}"
ip="$(hostname -I 2>/dev/null | awk '{print $1}')"
[[ -n "${ip:-}" ]] || ip="IP-DE-TU-SERVIDOR"

echo
echo "✓ Aplicación arrancada."
echo "  Abre desde cualquier dispositivo de tu red:  http://${ip}:${port}"
echo "  Comprueba el estado con:                     ${COMPOSE} ps"
echo "  Copia de seguridad de la base de datos:"
echo "    ${COMPOSE} exec -T db pg_dump -U app -d app_db > copia-\$(date +%F).sql"
