from decimal import Decimal

from sqlalchemy import ForeignKey, Numeric, SmallInteger, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class Orcamento(Base):
    __tablename__ = "orcamentos"
    __table_args__ = (UniqueConstraint("categoria_id", "ano", "mes"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    categoria_id: Mapped[int] = mapped_column(
        ForeignKey("categorias.id", ondelete="CASCADE")
    )
    ano: Mapped[int] = mapped_column(SmallInteger)
    mes: Mapped[int] = mapped_column(SmallInteger)
    valor_limite: Mapped[Decimal] = mapped_column(Numeric(12, 2))
