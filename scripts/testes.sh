#!/bin/bash
# Roda os testes da financas-api dentro da imagem Docker (mesmas dependências da produção).
set -euo pipefail
cd "$(dirname "$0")/.."
docker compose --env-file financas.env run --rm --no-deps \
  -v "$PWD/financas-api:/src" -w /src --entrypoint sh financas-api \
  -c "pip install -q --disable-pip-version-check pytest==8.3.3 pytest-asyncio==0.24.0 2>/dev/null; python -m pytest -q -p no:cacheprovider $*"
