#!/bin/bash
# Duplo clique: move o projeto para fora do iCloud (/Users/kramires) e limpa duplicatas de sync
ORIGEM="/Users/kramires/Documents/scripts/assistenteFinanceiro"
DESTINO="/Users/kramires/assistenteFinanceiro"

{
  echo "== $(date '+%d/%m/%Y %H:%M:%S') =="

  if [ ! -d "$ORIGEM" ]; then echo "ERRO: origem não existe ($ORIGEM)"; echo "== FIM_COM_ERRO =="; exit 1; fi
  if [ -e "$DESTINO" ]; then echo "ERRO: destino já existe ($DESTINO)"; echo "== FIM_COM_ERRO =="; exit 1; fi

  echo "== 1/5 Parando containers =="
  cd "$ORIGEM" && docker compose --env-file financas.env down

  echo ""
  echo "== 2/5 Removendo node_modules (será recriado com npm install quando precisar) =="
  rm -rf "$ORIGEM/frontend/node_modules"
  echo "  removido."

  echo ""
  echo "== 3/5 Limpando duplicatas de sync do iCloud (arquivos '* 2', '* 3') =="
  N=$(find "$ORIGEM" \( -name "* 2" -o -name "* 2.*" -o -name "* 3" -o -name "* 3.*" \) | wc -l | tr -d ' ')
  find "$ORIGEM" \( -name "* 2" -o -name "* 2.*" -o -name "* 3" -o -name "* 3.*" \) -delete
  echo "  $N duplicata(s) removida(s)."

  echo ""
  echo "== 4/5 Movendo projeto para $DESTINO =="
  cd /Users/kramires || exit 1
  mv "$ORIGEM" "$DESTINO" || { echo "ERRO ao mover"; echo "== FIM_COM_ERRO =="; exit 1; }
  echo "  movido."

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
    echo "== FIM_OK =="
  else
    echo "  API não respondeu em 90s — verifique com docker compose logs"
    echo "== FIM_COM_ERRO =="
  fi
} 2>&1 | tee /Users/kramires/migracao_assistente.log

echo ""
read -p "Pressione Enter para fechar..."
