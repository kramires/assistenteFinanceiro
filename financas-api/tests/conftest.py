import os

# Settings exige estas variáveis no import; os testes não acessam banco nem IA.
os.environ.setdefault("DATABASE_URL", "postgresql+asyncpg://teste:teste@localhost:5432/teste")
os.environ.setdefault("JWT_SECRET_KEY", "chave-de-teste")
os.environ.setdefault("ADMIN_PASSWORD", "senha-de-teste")
