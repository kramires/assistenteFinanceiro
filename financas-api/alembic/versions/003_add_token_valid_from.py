"""add token_valid_from to usuarios

Revision ID: 003
Revises: 002
Create Date: 2026-06-15
"""

from alembic import op

revision = "003"
down_revision = "002"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Tokens emitidos antes deste timestamp são rejeitados.
    # Atualizado no logout e na troca de senha.
    op.execute(
        "ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS "
        "token_valid_from TIMESTAMPTZ NOT NULL DEFAULT NOW()"
    )


def downgrade() -> None:
    op.execute("ALTER TABLE usuarios DROP COLUMN IF EXISTS token_valid_from")
