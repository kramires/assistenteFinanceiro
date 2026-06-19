#!/bin/bash
# Duplo clique para iniciar o Assistente Financeiro

cd "$(dirname "$0")"

# ── Cores ─────────────────────────────────────────────────────────────────────
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
RED='\033[0;31m'
BOLD='\033[1m'
NC='\033[0m'

echo ""
echo -e "${BOLD}╔══════════════════════════════════════╗${NC}"
echo -e "${BOLD}║      Assistente Financeiro           ║${NC}"
echo -e "${BOLD}╚══════════════════════════════════════╝${NC}"
echo ""

# ── Verificar financas.env ────────────────────────────────────────────────────
if [ ! -f "financas.env" ]; then
  echo -e "${RED}✗ financas.env não encontrado.${NC}"
  echo -e "  Copie o exemplo e preencha as variáveis:"
  echo -e "  ${CYAN}cp .env.example financas.env${NC}"
  read -p "Pressione Enter para fechar..."
  exit 1
fi

# ── Ler portas do financas.env (com fallback para os padrões) ─────────────────
HTTP_PORT=$(grep -E "^HTTP_PORT=" financas.env | cut -d= -f2)
FINANCAS_API_PORT=$(grep -E "^FINANCAS_API_PORT=" financas.env | cut -d= -f2)
HTTP_PORT=${HTTP_PORT:-8765}
FINANCAS_API_PORT=${FINANCAS_API_PORT:-18001}

# ── Subir serviços Docker ─────────────────────────────────────────────────────
echo -e "${YELLOW}▶ Subindo serviços...${NC}"
docker compose --env-file financas.env up -d

# ── Aguardar API ficar pronta ─────────────────────────────────────────────────
echo ""
echo -e "${YELLOW}▶ Aguardando financas-api...${NC}"
for i in $(seq 1 20); do
  if curl -s "http://localhost:${FINANCAS_API_PORT}/health" | grep -q "ok" 2>/dev/null; then
    break
  fi
  sleep 2
done

# ── Status dos containers ─────────────────────────────────────────────────────
echo ""
echo -e "${BOLD}Status dos serviços:${NC}"
docker compose --env-file financas.env ps --format "table {{.Name}}\t{{.Status}}\t{{.Ports}}" 2>/dev/null || \
  docker compose --env-file financas.env ps

# ── URLs ──────────────────────────────────────────────────────────────────────
echo ""
echo -e "${GREEN}${BOLD}✓ Sistema no ar!${NC}"
echo ""
echo -e "  ${CYAN}Web app   →${NC}  http://localhost:${HTTP_PORT}"
echo -e "  ${CYAN}API docs  →${NC}  http://localhost:${FINANCAS_API_PORT}/docs"
echo ""
read -p "Pressione Enter para fechar..."
