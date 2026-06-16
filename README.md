# Assistente Financeiro

Aplicação web de finanças pessoais com IA integrada. Controle de transações, orçamentos, importação de extratos bancários, cartões de crédito e análise inteligente por texto, voz ou foto.

## Funcionalidades

- **Autenticação JWT** — login seguro com token de longa duração
- **Perfil** — troca de senha pelo próprio usuário na interface
- **Transações** — cadastro manual, edição e exclusão com categorização automática
- **Categorias e Orçamentos** — limites mensais por categoria com alertas em 80%
- **Dashboard** — resumo do mês, gastos por categoria, evolução mensal, resumo anual com saldo acumulado
- **Transporte App** — rastreamento separado de gastos com aplicativos de transporte (Uber, 99 etc.)
- **Importação de Extrato** — upload de CSV bancário com deduplicação automática e categorização via IA
- **Cartões de Crédito** — importe faturas Nubank (CSV) e Banco do Brasil (PDF); acompanhe parcelas futuras; dashboard por categoria e cartão; pagamento de fatura registra automaticamente no extrato principal
- **Lançamento por Texto** — descreva a transação em linguagem natural e a IA estrutura automaticamente
- **Lançamento por Voz** — fale a transação pelo microfone; Whisper transcreve e a IA lança automaticamente
- **Lançamento por Nota** — envie foto ou imagem de uma nota fiscal para extração via IA
- **Resumo Narrativo** — relatório mensal gerado por IA em linguagem natural
- **Bot Discord** — lance transações por texto, voz ou foto direto de um canal Discord

## Arquitetura

```
┌─────────────────────────────────────────────────────────┐
│                    Browser / Cliente                    │
└─────────────────────┬───────────────────────────────────┘
                      │ HTTP (porta 8765 local / 443 prod)
┌─────────────────────▼───────────────────────────────────┐
│              Nginx (porta 8765 local)                   │
│   /           → React SPA (build estático)             │
│   /api/*      → financas-api:8001                      │
│   /ia/*       → ia-api:8002                            │
└──────────┬──────────────────────┬───────────────────────┘
           │                      │
┌──────────▼──────────┐  ┌───────▼────────────────────────┐
│   financas-api      │  │          ia-api                │
│   FastAPI + JWT     │  │   FastAPI + OpenAI/DeepSeek   │
│   Porta 8001        │  │   Porta 8002 (sem auth)        │
│                     │  │                                │
│  • Auth + Perfil    │  │  • /ia/categorizar             │
│  • Transações       │  │  • /ia/lancar-texto            │
│  • Categorias       │  │  • /ia/lancar-audio (Whisper) │
│  • Orçamentos       │  │  • /ia/nota/upload             │
│  • Dashboard        │  │  • /ia/resumo-narrativo        │
│  • Transporte       │  │  • /ia/extrair-fatura          │
│  • Extrato          │  └────────────────────────────────┘
│  • Cartões/Faturas  │
│  • ia_proxy →───────┘ (proxia chamadas IA com JWT)
└──────────┬──────────┘
           │
┌──────────▼──────────┐
│  PostgreSQL 16      │
│  Porta 5432         │
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
| Infraestrutura | Docker Compose + Nginx |

## Pré-requisitos

- [Docker](https://docs.docker.com/get-docker/) + [Docker Compose](https://docs.docker.com/compose/)
- Node.js 18+ (apenas para desenvolvimento local do frontend)
- Python 3.12+ (apenas para o script de migração de dados)

## Iniciar / Parar

Duplo clique nos arquivos na pasta do projeto:

| Arquivo | Ação |
|---------|------|
| `start.command` | Sobe todos os serviços |
| `stop.command` | Derruba todos os serviços |

> **Primeira vez no macOS:** clique direito → Abrir para passar pelo aviso de segurança. Nas próximas vezes o duplo clique funciona normalmente.

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

### 2. Build do frontend

```bash
cd frontend
npm install
npm run build
cd ..
```

### 3. Subir os serviços

```bash
docker compose --env-file financas.env up -d
```

O `financas-api` roda `alembic upgrade head` automaticamente ao iniciar. Na primeira vez, as tabelas e o usuário admin são criados.

### 4. Acessar

| URL | O que é |
|-----|---------|
| `http://localhost:8765` | Aplicação web |
| `http://localhost:18001/docs` | Swagger da financas-api |
| `http://localhost:18002/docs` | Swagger da ia-api |

> As portas padrão foram escolhidas para não conflitar com serviços comuns. Você pode alterá-las em `financas.env` (ver variáveis de porta abaixo).

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
3. Descomente o bloco HTTPS em `nginx/nginx.conf` e substitua `SEU_DOMINIO.com`
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
│   │   ├── auth/          # JWT login + troca de senha
│   │   ├── categorias/    # CRUD de categorias
│   │   ├── transacoes/    # CRUD de transações
│   │   ├── orcamentos/    # Orçamentos mensais (upsert)
│   │   ├── dashboard/     # Agregações e resumos
│   │   ├── transporte/    # Rastreamento de apps de transporte
│   │   ├── extrato/       # Importação de CSV bancário
│   │   ├── cartoes/       # CRUD de cartões de crédito
│   │   ├── faturas/       # Faturas: importar, pagar, parcelas, dashboard
│   │   ├── ia_proxy/      # Proxy autenticado para ia-api
│   │   └── domain/        # Regras de negócio (frozensets de categorias)
│   ├── alembic/           # Migrations do banco
│   ├── Dockerfile
│   └── requirements.txt
│
├── ia-api/                # Microserviço de IA
│   ├── app/
│   │   ├── categorizar/        # Categorização de transações
│   │   ├── lancar_texto/       # Lançamento por linguagem natural
│   │   ├── lancar_audio/       # Lançamento por voz (Whisper-1)
│   │   ├── nota/               # Extração de nota fiscal por imagem
│   │   ├── resumo_narrativo/   # Relatório mensal narrativo
│   │   └── extrair_fatura/     # Extração de fatura PDF via GPT
│   ├── Dockerfile
│   └── requirements.txt
│
├── frontend/              # React SPA
│   └── src/
│       ├── auth/          # Tela de login
│       ├── components/    # Dashboard, Transações, Cartões, Orçamentos etc.
│       ├── hooks/         # useAsyncState
│       ├── api.ts         # apiFetch com JWT automático
│       └── config.ts      # BASE URLs
│
├── nginx/
│   └── nginx.conf         # Reverse proxy (HTTP local / HTTPS prod)
│
├── discord-bot/           # Bot Discord
│   ├── bot.py             # Texto, voz e imagem → endpoints da API
│   ├── Dockerfile
│   └── requirements.txt
│
├── scripts/
│   └── migrate_db.py      # Migração SQLite → PostgreSQL
│
├── start.command          # Duplo clique para subir os serviços (macOS)
├── stop.command           # Duplo clique para derrubar os serviços (macOS)
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

# Portas expostas no host (altere se conflitar com outros serviços)
HTTP_PORT=8765       # App web: http://localhost:8765
HTTPS_PORT=4443      # HTTPS (prod com cert)
FINANCAS_API_PORT=18001   # Swagger: http://localhost:18001/docs
IA_API_PORT=18002    # Swagger IA: http://localhost:18002/docs
```

## Bot Discord

O bot aceita comandos no canal configurado, bloqueado por user ID. Suporta três modos:

| Tipo de mensagem | O que faz |
|-----------------|-----------|
| Texto livre | Lança via IA (GPT-4.1) |
| Mensagem de voz / arquivo de áudio | Transcreve com Whisper e lança |
| Foto / imagem de nota fiscal | Extrai dados com visão e lança |
| `!ajuda` | Exibe instruções |

### Configuração

1. Acesse [discord.com/developers/applications](https://discord.com/developers/applications) e crie uma **New Application**
2. Em **Bot**: crie o bot, copie o token e ative **Message Content Intent**
3. Em **OAuth2 → URL Generator**: marque `bot` + permissões `Send Messages` e `Read Message History`
4. Use a URL gerada para adicionar o bot ao seu servidor
5. Cole o token em `financas.env`:

```env
DISCORD_BOT_TOKEN=seu_token_aqui
DISCORD_ALLOWED_USER_ID=seu_discord_user_id
DISCORD_CHANNEL_ID=id_do_canal
```

6. Suba (ou reinicie) com:

```bash
docker compose --env-file financas.env up -d discord-bot
```

> O bot autentica automaticamente na API com as credenciais `ADMIN_USERNAME`/`ADMIN_PASSWORD` e renova o JWT quando necessário.

## Cartões de Crédito

### Importar fatura

- **Nubank CSV**: exporte pelo app → aba Cartões → selecione o cartão → importar CSV
- **Banco do Brasil PDF**: exporte o PDF da fatura pelo Internet Banking → importar PDF
  - O PDF é processado pelo GPT via ia-api; certifique-se de que `OPENAI_API_KEY` está configurada

### Anti-dupla contagem

Os lançamentos de fatura (`lancamentos_fatura`) são **separados** do extrato principal. Apenas o pagamento da fatura (`PUT /api/faturas/{id}/pagar`) cria uma transação no extrato principal. Isso garante que compras parceladas no cartão não sejam contadas duas vezes.

### Parcelas futuras

A aba "Parcelas Futuras" projeta automaticamente os próximos 6 meses com base nas faturas importadas, deduplicando compras parceladas quando múltiplos meses da mesma fatura são importados.

## Segurança

- **Nunca commite** `financas.env` — está no `.gitignore`
- Gere `JWT_SECRET_KEY` com `openssl rand -hex 32`
- Em produção, use senhas fortes e um usuário PostgreSQL dedicado
- O `ia-api` não expõe portas ao exterior no `docker-compose.yml` — só acessível via proxy interno
- Troca de senha disponível em **Perfil** (botão no cabeçalho da aplicação)

## Licença

MIT
