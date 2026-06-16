from datetime import date
from decimal import Decimal

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.cartoes.models import CartaoCredito
from app.categorias.models import Categoria
from app.faturas.models import FaturaCartao, LancamentoFatura


class FaturaRepository:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def criar_fatura(
        self,
        cartao_id: int,
        mes_referencia: str,
        data_fechamento: date | None,
        data_vencimento: date | None,
        valor_total: Decimal,
        saldo_parcelado: Decimal,
    ) -> FaturaCartao:
        f = FaturaCartao(
            cartao_id=cartao_id,
            mes_referencia=mes_referencia,
            data_fechamento=data_fechamento,
            data_vencimento=data_vencimento,
            valor_total=valor_total,
            saldo_parcelado=saldo_parcelado,
        )
        self.db.add(f)
        await self.db.flush()
        return f

    async def adicionar_lancamentos(self, fatura_id: int, lancamentos: list[dict]) -> None:
        for l in lancamentos:
            lf = LancamentoFatura(
                fatura_id=fatura_id,
                data=l["data"],
                descricao=l["descricao"][:255],
                valor=Decimal(str(l["valor"])),
                categoria_id=l.get("categoria_id"),
                parcela_atual=l.get("parcela_atual"),
                total_parcelas=l.get("total_parcelas"),
            )
            self.db.add(lf)
        await self.db.commit()

    async def listar(
        self,
        cartao_id: int | None = None,
        mes: str | None = None,
    ) -> list[tuple]:
        q = (
            select(
                FaturaCartao,
                CartaoCredito.nome.label("cartao_nome"),
                func.count(LancamentoFatura.id).label("total_lancamentos"),
            )
            .join(CartaoCredito, FaturaCartao.cartao_id == CartaoCredito.id)
            .outerjoin(LancamentoFatura, LancamentoFatura.fatura_id == FaturaCartao.id)
            .group_by(FaturaCartao.id, CartaoCredito.nome)
            .order_by(FaturaCartao.mes_referencia.desc())
        )
        if cartao_id:
            q = q.where(FaturaCartao.cartao_id == cartao_id)
        if mes:
            q = q.where(FaturaCartao.mes_referencia == mes)
        result = await self.db.execute(q)
        return result.all()

    async def get_com_cartao(self, id: int) -> tuple | None:
        q = (
            select(FaturaCartao, CartaoCredito.nome.label("cartao_nome"))
            .join(CartaoCredito, FaturaCartao.cartao_id == CartaoCredito.id)
            .where(FaturaCartao.id == id)
        )
        result = await self.db.execute(q)
        return result.first()

    async def listar_lancamentos(self, fatura_id: int) -> list[tuple]:
        q = (
            select(LancamentoFatura, Categoria.nome.label("categoria_nome"))
            .outerjoin(Categoria, LancamentoFatura.categoria_id == Categoria.id)
            .where(LancamentoFatura.fatura_id == fatura_id)
            .order_by(LancamentoFatura.data.desc())
        )
        result = await self.db.execute(q)
        return result.all()

    async def get_lancamento(self, id: int) -> LancamentoFatura | None:
        return await self.db.get(LancamentoFatura, id)

    async def marcar_paga(
        self,
        fatura_id: int,
        transacao_pagamento_id: int,
    ) -> FaturaCartao | None:
        f = await self.db.get(FaturaCartao, fatura_id)
        if f:
            f.status = "paga"
            f.transacao_pagamento_id = transacao_pagamento_id
            await self.db.commit()
        return f

    async def listar_lancamentos_parcelados(self) -> list[tuple]:
        q = (
            select(
                LancamentoFatura,
                FaturaCartao.mes_referencia,
                FaturaCartao.cartao_id,
                CartaoCredito.nome.label("cartao_nome"),
            )
            .join(FaturaCartao, LancamentoFatura.fatura_id == FaturaCartao.id)
            .join(CartaoCredito, FaturaCartao.cartao_id == CartaoCredito.id)
            .where(
                LancamentoFatura.parcela_atual.isnot(None),
                LancamentoFatura.total_parcelas.isnot(None),
                LancamentoFatura.parcela_atual < LancamentoFatura.total_parcelas,
            )
        )
        result = await self.db.execute(q)
        return result.all()

    async def listar_lancamentos_por_mes(self, mes: str) -> list[tuple]:
        q = (
            select(
                LancamentoFatura,
                FaturaCartao.cartao_id,
                CartaoCredito.nome.label("cartao_nome"),
                Categoria.nome.label("categoria_nome"),
            )
            .join(FaturaCartao, LancamentoFatura.fatura_id == FaturaCartao.id)
            .join(CartaoCredito, FaturaCartao.cartao_id == CartaoCredito.id)
            .outerjoin(Categoria, LancamentoFatura.categoria_id == Categoria.id)
            .where(FaturaCartao.mes_referencia == mes)
        )
        result = await self.db.execute(q)
        return result.all()

    async def listar_faturas_abertas(self) -> list[tuple]:
        q = (
            select(FaturaCartao, CartaoCredito.nome.label("cartao_nome"))
            .join(CartaoCredito, FaturaCartao.cartao_id == CartaoCredito.id)
            .where(FaturaCartao.status == "aberta")
            .order_by(FaturaCartao.data_vencimento.asc().nullslast())
        )
        result = await self.db.execute(q)
        return result.all()
