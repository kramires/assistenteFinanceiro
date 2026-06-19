"""add novas categorias (v2): compras online, pet, auto, viagem, pix

Revision ID: 005
Revises: 004
Create Date: 2026-06-19
"""

from alembic import op

revision = "005"
down_revision = "004"
branch_labels = None
depends_on = None

_NOVAS = [
    ("Compras Online",  "despesa"),
    ("Pet",             "despesa"),
    ("Auto/Manutenção", "despesa"),
    ("Viagem",          "despesa"),
    ("Pix/Transferência", "despesa"),
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
