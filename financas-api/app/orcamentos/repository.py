from decimal import Decimal

from sqlalchemy import and_, extract, func, select
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.ext.asyncio import AsyncSession

from app.orcamentos.models import Orcamento
from app.transacoes.models import Transacao


class OrcamentoRepository:
    def __init__(self, db: AsyncSession) -> None:
        self.db = db

    async def listar(self, ano: int, mes: int | None = None) -> list[Orcamento]:
        q = select(Orcamento).where(Orcamento.ano == ano)
        if mes is not None:
            q = q.where(Orcamento.mes == mes)
        result = await self.db.execute(q)
        return list(result.scalars().all())

    # BR-MIGRAR-011: upsert por (categoria_id, ano, mes)
    async def upsert(self, categoria_id: int, ano: int, mes: int, valor_limite: Decimal) -> Orcamento:
        stmt = (
            pg_insert(Orcamento)
            .values(categoria_id=categoria_id, ano=ano, mes=mes, valor_limite=valor_limite)
            .on_conflict_do_update(
                index_elements=["categoria_id", "ano", "mes"],
                set_={"valor_limite": valor_limite},
            )
            .returning(Orcamento)
        )
        result = await self.db.execute(stmt)
        await self.db.commit()
        row = result.fetchone()
        return row[0]  # type: ignore[index]

    async def excluir(self, id: int) -> Orcamento | None:
        orc = await self.db.get(Orcamento, id)
        if orc:
            await self.db.delete(orc)
            await self.db.commit()
        return orc

    # Usado pelo AlertaService (dashboard)
    async def listar_com_gasto(self, ano: int, mes: int) -> list[tuple]:
        q = (
            select(
                Orcamento,
                func.abs(func.coalesce(func.sum(Transacao.valor), 0)).label("gasto"),
            )
            .outerjoin(
                Transacao,
                and_(
                    Transacao.categoria_id == Orcamento.categoria_id,
                    extract("year", Transacao.data) == ano,
                    extract("month", Transacao.data) == mes,
                    Transacao.contabilizar_dashboard.is_(True),
                    Transacao.valor < 0,
                ),
            )
            .where(
                Orcamento.ano == ano,
                Orcamento.mes == mes,
                Orcamento.valor_limite > 0,  # BR-MIGRAR-015
            )
            .group_by(Orcamento.id)
        )
        result = await self.db.execute(q)
        return result.fetchall()
