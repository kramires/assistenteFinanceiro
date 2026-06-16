from datetime import date
from decimal import Decimal

from sqlalchemy import Date, ForeignKey, Numeric, SmallInteger, String
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class FaturaCartao(Base):
    __tablename__ = "faturas_cartao"

    id: Mapped[int] = mapped_column(primary_key=True)
    cartao_id: Mapped[int] = mapped_column(ForeignKey("cartoes.id", ondelete="CASCADE"))
    mes_referencia: Mapped[str] = mapped_column(String(7))
    data_fechamento: Mapped[date | None] = mapped_column(Date, nullable=True)
    data_vencimento: Mapped[date | None] = mapped_column(Date, nullable=True)
    valor_total: Mapped[Decimal] = mapped_column(Numeric(12, 2), default=0)
    status: Mapped[str] = mapped_column(String(20), default="aberta")
    transacao_pagamento_id: Mapped[int | None] = mapped_column(
        ForeignKey("transacoes.id", ondelete="SET NULL"), nullable=True
    )
    saldo_parcelado: Mapped[Decimal] = mapped_column(Numeric(12, 2), default=0)


class LancamentoFatura(Base):
    __tablename__ = "lancamentos_fatura"

    id: Mapped[int] = mapped_column(primary_key=True)
    fatura_id: Mapped[int] = mapped_column(ForeignKey("faturas_cartao.id", ondelete="CASCADE"))
    data: Mapped[date] = mapped_column(Date)
    descricao: Mapped[str] = mapped_column(String(255))
    valor: Mapped[Decimal] = mapped_column(Numeric(12, 2))
    categoria_id: Mapped[int | None] = mapped_column(
        ForeignKey("categorias.id", ondelete="SET NULL"), nullable=True
    )
    parcela_atual: Mapped[int | None] = mapped_column(SmallInteger, nullable=True)
    total_parcelas: Mapped[int | None] = mapped_column(SmallInteger, nullable=True)
