#!/bin/bash
# Restaura um backup gerado por scripts/backup.sh.
#
# Uso:  scripts/restaurar_backup.sh backups/financas_2026-10-16_0300.dump
#
# ATENÇÃO: substitui TODOS os dados atuais do banco pelos do backup.
set -euo pipefail

cd "$(dirname "$0")/.."

ARQUIVO="${1:-}"
if [ -z "$ARQUIVO" ] || [ ! -s "$ARQUIVO" ]; then
  echo "Uso: $0 <arquivo.dump>"
  echo "Backups disponíveis:"
  ls -1t backups/financas_*.dump 2>/dev/null | head -10
  exit 1
fi

read -r -p "Substituir TODOS os dados atuais por $ARQUIVO? Digite 'sim': " resp
[ "$resp" = "sim" ] || { echo "Cancelado."; exit 1; }

# Backup de segurança do estado atual antes de sobrescrever
scripts/backup.sh

docker compose --env-file financas.env exec -T postgres \
  sh -c 'pg_restore -U "$POSTGRES_USER" -d financas --clean --if-exists --no-owner' < "$ARQUIVO"

echo "Restaurado: $ARQUIVO"
