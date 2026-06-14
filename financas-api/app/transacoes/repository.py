from datetime import date
from decimal import Decimal

from sqlalchemy import extract, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.transacoes.models import Transacao


class TransacaoRepository:
    def __init__(self, db: AsyncSession) -> None:
        self.db = db

    async def listar(self, ano: int, mes: int | None = None) -> list[Transacao]:
        q = select(Transacao).where(extract("year", Transacao.data) == ano)
        if mes is not None:
            q = q.where(extract("month", Transacao.data) == mes)
        result = await self.db.execute(q.order_by(Transacao.data.desc()))
        return list(result.scalars().all())

    async def buscar_por_id(self, id: int) -> Transacao | None:
        return await self.db.get(Transacao, id)

    async def criar(self, **kwargs) -> Transacao:
        t = Transacao(**kwargs)
        self.db.add(t)
        await self.db.commit()
        await self.db.refresh(t)
        return t

    async def atualizar(self, t: Transacao, **kwargs) -> Transacao:
        for k, v in kwargs.items():
            setattr(t, k, v)
        await self.db.commit()
        await self.db.refresh(t)
        return t

    async def excluir(self, t: Transacao) -> None:
        await self.db.delete(t)
        await self.db.commit()

    async def existe_duplicata(self, data: date, valor: Decimal, descricao: str) -> bool:
        result = await self.db.execute(
            select(Transacao)
            .where(
                Transacao.data == data,
                Transacao.valor == valor,
                Transacao.descricao == descricao,
            )
            .limit(1)
        )
        return result.scalar_one_or_none() is not None
