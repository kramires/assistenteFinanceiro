from decimal import Decimal

from sqlalchemy import Numeric, String
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class CartaoCredito(Base):
    __tablename__ = "cartoes"

    id: Mapped[int] = mapped_column(primary_key=True)
    nome: Mapped[str] = mapped_column(String(100))
    bandeira: Mapped[str | None] = mapped_column(String(50), nullable=True)
    final_numero: Mapped[str | None] = mapped_column(String(4), nullable=True)
    limite: Mapped[Decimal | None] = mapped_column(Numeric(12, 2), nullable=True)
    cor: Mapped[str] = mapped_column(String(7), default="#6C63FF")
