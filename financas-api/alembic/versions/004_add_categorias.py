"""add novas categorias de gastos

Revision ID: 004
Revises: 003
Create Date: 2026-06-19
"""

from alembic import op

revision = "004"
down_revision = "003"
branch_labels = None
depends_on = None

_NOVAS = [
    ("Delivery",          "despesa"),
    ("Restaurante",       "despesa"),
    ("Farmácia",          "despesa"),
    ("Vestuário",         "despesa"),
    ("Academia",          "despesa"),
    ("Combustível",       "despesa"),
    ("Telefone/Internet", "despesa"),
]


def upgrade() -> None:
    for nome, tipo in _NOVAS:
        op.execute(
            f"INSERT INTO categorias (nome, tipo) VALUES ('{nome}', '{tipo}') "
            "ON CONFLICT (nome) DO NOTHING"
        )


def downgrade() -> None:
    for nome, _ in _NOVAS:
        op.execute(f"DELETE FROM categorias WHERE nome = '{nome}'")
