#!/usr/bin/env bash
# Restore the database (and uploads, if a matching archive exists) from a backup.
set -euo pipefail
# shellcheck source=common.sh
source "$(dirname "${BASH_SOURCE[0]}")/common.sh"

assume_yes=false
if [ "${1:-}" = "-y" ]; then
  assume_yes=true
  shift
fi

sql_file="${1:-}"
[ -n "$sql_file" ] || die "usage: scripts/restore.sh [-y] <backup.sql.gz>"
[ -f "$sql_file" ] || die "file not found: $sql_file"
case "$sql_file" in *.sql.gz) ;; *) die "expected a .sql.gz file" ;; esac
gzip -t "$sql_file" || die "backup file is corrupt"

require_env
require_docker

uploads_file="${sql_file%.sql.gz}-uploads.tar.gz"
db="$(env_get MYSQL_DATABASE)"

log "This DROPS database '$db' and replaces it with $sql_file"
if [ -f "$uploads_file" ]; then
  log "The uploads volume will also be replaced from $uploads_file"
fi
if [ "$assume_yes" != true ]; then
  read -r -p "Type the database name ($db) to continue: " answer
  [ "$answer" = "$db" ] || die "aborted"
fi

log "Starting mysql and stopping backend"
compose up -d --wait mysql >&2
compose stop backend >&2 || true

log "Restoring database"
# shellcheck disable=SC2016
compose exec -T mysql sh -c 'exec env MYSQL_PWD="$MYSQL_ROOT_PASSWORD" mysql -uroot -e "DROP DATABASE IF EXISTS \`$MYSQL_DATABASE\`; CREATE DATABASE \`$MYSQL_DATABASE\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci"'
# shellcheck disable=SC2016
gunzip -c "$sql_file" | compose exec -T mysql sh -c 'exec env MYSQL_PWD="$MYSQL_ROOT_PASSWORD" mysql -uroot --default-character-set=utf8mb4 "$MYSQL_DATABASE"'

if [ -f "$uploads_file" ]; then
  log "Restoring uploads"
  docker volume create \
    --label "com.docker.compose.project=$PROJECT" \
    --label "com.docker.compose.volume=uploads" \
    "$UPLOADS_VOLUME" >/dev/null
  docker run --rm \
    -e FILE="${uploads_file##*/}" \
    -v "$UPLOADS_VOLUME":/data \
    -v "$(cd "$(dirname "$uploads_file")" && pwd)":/backup:ro \
    alpine:3 sh -c 'find /data -mindepth 1 -delete && tar xzf "/backup/$FILE" -C /data' >&2
fi

log "Restore finished. Start the app with: ./scripts/deploy.sh <tag>"
