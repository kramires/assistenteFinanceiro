#!/bin/bash
# Duplo clique para aplicar a correção da fatura VISA (rebuild + dados)
cd "$(dirname "$0")"

{
  echo "== $(date '+%d/%m/%Y %H:%M:%S') =="
  echo "== 1/3 Rebuild financas-api e ia-api =="
  OK=0
  for tentativa in 1 2 3; do
    echo "-- tentativa $tentativa --"
    docker compose --env-file financas.env up -d --build financas-api ia-api && { OK=1; break; }
    echo "Build falhou (provável falha de rede no pip). Tentando de novo em 5s..."
    sleep 5
  done
  if [ $OK -ne 1 ]; then
    echo "ERRO: docker compose falhou 3 vezes. O Docker Desktop está aberto? Internet ok?"
    echo "== FIM_COM_ERRO =="
    exit 1
  fi

  echo ""
  echo "== 2/3 Aguardando API responder =="
  PRONTA=0
  for i in $(seq 1 45); do
    CODE=$(curl -s -o /dev/null -w "%{http_code}" --max-time 2 http://localhost:18001/api/auth/me)
    if [ "$CODE" = "401" ] || [ "$CODE" = "403" ] || [ "$CODE" = "200" ]; then
      PRONTA=1
      break
    fi
    sleep 2
  done
  if [ $PRONTA -ne 1 ]; then
    echo "ERRO: API não respondeu em 90s."
    echo "== FIM_COM_ERRO =="
    exit 1
  fi
  echo "API pronta."

  echo ""
  echo "== 3/3 Corrigindo fatura VISA 2026-06 =="
  python3 corrigir_fatura_visa.py
  RC=$?

  echo ""
  if [ $RC -eq 0 ]; then
    echo "== FIM_OK =="
  else
    echo "== FIM_COM_ERRO (exit $RC) =="
  fi
} 2>&1 | tee correcao_resultado.log

echo ""
read -p "Pressione Enter para fechar..."
