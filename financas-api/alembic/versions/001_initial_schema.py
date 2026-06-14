"""initial schema

Revision ID: 001
Revises:
Create Date: 2026-06-14
"""

import os

from alembic import op
from passlib.context import CryptContext

revision = "001"
down_revision = None
branch_labels = None
depends_on = None

_pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


def upgrade() -> None:
    # ── tabelas ──────────────────────────────────────────────────────────────
    op.execute("""
        CREATE TABLE usuarios (
            id              SERIAL PRIMARY KEY,
            username        VARCHAR(50)  NOT NULL UNIQUE,
            hashed_password VARCHAR(255) NOT NULL,
            is_active       BOOLEAN      NOT NULL DEFAULT TRUE,
            created_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW()
        )
    """)

    op.execute("""
        CREATE TABLE categorias (
            id   SERIAL PRIMARY KEY,
            nome VARCHAR(100) NOT NULL UNIQUE,
            tipo VARCHAR(20)  NOT NULL CHECK (tipo IN ('despesa', 'rendimento'))
        )
    """)

    op.execute("""
        CREATE TABLE transacoes (
            id                     SERIAL PRIMARY KEY,
            data                   DATE           NOT NULL,
            descricao              VARCHAR(255)   NOT NULL,
            valor                  NUMERIC(12, 2) NOT NULL,
            categoria_id           INTEGER        REFERENCES categorias(id) ON DELETE RESTRICT,
            contabilizar_dashboard BOOLEAN        NOT NULL DEFAULT TRUE,
            origem                 VARCHAR(100),
            destino                VARCHAR(100),
            created_at             TIMESTAMPTZ    NOT NULL DEFAULT NOW()
        )
    """)

    op.execute("""
        CREATE TABLE orcamentos (
            id           SERIAL PRIMARY KEY,
            categoria_id INTEGER        REFERENCES categorias(id) ON DELETE CASCADE,
            ano          SMALLINT       NOT NULL CHECK (ano >= 2000 AND ano <= 2100),
            mes          SMALLINT       NOT NULL CHECK (mes >= 1 AND mes <= 12),
            valor_limite NUMERIC(12, 2) NOT NULL CHECK (valor_limite > 0),
            created_at   TIMESTAMPTZ    NOT NULL DEFAULT NOW(),
            updated_at   TIMESTAMPTZ    NOT NULL DEFAULT NOW(),
            UNIQUE (categoria_id, ano, mes)
        )
    """)

    # ── índices ───────────────────────────────────────────────────────────────
    op.execute("CREATE INDEX idx_transacoes_data ON transacoes(data)")
    op.execute("""
        CREATE INDEX idx_transacoes_data_ano_mes ON transacoes(
            EXTRACT(YEAR FROM data),
            EXTRACT(MONTH FROM data)
        )
    """)
    op.execute("""
        CREATE INDEX idx_transacoes_contabilizar ON transacoes(contabilizar_dashboard)
        WHERE contabilizar_dashboard = TRUE
    """)

    # ── trigger updated_at em orcamentos ─────────────────────────────────────
    op.execute("""
        CREATE OR REPLACE FUNCTION update_updated_at_column()
        RETURNS TRIGGER AS $$
        BEGIN
            NEW.updated_at = NOW();
            RETURN NEW;
        END;
        $$ LANGUAGE plpgsql
    """)
    op.execute("""
        CREATE TRIGGER orcamentos_updated_at
            BEFORE UPDATE ON orcamentos
            FOR EACH ROW EXECUTE FUNCTION update_updated_at_column()
    """)

    # ── seed: categorias ──────────────────────────────────────────────────────
    op.execute("""
        INSERT INTO categorias (nome, tipo) VALUES
            ('Alimentação',           'despesa'),
            ('Supermercado',          'despesa'),
            ('Educação',              'despesa'),
            ('Transporte',            'despesa'),
            ('Transporte Alternativo','despesa'),
            ('Transporte Escolar',    'despesa'),
            ('Investimentos',         'despesa'),
            ('Moradia',               'despesa'),
            ('Streamings',            'despesa'),
            ('Cartão de Crédito',     'despesa'),
            ('Saúde',                 'despesa'),
            ('Beleza',                'despesa'),
            ('Lazer',                 'despesa'),
            ('Outros',                'despesa'),
            ('Boletos',               'despesa'),
            ('Salário',               'rendimento'),
            ('Dividendos',            'rendimento')
        ON CONFLICT (nome) DO NOTHING
    """)

    # ── seed: usuário admin ───────────────────────────────────────────────────
    admin_username = os.environ.get("ADMIN_USERNAME", "klayton")
    admin_password = os.environ.get("ADMIN_PASSWORD", "")
    if not admin_password:
        raise RuntimeError("ADMIN_PASSWORD não definida — defina no .env antes de rodar a migration")

    hashed = _pwd_context.hash(admin_password)
    op.execute(
        f"INSERT INTO usuarios (username, hashed_password) VALUES ('{admin_username}', '{hashed}') "
        "ON CONFLICT (username) DO NOTHING"
    )


def downgrade() -> None:
    op.execute("DROP TRIGGER IF EXISTS orcamentos_updated_at ON orcamentos")
    op.execute("DROP FUNCTION IF EXISTS update_updated_at_column")
    op.execute("DROP TABLE IF EXISTS orcamentos")
    op.execute("DROP TABLE IF EXISTS transacoes")
    op.execute("DROP TABLE IF EXISTS categorias")
    op.execute("DROP TABLE IF EXISTS usuarios")
