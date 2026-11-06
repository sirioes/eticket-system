#!/usr/bin/env bash
# Shared helpers. Sourced by deploy.sh, backup.sh and restore.sh.
# shellcheck disable=SC2034

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ENV_FILE="$ROOT/.env.production"
BACKUP_DIR="$ROOT/backups"
PROJECT="eticket-prod"
UPLOADS_VOLUME="${PROJECT}_uploads"

log() { printf '[%s] %s\n' "$(date +%H:%M:%S)" "$*" >&2; }
die() { log "ERROR: $*"; exit 1; }

compose() {
  docker compose -f "$ROOT/docker-compose.prod.yml" --env-file "$ENV_FILE" "$@"
}

env_get() {
  grep -E "^$1=" "$ENV_FILE" | tail -n 1 | cut -d= -f2- | tr -d '\r' || true
}

require_env() {
  [ -f "$ENV_FILE" ] || die ".env.production not found. Copy .env.production.example and fill in the secrets."
  local key
  for key in DOMAIN MYSQL_DATABASE MYSQL_USER MYSQL_PASSWORD MYSQL_ROOT_PASSWORD JWT_SECRET; do
    [ -n "$(env_get "$key")" ] || die "$key is empty in .env.production"
  done
}

require_docker() {
  command -v docker >/dev/null 2>&1 || die "docker not found"
  docker info >/dev/null 2>&1 || die "Docker daemon is not reachable. Is Docker running?"
}
