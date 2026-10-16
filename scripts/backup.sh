#!/bin/bash
# Backup do banco Postgres do Assistente Financeiro.
#
# Uso:  scripts/backup.sh            → grava backups/financas_AAAA-MM-DD_HHMM.dump
#       BACKUP_DIR=/mnt/hd scripts/backup.sh
#
# Mantém os últimos $BACKUP_DIAS dias (padrão 30). Formato custom do pg_dump
# (compactado); para restaurar use scripts/restaurar_backup.sh.
set -euo pipefail

cd "$(dirname "$0")/.."

BACKUP_DIR="${BACKUP_DIR:-$PWD/backups}"
BACKUP_DIAS="${BACKUP_DIAS:-30}"
ARQUIVO="$BACKUP_DIR/financas_$(date +%Y-%m-%d_%H%M).dump"

# launchd/cron rodam com PATH mínimo; garante que o docker seja encontrado
export PATH="/usr/local/bin:/opt/homebrew/bin:/Applications/Docker.app/Contents/Resources/bin:$PATH"

mkdir -p "$BACKUP_DIR"

docker compose --env-file financas.env exec -T postgres \
  sh -c 'pg_dump -U "$POSTGRES_USER" -d financas -Fc' > "$ARQUIVO.tmp"

# Dump vazio ou truncado não pode substituir os bons na rotação
if [ ! -s "$ARQUIVO.tmp" ]; then
  rm -f "$ARQUIVO.tmp"
  echo "$(date '+%F %T') ERRO: dump vazio" >&2
  exit 1
fi
mv "$ARQUIVO.tmp" "$ARQUIVO"

find "$BACKUP_DIR" -name 'financas_*.dump' -mtime +"$BACKUP_DIAS" -delete

echo "$(date '+%F %T') OK: $ARQUIVO ($(du -h "$ARQUIVO" | cut -f1))"
