import httpx
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.service import get_current_user
from app.config import settings
from app.database import get_db
from app.dashboard.repository import DashboardRepository
from app.dashboard.schemas import (
    AlertasResponse,
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
