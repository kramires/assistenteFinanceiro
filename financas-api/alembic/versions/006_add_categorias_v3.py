"""add categorias seguros e juros

Revision ID: 006
Revises: 005
Create Date: 2026-06-19
"""

from alembic import op

revision = "006"
down_revision = "005"
branch_labels = None
depends_on = None

_NOVAS = [
    ("Seguros",   "despesa"),
    ("Juros/IOF", "despesa"),
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
