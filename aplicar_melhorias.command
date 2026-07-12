#!/bin/bash
# Duplo clique: aplica melhorias de segurança (bind localhost, rate limit, validação de import)
cd "$(dirname "$0")"

{
  echo "== $(date '+%d/%m/%Y %H:%M:%S') =="

  echo "== 1/4 Rebuild financas-api =="
  OK=0
  for tentativa in 1 2 3; do
    echo "-- tentativa $tentativa --"
    docker compose --env-file financas.env up -d --build financas-api && { OK=1; break; }
    sleep 5
  done
  [ $OK -ne 1 ] && { echo "== FIM_COM_ERRO (build) =="; exit 1; }

  echo ""
  echo "== 2/4 Recriando nginx e aplicando bind localhost =="
  docker compose --env-file financas.env up -d --force-recreate nginx financas-api || { echo "== FIM_COM_ERRO (recreate) =="; exit 1; }
  sleep 5

  echo ""
  echo "== 3/4 Verificando bind da porta 18001 =="
  docker compose ps financas-api | grep -o "127.0.0.1:18001[^ ]*" && echo "  bind localhost: OK" || echo "  AVISO: bind 127.0.0.1 não confirmado"

  echo ""
  echo "== 4/4 Testando rate limit do login (espera 429 após ~8 tentativas) =="
  CODES=""
  for i in $(seq 1 9); do
    C=$(curl -s -o /dev/null -w "%{http_code}" --max-time 5 \
      -X POST http://localhost:8765/api/auth/login \
      -H "Content-Type: application/json" \
      -d '{"username":"teste_rate_limit","password":"senha_errada"}')
    CODES="$CODES $C"
  done
  echo "  códigos:$CODES"
  if echo "$CODES" | grep -q "429"; then
    echo "  rate limit: OK"
  else
    echo "  rate limit: FALHOU (nenhum 429)"
    echo "== FIM_COM_ERRO =="
    exit 1
  fi

  # Regressão: API ainda responde no localhost
  C=$(curl -s -o /dev/null -w "%{http_code}" --max-time 5 http://127.0.0.1:18001/api/auth/me)
  echo "  API via 127.0.0.1:18001 -> HTTP $C (esperado 403/401)"

  echo ""
  echo "== FIM_OK =="
} 2>&1 | tee melhorias_resultado.log

echo ""
read -p "Pressione Enter para fechar..."
