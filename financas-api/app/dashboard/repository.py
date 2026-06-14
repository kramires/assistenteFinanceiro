from decimal import Decimal

from sqlalchemy import and_, case, extract, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.categorias.models import Categoria
from app.orcamentos.models import Orcamento
from app.transacoes.models import Transacao


class DashboardRepository:
    def __init__(self, db: AsyncSession) -> None:
        self.db = db

    async def resumo_mes(self, ano: int, mes: int) -> dict:
        # Current month aggregates
        q = select(
            func.coalesce(func.sum(case((Transacao.valor > 0, Transacao.valor), else_=0)), 0).label("receitas"),
            func.coalesce(func.abs(func.sum(case((Transacao.valor < 0, Transacao.valor), else_=0))), 0).label("despesas"),
            func.coalesce(func.sum(Transacao.valor), 0).label("saldo"),
        ).where(
            extract("year", Transacao.data) == ano,
            extract("month", Transacao.data) == mes,
            Transacao.contabilizar_dashboard.is_(True),
        )
        row = (await self.db.execute(q)).one()
        receitas = float(row.receitas)
        despesas = float(row.despesas)
        saldo = float(row.saldo)

        # Saldo acumulado: sum from Jan through current month
        q_acum = select(func.coalesce(func.sum(Transacao.valor), 0)).where(
            extract("year", Transacao.data) == ano,
            extract("month", Transacao.data) <= mes,
            Transacao.contabilizar_dashboard.is_(True),
        )
        saldo_acumulado = float((await self.db.execute(q_acum)).scalar_one())

        # Media mensal: total negative for year / 12 (BR-MIGRAR-018)
        q_media = select(func.coalesce(func.abs(func.sum(Transacao.valor)), 0)).where(
            extract("year", Transacao.data) == ano,
            Transacao.valor < 0,
            Transacao.contabilizar_dashboard.is_(True),
        )
        media_mensal = float((await self.db.execute(q_media)).scalar_one()) / 12

        # Saldo mes anterior
        if mes == 1:
            prev_ano, prev_mes = ano - 1, 12
        else:
            prev_ano, prev_mes = ano, mes - 1

        q_prev = select(func.coalesce(func.sum(Transacao.valor), 0)).where(
            extract("year", Transacao.data) == prev_ano,
            extract("month", Transacao.data) == prev_mes,
            Transacao.contabilizar_dashboard.is_(True),
        )
        saldo_mes_anterior = float((await self.db.execute(q_prev)).scalar_one())

        # Maior gasto do mês
        q_gasto = (
            select(Transacao.descricao, func.abs(Transacao.valor).label("abs_val"))
            .where(
                extract("year", Transacao.data) == ano,
                extract("month", Transacao.data) == mes,
                Transacao.valor < 0,
                Transacao.contabilizar_dashboard.is_(True),
            )
            .order_by(Transacao.valor.asc())
            .limit(1)
        )
        maior_row = (await self.db.execute(q_gasto)).first()

        return {
            "receitas": receitas,
            "despesas": despesas,
            "saldo": saldo,
            "saldo_acumulado": saldo_acumulado,
            "media_mensal": media_mensal,
            "saldo_mes_anterior": saldo_mes_anterior,
            "maior_gasto": {
                "descricao": maior_row.descricao if maior_row else None,
                "valor": float(maior_row.abs_val) if maior_row else None,
            },
        }

    async def gastos_por_categoria(self, ano: int, mes: int) -> list[dict]:
        q = (
            select(
                Categoria.nome.label("categoria"),
                func.abs(func.sum(Transacao.valor)).label("total"),
            )
            .outerjoin(Categoria, Transacao.categoria_id == Categoria.id)
            .where(
                extract("year", Transacao.data) == ano,
                extract("month", Transacao.data) == mes,
                Transacao.valor < 0,
                Transacao.contabilizar_dashboard.is_(True),
            )
            .group_by(Categoria.nome)
            .order_by(func.abs(func.sum(Transacao.valor)).desc())
        )
        rows = (await self.db.execute(q)).all()
        return [{"categoria": r.categoria or "Sem categoria", "total": float(r.total)} for r in rows]

    async def evolucao_mensal(self, ano: int) -> list[dict]:
        q = (
            select(
                extract("year", Transacao.data).label("yr"),
                extract("month", Transacao.data).label("mo"),
                func.abs(func.sum(Transacao.valor)).label("total"),
            )
            .where(
                extract("year", Transacao.data) == ano,
                Transacao.valor < 0,
                Transacao.contabilizar_dashboard.is_(True),
            )
            .group_by(extract("year", Transacao.data), extract("month", Transacao.data))
            .order_by(extract("year", Transacao.data), extract("month", Transacao.data))
        )
        rows = (await self.db.execute(q)).all()
        return [{"mes": f"{int(r.yr):04d}-{int(r.mo):02d}", "total": float(r.total)} for r in rows]

    async def resumo_anual(self, ano: int) -> list[dict]:
        q = (
            select(
                extract("year", Transacao.data).label("yr"),
                extract("month", Transacao.data).label("mo"),
                func.coalesce(func.sum(case((Transacao.valor > 0, Transacao.valor), else_=0)), 0).label("receitas"),
                func.coalesce(func.abs(func.sum(case((Transacao.valor < 0, Transacao.valor), else_=0))), 0).label("despesas"),
                func.coalesce(func.sum(Transacao.valor), 0).label("saldo"),
            )
            .where(
                extract("year", Transacao.data) == ano,
                Transacao.contabilizar_dashboard.is_(True),
            )
            .group_by(extract("year", Transacao.data), extract("month", Transacao.data))
            .order_by(extract("year", Transacao.data), extract("month", Transacao.data))
        )
        rows = (await self.db.execute(q)).all()

        result = []
        acumulado = Decimal("0")
        for r in rows:
            acumulado += Decimal(str(r.saldo))
            result.append({
                "mes": f"{int(r.yr):04d}-{int(r.mo):02d}",
                "receitas": float(r.receitas),
                "despesas": float(r.despesas),
                "saldo": float(r.saldo),
                "saldo_acumulado": float(acumulado),
            })
        return result

    async def listar_orcamentos_com_gasto(self, ano: int, mes: int):
        q = (
            select(
                Orcamento,
                func.abs(func.coalesce(func.sum(Transacao.valor), 0)).label("gasto"),
                Categoria.nome.label("categoria_nome"),
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
            .join(Categoria, Categoria.id == Orcamento.categoria_id)
            .where(
                Orcamento.ano == ano,
                Orcamento.mes == mes,
                Orcamento.valor_limite > 0,
            )
            .group_by(Orcamento.id, Categoria.nome)
        )
        return (await self.db.execute(q)).all()
