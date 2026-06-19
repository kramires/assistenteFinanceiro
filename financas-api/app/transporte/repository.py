from sqlalchemy import and_, case, extract, func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.categorias.models import Categoria
from app.domain.transporte import TRANSPORTE_APP_CALC
from app.faturas.models import LancamentoFatura
from app.transacoes.models import Transacao

_CALC_LOWER = [n.lower() for n in TRANSPORTE_APP_CALC]


def _fatura_transport_filter():
    """OR: categoria.nome in transport set OR descricao ilike any transport keyword."""
    cat_match = func.lower(Categoria.nome).in_(_CALC_LOWER)
    desc_matches = [LancamentoFatura.descricao.ilike(f"%{n}%") for n in TRANSPORTE_APP_CALC]
    return or_(cat_match, *desc_matches)


def _transporte_filter():
    """OR filter: categoria.nome in CALC set OR descricao ilike any CALC name (BR-MIGRAR-023)."""
    cat_match = func.lower(Categoria.nome).in_(_CALC_LOWER)
    desc_matches = [Transacao.descricao.ilike(f"%{n}%") for n in TRANSPORTE_APP_CALC]
    return or_(cat_match, *desc_matches)


class TransporteRepository:
    def __init__(self, db: AsyncSession) -> None:
        self.db = db

    async def listar_transacoes(self, ano: int, mes: int) -> list[tuple]:
        q = (
            select(Transacao, Categoria)
            .outerjoin(Categoria, Transacao.categoria_id == Categoria.id)
            .where(
                extract("year", Transacao.data) == ano,
                extract("month", Transacao.data) == mes,
                _transporte_filter(),
            )
            .order_by(Transacao.data.desc())
        )
        return (await self.db.execute(q)).all()

    async def resumo(self, ano: int, mes: int) -> dict:
        q_mes = select(
            func.coalesce(func.abs(func.sum(case((Transacao.valor < 0, Transacao.valor), else_=0))), 0).label("total_mes"),
            func.count(Transacao.id).label("quantidade_mes"),
        ).outerjoin(
            Categoria, Transacao.categoria_id == Categoria.id
        ).where(
            extract("year", Transacao.data) == ano,
            extract("month", Transacao.data) == mes,
            _transporte_filter(),
        )
        row_mes = (await self.db.execute(q_mes)).one()

        q_ano = select(
            func.coalesce(func.abs(func.sum(case((Transacao.valor < 0, Transacao.valor), else_=0))), 0).label("total_ano"),
        ).outerjoin(
            Categoria, Transacao.categoria_id == Categoria.id
        ).where(
            extract("year", Transacao.data) == ano,
            _transporte_filter(),
        )
        row_ano = (await self.db.execute(q_ano)).one()

        return {
            "total_mes": float(row_mes.total_mes),
            "total_ano": float(row_ano.total_ano),
            "quantidade_mes": int(row_mes.quantidade_mes),
        }

    async def evolucao(self, ano: int) -> list[dict]:
        # Monthly transporte totals
        q_uber = (
            select(
                extract("year", Transacao.data).label("yr"),
                extract("month", Transacao.data).label("mo"),
                func.coalesce(func.abs(func.sum(case((Transacao.valor < 0, Transacao.valor), else_=0))), 0).label("uber_mes"),
            )
            .outerjoin(Categoria, Transacao.categoria_id == Categoria.id)
            .where(
                extract("year", Transacao.data) == ano,
                _transporte_filter(),
            )
            .group_by(extract("year", Transacao.data), extract("month", Transacao.data))
            .order_by(extract("year", Transacao.data), extract("month", Transacao.data))
        )
        uber_rows = {
            f"{int(r.yr):04d}-{int(r.mo):02d}": float(r.uber_mes)
            for r in (await self.db.execute(q_uber)).all()
        }

        # Monthly dashboard despesas totals
        q_desp = (
            select(
                extract("year", Transacao.data).label("yr"),
                extract("month", Transacao.data).label("mo"),
                func.coalesce(func.abs(func.sum(Transacao.valor)), 0).label("despesas_mes"),
            )
            .where(
                extract("year", Transacao.data) == ano,
                Transacao.valor < 0,
                Transacao.contabilizar_dashboard.is_(True),
            )
            .group_by(extract("year", Transacao.data), extract("month", Transacao.data))
            .order_by(extract("year", Transacao.data), extract("month", Transacao.data))
        )
        desp_rows = {
            f"{int(r.yr):04d}-{int(r.mo):02d}": float(r.despesas_mes)
            for r in (await self.db.execute(q_desp)).all()
        }

        all_months = sorted(set(uber_rows) | set(desp_rows))
        result = []
        acumulado = 0.0
        for mes_str in all_months:
            uber_mes = uber_rows.get(mes_str, 0.0)
            despesas_mes = desp_rows.get(mes_str, 0.0)
            acumulado += uber_mes
            pct = (uber_mes / despesas_mes * 100) if despesas_mes > 0 else 0.0
            result.append({
                "mes": mes_str,
                "uber_mes": uber_mes,
                "uber_acumulado": acumulado,
                "despesas_mes": despesas_mes,
                "percentual_uber_despesas": round(pct, 2),
            })
        return result

    # ── fatura sources ────────────────────────────────────────────────────────

    async def listar_transacoes_fatura(self, ano: int, mes: int) -> list[tuple]:
        """Lancamentos_fatura de transporte para o mes/ano pelo data do lancamento."""
        q = (
            select(LancamentoFatura, Categoria)
            .outerjoin(Categoria, LancamentoFatura.categoria_id == Categoria.id)
            .where(
                extract("year", LancamentoFatura.data) == ano,
                extract("month", LancamentoFatura.data) == mes,
                LancamentoFatura.valor > 0,
                _fatura_transport_filter(),
            )
            .order_by(LancamentoFatura.data.desc())
        )
        return (await self.db.execute(q)).all()

    async def resumo_fatura(self, ano: int, mes: int) -> dict:
        """Totais de transporte vindo de lancamentos_fatura."""
        q_mes = (
            select(
                func.coalesce(func.sum(LancamentoFatura.valor), 0).label("total_mes"),
                func.count(LancamentoFatura.id).label("quantidade_mes"),
            )
            .outerjoin(Categoria, LancamentoFatura.categoria_id == Categoria.id)
            .where(
                extract("year", LancamentoFatura.data) == ano,
                extract("month", LancamentoFatura.data) == mes,
                LancamentoFatura.valor > 0,
                _fatura_transport_filter(),
            )
        )
        row_mes = (await self.db.execute(q_mes)).one()

        q_ano = (
            select(func.coalesce(func.sum(LancamentoFatura.valor), 0).label("total_ano"))
            .outerjoin(Categoria, LancamentoFatura.categoria_id == Categoria.id)
            .where(
                extract("year", LancamentoFatura.data) == ano,
                LancamentoFatura.valor > 0,
                _fatura_transport_filter(),
            )
        )
        row_ano = (await self.db.execute(q_ano)).one()

        return {
            "total_mes": float(row_mes.total_mes),
            "total_ano": float(row_ano.total_ano),
            "quantidade_mes": int(row_mes.quantidade_mes),
        }

    async def evolucao_fatura_mensal(self, ano: int) -> dict[str, float]:
        """Soma mensal de transporte de faturas: {YYYY-MM: total}."""
        q = (
            select(
                extract("year", LancamentoFatura.data).label("yr"),
                extract("month", LancamentoFatura.data).label("mo"),
                func.coalesce(func.sum(LancamentoFatura.valor), 0).label("total"),
            )
            .outerjoin(Categoria, LancamentoFatura.categoria_id == Categoria.id)
            .where(
                extract("year", LancamentoFatura.data) == ano,
                LancamentoFatura.valor > 0,
                _fatura_transport_filter(),
            )
            .group_by(extract("year", LancamentoFatura.data), extract("month", LancamentoFatura.data))
        )
        rows = (await self.db.execute(q)).all()
        return {f"{int(r.yr):04d}-{int(r.mo):02d}": float(r.total) for r in rows}
