# Assistente Financeiro

Aplicação web de finanças pessoais com IA integrada. Controle de transações, orçamentos, importação de extratos bancários e análise inteligente por texto ou foto.

## Funcionalidades

- **Autenticação JWT** — login seguro com token de longa duração
- **Transações** — cadastro manual, edição e exclusão com categorização automática
- **Categorias e Orçamentos** — limites mensais por categoria com alertas em 80%
- **Dashboard** — resumo do mês, gastos por categoria, evolução mensal, resumo anual com saldo acumulado
- **Transporte App** — rastreamento separado de gastos com aplicativos de transporte (Uber, 99 etc.)
- **Importação de Extrato** — upload de CSV bancário com deduplicação automática e categorização via IA
- **Lançamento por Texto** — descreva a transação em linguagem natural e a IA estrutura automaticamente
- **Lançamento por Nota** — envie foto ou imagem de uma nota fiscal para extração via IA
- **Resumo Narrativo** — relatório mensal gerado por IA em linguagem natural

## Arquitetura

```
┌─────────────────────────────────────────────────────────┐
│                    Browser / Cliente                    │
└─────────────────────┬───────────────────────────────────┘
                      │ HTTPS
┌─────────────────────▼───────────────────────────────────┐
│                  Nginx (porta 80/443)                   │
│   /           → React SPA (build estático)             │
│   /api/*      → financas-api:8001                      │
│   /ia/*       → ia-api:8002                            │
└──────────┬──────────────────────┬───────────────────────┘
           │                      │
┌──────────▼──────────┐  ┌───────▼────────────────────────┐
│   financas-api      │  │          ia-api                │
│   FastAPI + JWT     │  │   FastAPI + OpenAI/DeepSeek   │
│   Porto 8001        │  │   Porto 8002 (sem auth)        │
│                     │  │                                │
│  • Auth             │  │  • /ia/categorizar             │
│  • Transações       │  │  • /ia/lancar-texto            │
│  • Categorias       │  │  • /ia/nota/upload             │
│  • Orçamentos       │  │  • /ia/resumo-narrativo        │
│  • Dashboard        │  └────────────────────────────────┘
│  • Transporte       │
│  • Extrato          │
│  • ia_proxy →───────┘ (proxia chamadas IA com JWT)
└──────────┬──────────┘
           │
┌──────────▼──────────┐
│  PostgreSQL 16      │
│  Porto 5432         │
└─────────────────────┘
```

> **ia-api não tem autenticação própria** — o `financas-api` atua como proxy para todas as chamadas de IA vindas do browser, garantindo que o JWT seja validado antes de consumir tokens OpenAI.

## Stack

| Camada | Tecnologia |
|--------|-----------|
| Frontend | React 18 + TypeScript + Recharts |
| Backend principal | FastAPI 0.116 + SQLAlchemy 2 async + Alembic |
| Microserviço IA | FastAPI + OpenAI SDK (GPT-4.1 / GPT-4.1-mini) |
| Banco de dados | PostgreSQL 16 |
| Autenticação | JWT (python-jose + passlib bcrypt) |
| Infraestrutura | Docker Compose + Nginx + Let's Encrypt |

## Pré-requisitos

- [Docker](https://docs.docker.com/get-docker/) + [Docker Compose](https://docs.docker.com/compose/)
- Node.js 18+ (apenas para desenvolvimento local do frontend)
- Python 3.12+ (apenas para o script de migração de dados)

## Início Rápido

### 1. Variáveis de ambiente

Copie o exemplo e preencha os valores:

```bash
cp .env.example financas.env
```

Edite `financas.env` com suas credenciais reais. Os campos obrigatórios são:

| Variável | Descrição |
|----------|-----------|
| `POSTGRES_USER` / `POSTGRES_PASSWORD` | Credenciais do banco |
| `DATABASE_URL` | URL de conexão (já montada com as vars acima) |
| `JWT_SECRET_KEY` | Chave secreta — gere com `openssl rand -hex 32` |
| `ADMIN_USERNAME` / `ADMIN_PASSWORD` | Usuário criado automaticamente na primeira migração |
| `OPENAI_API_KEY` | Chave da OpenAI (funcionalidades de IA) |

### 2. Subir os serviços

```bash
docker compose --env-file financas.env up -d
```

O `financas-api` roda `alembic upgrade head` automaticamente ao iniciar. Na primeira vez, as tabelas e o usuário admin são criados.

### 3. Build do frontend (produção)

```bash
cd frontend
npm install
npm run build
```

O Nginx serve o build em `frontend/build/` automaticamente.

### 4. Acessar

- **Local (dev):** `http://localhost` (Nginx) ou `http://localhost:3000` (React dev server)
- **API docs:** `http://localhost:8001/docs`

## Desenvolvimento Local

Para iterar no frontend sem rebuild Docker:

```bash
# Terminal 1 — sobe banco + APIs
docker compose --env-file financas.env up -d postgres financas-api ia-api

# Terminal 2 — frontend com hot reload
cd frontend
npm install
npm start
```

O `setupProxy.js` já redireciona `/api` → porta 8001 e `/ia` → porta 8002.

## Implantação em VPS

### Nginx com HTTPS (Let's Encrypt)

1. Aponte seu domínio para o IP do VPS
2. Configure `ALLOWED_ORIGINS` em `financas.env` com `https://seudominio.com`
3. Edite `nginx/nginx.conf` — substitua `${DOMAIN}` pelo seu domínio
4. Obtenha o certificado:

```bash
docker run --rm -v certbot_conf:/etc/letsencrypt -v certbot_www:/var/www/certbot \
  certbot/certbot certonly --webroot -w /var/www/certbot \
  -d seudominio.com --email seu@email.com --agree-tos
```

5. Suba tudo:

```bash
docker compose --env-file financas.env up -d
```

### Renovação automática do certificado

```bash
# Adicione ao crontab
0 3 * * * docker run --rm -v certbot_conf:/etc/letsencrypt -v certbot_www:/var/www/certbot \
  certbot/certbot renew --quiet && docker compose exec nginx nginx -s reload
```

## Migração de Dados (SQLite → PostgreSQL)

Se você possui um banco SQLite legado, use o script de migração:

```bash
pip install psycopg2-binary
python scripts/migrate_db.py \
  --sqlite financas.db \
  --pg "postgresql://financas_user:senha@localhost:5432/financas"
```

Flags disponíveis:
- `--dry-run` — simula a migração sem escrever no banco
- A migração é **idempotente** — pode ser reexecutada sem duplicar dados

## Estrutura do Projeto

```
.
├── financas-api/          # Backend principal (CRUD + JWT + dashboard)
│   ├── app/
│   │   ├── auth/          # JWT login
│   │   ├── categorias/    # CRUD de categorias
│   │   ├── transacoes/    # CRUD de transações
│   │   ├── orcamentos/    # Orçamentos mensais (upsert)
│   │   ├── dashboard/     # Agregações e resumos
│   │   ├── transporte/    # Rastreamento de apps de transporte
│   │   ├── extrato/       # Importação de CSV bancário
│   │   ├── ia_proxy/      # Proxy autenticado para ia-api
│   │   └── domain/        # Regras de negócio (frozensets de categorias)
│   ├── alembic/           # Migrations do banco
│   ├── Dockerfile
│   └── requirements.txt
│
├── ia-api/                # Microserviço de IA
│   ├── app/
│   │   ├── categorizar/   # Categorização de transações
│   │   ├── lancar_texto/  # Lançamento por linguagem natural
│   │   ├── nota/          # Extração de nota fiscal por imagem
│   │   ├── lancar_audio/  # Lançamento por áudio
│   │   └── resumo_narrativo/ # Relatório mensal narrativo
│   ├── Dockerfile
│   └── requirements.txt
│
├── frontend/              # React SPA
│   └── src/
│       ├── auth/          # Tela de login
│       ├── components/    # Dashboard, Transações, Orçamentos etc.
│       ├── hooks/         # useAsyncState
│       ├── api.ts         # apiFetch com JWT automático
│       └── config.ts      # BASE URLs
│
├── nginx/
│   └── nginx.conf         # Reverse proxy + SSL
│
├── scripts/
│   └── migrate_db.py      # Migração SQLite → PostgreSQL
│
├── docker-compose.yml
└── .env.example
```

## Variáveis de Ambiente (referência completa)

```env
# Banco de dados
POSTGRES_USER=financas_user
POSTGRES_PASSWORD=senha_forte_aqui
DATABASE_URL=postgresql+asyncpg://financas_user:senha_forte_aqui@postgres:5432/financas

# JWT
JWT_SECRET_KEY=         # openssl rand -hex 32
JWT_ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=10080  # 7 dias

# Usuário admin (seed automático)
ADMIN_USERNAME=seu_usuario
ADMIN_PASSWORD=senha_forte_aqui

# OpenAI
OPENAI_API_KEY=sk-...
OPENAI_MODEL=gpt-4.1
OPENAI_MODEL_MINI=gpt-4.1-mini

# DeepSeek (fallback de IA — opcional)
DEEPSEEK_API_KEY=sk-...
DEEPSEEK_BASE_URL=https://api.deepseek.com/v1

# CORS
ALLOWED_ORIGINS=https://seudominio.com,http://localhost:3000

# URL interna da ia-api (Docker network)
IA_API_URL=http://ia-api:8002
```

## Segurança

- **Nunca commite** `financas.env` — está no `.gitignore`
- Gere `JWT_SECRET_KEY` com `openssl rand -hex 32`
- Em produção, use senhas fortes e um usuário PostgreSQL dedicado
- O `ia-api` não expõe portas ao exterior no `docker-compose.yml` — só acessível via proxy interno

## Licença

MIT
