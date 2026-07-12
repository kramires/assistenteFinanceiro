#!/bin/bash
# Plano B: mata o mv travado e COPIA o projeto (rsync) para /Users/kramires/assistenteFinanceiro
ORIGEM="/Users/kramires/Documents/scripts/assistenteFinanceiro"
DESTINO="/Users/kramires/assistenteFinanceiro"

{
  echo "== $(date '+%d/%m/%Y %H:%M:%S') — migração v2 =="

  echo "== 1/5 Encerrando mv travado =="
  pkill -f "mv $ORIGEM" && echo "  mv encerrado." || echo "  nenhum mv em execução."
  sleep 2

  echo ""
  echo "== 2/5 Limpando destino parcial (se houver) =="
  rm -rf "$DESTINO"

  echo ""
  echo "== 3/5 Copiando projeto (rsync, sem venv) =="
  rsync -a --exclude 'venv' --exclude 'node_modules' --exclude '.DS_Store' "$ORIGEM/" "$DESTINO/"
  RC=$?
  if [ $RC -ne 0 ]; then echo "ERRO no rsync (exit $RC)"; echo "== FIM_COM_ERRO =="; exit 1; fi

  echo ""
  echo "== 4/5 Conferindo arquivos essenciais =="
  ERRO=0
  for f in docker-compose.yml financas.env frontend/build/index.html nginx/nginx.conf .git/HEAD; do
    if [ -e "$DESTINO/$f" ]; then echo "  $f ✓"; else echo "  $f AUSENTE ✗"; ERRO=1; fi
  done
  [ $ERRO -ne 0 ] && { echo "== FIM_COM_ERRO (arquivos faltando) =="; exit 1; }

  echo ""
  echo "== 5/5 Subindo containers do novo local =="
  cd "$DESTINO" && docker compose --env-file financas.env up -d

  PRONTA=0
  for i in $(seq 1 45); do
    CODE=$(curl -s -o /dev/null -w "%{http_code}" --max-time 2 http://localhost:8765/api/auth/me)
    if [ "$CODE" = "401" ] || [ "$CODE" = "403" ]; then PRONTA=1; break; fi
    sleep 2
  done
  if [ $PRONTA -eq 1 ]; then
    echo "  Sistema no ar a partir de $DESTINO ✓"
    echo ""
    echo "  IMPORTANTE: a pasta antiga em $ORIGEM ficou como backup."
    echo "  Depois de conferir que está tudo ok, apague-a para não usar por engano."
    echo ""
    echo "== FIM_OK =="
  else
    echo "  API não respondeu em 90s — verifique docker compose logs"
    echo "== FIM_COM_ERRO =="
  fi
} 2>&1 | tee /Users/kramires/migracao_assistente_v2.log

echo ""
read -p "Pressione Enter para fechar..."
