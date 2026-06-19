import httpx
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.service import get_current_user
from app.config import settings
from app.database import get_db
from app.dashboard.repository import DashboardRepository
from app.dashboard.schemas import (
    AlertasResponse,
    AnaliseFinanceiraResponse,
    EvolucaoMensal,
    GastoCategoria,
    ResumoMes,
    ResumoMesAnual,
    ResumoNarrativoResponse,
)
from app.dashboard.service import DashboardService

router = APIRouter(prefix="/dashboard", tags=["dashboard"])


def _service(db: AsyncSession = Depends(get_db)) -> DashboardService:
    return DashboardService(DashboardRepository(db))


@router.get("/resumo-mes", response_model=ResumoMes)
async def resumo_mes(
    ano: int,
    mes: int,
    svc: DashboardService = Depends(_service),
    _: str = Depends(get_current_user),
):
    return await svc.resumo_mes(ano, mes)


@router.get("/gastos-por-categoria", response_model=list[GastoCategoria])
async def gastos_por_categoria(
    ano: int,
    mes: int,
    svc: DashboardService = Depends(_service),
    _: str = Depends(get_current_user),
):
    return await svc.gastos_por_categoria(ano, mes)


@router.get("/evolucao-mensal", response_model=list[EvolucaoMensal])
async def evolucao_mensal(
    ano: int,
    svc: DashboardService = Depends(_service),
    _: str = Depends(get_current_user),
):
    return await svc.evolucao_mensal(ano)


@router.get("/resumo-anual", response_model=list[ResumoMesAnual])
async def resumo_anual(
    ano: int,
    svc: DashboardService = Depends(_service),
    _: str = Depends(get_current_user),
):
    return await svc.resumo_anual(ano)


@router.get("/alertas", response_model=AlertasResponse)
async def alertas(
    ano: int,
    mes: int,
    svc: DashboardService = Depends(_service),
    _: str = Depends(get_current_user),
):
    return await svc.alertas(ano, mes)


@router.get("/resumo-narrativo", response_model=ResumoNarrativoResponse)
async def resumo_narrativo(
    ano: int,
    mes: int,
    svc: DashboardService = Depends(_service),
    _: str = Depends(get_current_user),
):
    resumo = await svc.resumo_mes(ano, mes)
    top_cat = await svc.gastos_por_categoria(ano, mes)

    payload = {
        "mes": mes,
        "ano": ano,
        "total_receitas": resumo.receitas,
        "total_despesas": resumo.despesas,
        "saldo": resumo.saldo,
        "top_categorias": [{"categoria": c.categoria, "total": c.total} for c in top_cat[:5]],
    }

    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            resp = await client.post(f"{settings.ia_api_url}/ia/resumo-narrativo", json=payload)
            resp.raise_for_status()
            data = resp.json()
            return ResumoNarrativoResponse(texto=data.get("resumo"))
    except Exception as exc:
        return ResumoNarrativoResponse(erro=f"IA indisponível: {exc}")


@router.get("/analise-financeira", response_model=AnaliseFinanceiraResponse)
async def analise_financeira(
    meses: int = 6,
    svc: DashboardService = Depends(_service),
    db: AsyncSession = Depends(get_db),
    _: str = Depends(get_current_user),
):
    """Análise financeira profunda via IA para os últimos N meses."""
    from datetime import date
    from app.faturas.repository import FaturaRepository

    def _mes_offset(n: int) -> tuple[int, int]:
        today = date.today()
        y, m = today.year, today.month - n
        while m <= 0:
            m += 12
            y -= 1
        return y, m

    repo_fat = FaturaRepository(db)
    meses_range = []
    for i in range(meses - 1, -1, -1):
        y, m = _mes_offset(i)
        meses_range.append((y, m, f"{y:04d}-{m:02d}"))

    receita_total = 0.0
    cat_totais: dict[str, float] = {}
    evolucao_mensal = []

    for y, m, mes_str in meses_range:
        resumo = await svc.resumo_mes(y, m)
        receita_total += resumo.receitas

        rows = await repo_fat.listar_lancamentos_por_mes(mes_str)
        total_mes = sum(float(r.LancamentoFatura.valor) for r in rows)
        for r in rows:
            cat = r.categoria_nome or "Outros"
            cat_totais[cat] = cat_totais.get(cat, 0.0) + float(r.LancamentoFatura.valor)
        evolucao_mensal.append({"mes": mes_str, "total": round(total_mes, 2)})

    renda_media = receita_total / meses if meses > 0 else 0
    total_cartao = sum(v for v in cat_totais.values())
    media_mensal_cartao = total_cartao / meses if meses > 0 else 0
    pct_renda = (media_mensal_cartao / renda_media * 100) if renda_media > 0 else 0

    top_cats = sorted(cat_totais.items(), key=lambda x: x[1], reverse=True)[:10]
    top_cats_payload = [
        {
            "categoria": k,
            "total": round(v, 2),
            "percentual_renda": round(v / meses / renda_media * 100, 1) if renda_media > 0 else 0,
        }
        for k, v in top_cats
    ]

    y0, m0, _ = meses_range[0]
    y1, m1, _ = meses_range[-1]
    periodo_desc = f"{_mes_fmt(m0)}/{y0} a {_mes_fmt(m1)}/{y1} ({meses} meses)"

    payload = {
        "periodo_descricao": periodo_desc,
        "renda_mensal_media": round(renda_media, 2),
        "total_cartao_periodo": round(total_cartao, 2),
        "media_mensal_cartao": round(media_mensal_cartao, 2),
        "percentual_renda_em_cartao": round(pct_renda, 1),
        "top_categorias": top_cats_payload,
        "evolucao_mensal": evolucao_mensal,
    }

    try:
        async with httpx.AsyncClient(timeout=60.0) as client:
            resp = await client.post(f"{settings.ia_api_url}/ia/analise-financeira", json=payload)
            resp.raise_for_status()
            data = resp.json()
            return AnaliseFinanceiraResponse(**data)
    except Exception as exc:
        return AnaliseFinanceiraResponse(erro=f"IA indisponível: {exc}")


def _mes_fmt(m: int) -> str:
    nomes = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"]
    return nomes[m - 1]
