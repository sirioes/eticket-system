#!/usr/bin/env bash
# Deploy an image tag: pull/build -> backup -> migrate -> up -> health check.
set -euo pipefail
# shellcheck source=common.sh
source "$(dirname "${BASH_SOURCE[0]}")/common.sh"

HEALTH_RETRIES="${HEALTH_RETRIES:-30}"
HEALTH_INTERVAL="${HEALTH_INTERVAL:-2}"

tag="${1:-}"
[ -n "$tag" ] || die "usage: scripts/deploy.sh <tag>  (use 'local' to build here)"
[[ "$tag" =~ ^[A-Za-z0-9_.-]{1,128}$ ]] || die "invalid tag: $tag"

require_env
require_docker
command -v curl >/dev/null 2>&1 || die "curl not found"

mkdir -p "$BACKUP_DIR"
exec 9>"$BACKUP_DIR/.deploy.lock"
flock -n 9 || die "another deploy is already running"

previous_tag="$(env_get TAG)"
previous_tag="${previous_tag:-local}"
domain="$(env_get DOMAIN)"
backup_file=""
export TAG="$tag"

rollback_hint() {
  log "Deploy of '$tag' FAILED. To roll back:"
  if [ -n "$backup_file" ]; then
    log "  1. If the database schema changed, restore it: ./scripts/restore.sh $backup_file"
  fi
  log "  2. Redeploy the previous version: ./scripts/deploy.sh $previous_tag"
}

fail() {
  log "ERROR: $*"
  rollback_hint
  exit 1
}

wait_for_health() {
  local opts=(-s --max-time 5 --resolve "$domain:443:127.0.0.1")
  case "$domain" in localhost | *.localhost) opts+=(-k) ;; esac
  local i out
  for ((i = 1; i <= HEALTH_RETRIES; i++)); do
    out="$(curl "${opts[@]}" "https://$domain/api/health" 2>/dev/null || true)"
    [[ "$out" == *'"status":"ok"'* ]] && return 0
    sleep "$HEALTH_INTERVAL"
  done
  return 1
}

log "Deploying tag '$tag' (previous: '$previous_tag')"

if [ "$tag" = local ]; then
  log "Building images on this machine"
  compose --profile tools build >&2 || die "build failed"
else
  log "Pulling images (private GHCR images need: docker login ghcr.io)"
  compose --profile tools pull >&2 || die "pull failed"
fi

log "Starting database"
compose up -d --wait mysql >&2 || die "could not start mysql"

log "Backing up before migration"
backup_file="$("$ROOT/scripts/backup.sh")" || die "backup failed, nothing was changed"

log "Running migrations"
compose --profile tools run --rm -T migrate >&2 || fail "migration failed"

log "Starting services"
compose up -d --remove-orphans --wait --wait-timeout 180 >&2 || fail "services did not become healthy"

log "Waiting for https://$domain/api/health"
wait_for_health || fail "health check did not pass"

if grep -q '^TAG=' "$ENV_FILE"; then
  sed -i "s|^TAG=.*|TAG=$tag|" "$ENV_FILE"
else
  printf 'TAG=%s\n' "$tag" >> "$ENV_FILE"
fi

log "Deployed '$tag'. Backup: $backup_file"
