"""add cartoes e faturas

Revision ID: 002
Revises: 001
Create Date: 2026-06-15
"""

from alembic import op

revision = "002"
down_revision = "001"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute("""
        CREATE TABLE cartoes (
            id           SERIAL PRIMARY KEY,
            nome         VARCHAR(100)   NOT NULL,
            bandeira     VARCHAR(50),
            final_numero VARCHAR(4),
            limite       NUMERIC(12, 2),
            cor          VARCHAR(7)     NOT NULL DEFAULT '#6C63FF',
            created_at   TIMESTAMPTZ    NOT NULL DEFAULT NOW()
        )
    """)

    op.execute("""
        CREATE TABLE faturas_cartao (
            id                      SERIAL PRIMARY KEY,
            cartao_id               INTEGER        NOT NULL REFERENCES cartoes(id) ON DELETE CASCADE,
            mes_referencia          VARCHAR(7)     NOT NULL,
            data_fechamento         DATE,
            data_vencimento         DATE,
            valor_total             NUMERIC(12, 2) NOT NULL DEFAULT 0,
            status                  VARCHAR(20)    NOT NULL DEFAULT 'aberta'
                                        CHECK (status IN ('aberta', 'paga')),
            transacao_pagamento_id  INTEGER        REFERENCES transacoes(id) ON DELETE SET NULL,
            saldo_parcelado         NUMERIC(12, 2) NOT NULL DEFAULT 0,
            created_at              TIMESTAMPTZ    NOT NULL DEFAULT NOW(),
            UNIQUE (cartao_id, mes_referencia)
        )
    """)

    op.execute("""
        CREATE TABLE lancamentos_fatura (
            id              SERIAL PRIMARY KEY,
            fatura_id       INTEGER        NOT NULL REFERENCES faturas_cartao(id) ON DELETE CASCADE,
            data            DATE           NOT NULL,
            descricao       VARCHAR(255)   NOT NULL,
            valor           NUMERIC(12, 2) NOT NULL,
            categoria_id    INTEGER        REFERENCES categorias(id) ON DELETE SET NULL,
            parcela_atual   SMALLINT,
            total_parcelas  SMALLINT,
            created_at      TIMESTAMPTZ    NOT NULL DEFAULT NOW()
        )
    """)

    op.execute("CREATE INDEX idx_faturas_cartao_mes ON faturas_cartao(cartao_id, mes_referencia)")
    op.execute("CREATE INDEX idx_lancamentos_fatura_fatura ON lancamentos_fatura(fatura_id)")
    op.execute("CREATE INDEX idx_lancamentos_fatura_parcelas ON lancamentos_fatura(parcela_atual, total_parcelas) WHERE parcela_atual IS NOT NULL")


def downgrade() -> None:
    op.execute("DROP TABLE IF EXISTS lancamentos_fatura")
    op.execute("DROP TABLE IF EXISTS faturas_cartao")
    op.execute("DROP TABLE IF EXISTS cartoes")
