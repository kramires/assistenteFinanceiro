#!/bin/bash
# Duplo clique para derrubar o Assistente Financeiro

cd "$(dirname "$0")"

# ── Cores ─────────────────────────────────────────────────────────────────────
YELLOW='\033[1;33m'
RED='\033[0;31m'
GREEN='\033[0;32m'
BOLD='\033[1m'
NC='\033[0m'

echo ""
echo -e "${BOLD}╔══════════════════════════════════════╗${NC}"
echo -e "${BOLD}║      Assistente Financeiro           ║${NC}"
echo -e "${BOLD}╚══════════════════════════════════════╝${NC}"
echo ""

echo -e "${YELLOW}▶ Derrubando serviços...${NC}"
docker compose --env-file financas.env down

echo ""
echo -e "${GREEN}${BOLD}✓ Sistema encerrado.${NC}"
echo ""
echo -e "  Os dados do PostgreSQL ficam preservados no volume ${BOLD}postgres_data${NC}."
echo -e "  Para apagar tudo: ${RED}docker compose --env-file financas.env down -v${NC}"
echo ""
read -p "Pressione Enter para fechar..."
