#!/bin/bash
# Duplo clique: valida a chave DeepSeek, faz rebuild do ia-api e testa o fluxo com fallback
cd "$(dirname "$0")"

DS_KEY=$(grep -E "^DEEPSEEK_API_KEY=" financas.env | cut -d= -f2)

{
  echo "== $(date '+%d/%m/%Y %H:%M:%S') =="

  echo "== 1/3 Validando chave e modelos DeepSeek =="
  for MODELO in deepseek-v4-flash deepseek-v4-pro; do
    RESP=$(curl -s --max-time 60 https://api.deepseek.com/v1/chat/completions \
      -H "Content-Type: application/json" \
      -H "Authorization: Bearer $DS_KEY" \
      -d "{\"model\":\"$MODELO\",\"messages\":[{\"role\":\"user\",\"content\":\"Responda apenas com JSON: {\\\"ok\\\": true}\"}],\"response_format\":{\"type\":\"json_object\"},\"max_tokens\":20}")
    if echo "$RESP" | grep -q '"content"'; then
      echo "  $MODELO: OK"
    else
      echo "  $MODELO: FALHOU -> $(echo "$RESP" | head -c 300)"
      echo "== FIM_COM_ERRO (chave ou modelo invalido) =="
      exit 1
    fi
  done

  echo ""
  echo "== 2/3 Rebuild ia-api =="
  OK=0
  for tentativa in 1 2 3; do
    echo "-- tentativa $tentativa --"
    docker compose --env-file financas.env up -d --build ia-api && { OK=1; break; }
    echo "Build falhou. Tentando de novo em 5s..."
    sleep 5
  done
  if [ $OK -ne 1 ]; then
    echo "== FIM_COM_ERRO (build) =="
    exit 1
  fi
  sleep 5

  echo ""
  echo "== 3/3 Teste dentro do container (DeepSeek principal + fallback OpenAI) =="
  docker compose --env-file financas.env exec -T ia-api python - <<'PYEOF'
import asyncio
from app.clients.openai_client import chat_completion
from app.config import settings

print(f"principal: {settings.deepseek_model} / {settings.deepseek_model_mini}")
print(f"fallback : {settings.openai_model} / {settings.openai_model_mini}")
r = asyncio.run(chat_completion(
    [{"role": "user", "content": 'Responda apenas com JSON: {"ok": true}'}],
    model=settings.openai_model_mini,
))
print("resposta:", r[:120])
assert "ok" in r.lower(), "resposta inesperada"
print("TESTE_OK")
PYEOF
  RC=$?

  echo ""
  if [ $RC -eq 0 ]; then
    echo "== FIM_OK =="
  else
    echo "== FIM_COM_ERRO (teste no container, exit $RC) =="
  fi
} 2>&1 | tee atualizacao_ia_resultado.log

echo ""
read -p "Pressione Enter para fechar..."
