from datetime import date
from decimal import Decimal

from sqlalchemy import Boolean, Date, ForeignKey, Numeric, String
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class Transacao(Base):
    __tablename__ = "transacoes"

    id: Mapped[int] = mapped_column(primary_key=True)
    data: Mapped[date] = mapped_column(Date)
    descricao: Mapped[str] = mapped_column(String(255))
    valor: Mapped[Decimal] = mapped_column(Numeric(12, 2))
    categoria_id: Mapped[int | None] = mapped_column(
        ForeignKey("categorias.id", ondelete="RESTRICT"), nullable=True
    )
    contabilizar_dashboard: Mapped[bool] = mapped_column(Boolean, default=True)
    origem: Mapped[str | None] = mapped_column(String(100), nullable=True)
    destino: Mapped[str | None] = mapped_column(String(100), nullable=True)
