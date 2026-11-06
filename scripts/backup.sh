#!/usr/bin/env bash
# Dump MySQL and archive the uploads volume into backups/.
set -euo pipefail
# shellcheck source=common.sh
source "$(dirname "${BASH_SOURCE[0]}")/common.sh"

KEEP="${KEEP:-7}"

require_env
require_docker
mkdir -p "$BACKUP_DIR"
chmod 700 "$BACKUP_DIR"

running="$(compose ps --status running --services 2>/dev/null || true)"
grep -qx mysql <<<"$running" || die "mysql is not running. Start it with: docker compose -f docker-compose.prod.yml --env-file .env.production up -d mysql"

stamp="$(date +%Y%m%d-%H%M%S)"
sql_file="$BACKUP_DIR/eticket-$stamp.sql.gz"
uploads_name="eticket-$stamp-uploads.tar.gz"

log "Dumping database to $sql_file"
# shellcheck disable=SC2016
if ! compose exec -T mysql sh -c 'exec env MYSQL_PWD="$MYSQL_ROOT_PASSWORD" mysqldump -uroot --single-transaction --routines --triggers --default-character-set=utf8mb4 "$MYSQL_DATABASE"' | gzip -c > "$sql_file.part"; then
  rm -f "$sql_file.part"
  die "mysqldump failed"
fi
[ -s "$sql_file.part" ] || { rm -f "$sql_file.part"; die "dump is empty"; }
mv "$sql_file.part" "$sql_file"

if docker volume inspect "$UPLOADS_VOLUME" >/dev/null 2>&1; then
  log "Archiving uploads volume to $BACKUP_DIR/$uploads_name"
  docker run --rm \
    -e OWNER="$(id -u):$(id -g)" -e FILE="$uploads_name" \
    -v "$UPLOADS_VOLUME":/data:ro -v "$BACKUP_DIR":/backup \
    alpine:3 sh -c 'tar czf "/backup/$FILE" -C /data . && chown "$OWNER" "/backup/$FILE"' >&2
else
  log "Uploads volume not found yet, skipping uploads archive"
fi

# shellcheck disable=SC2012
ls -1t "$BACKUP_DIR"/eticket-*.sql.gz | tail -n +"$((KEEP + 1))" | while read -r old; do
  log "Removing old backup $(basename "$old")"
  rm -f "$old" "${old%.sql.gz}-uploads.tar.gz"
done

echo "$sql_file"
