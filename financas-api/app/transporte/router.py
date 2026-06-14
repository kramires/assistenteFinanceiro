from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.service import get_current_user
from app.database import get_db
from app.transporte.repository import TransporteRepository
from app.transporte.schemas import (
    TransacaoTransporte,
    TransporteEvolucaoMes,
    TransporteResumo,
)
from app.transporte.service import TransporteService

router = APIRouter(prefix="/transporte-app", tags=["transporte-app"])


def _service(db: AsyncSession = Depends(get_db)) -> TransporteService:
    return TransporteService(TransporteRepository(db))


@router.get("/transacoes", response_model=list[TransacaoTransporte])
async def listar_transacoes(
    ano: int,
    mes: int,
    svc: TransporteService = Depends(_service),
    _: str = Depends(get_current_user),
):
    return await svc.listar_transacoes(ano, mes)


@router.get("/resumo", response_model=TransporteResumo)
async def resumo(
    ano: int,
    mes: int,
    svc: TransporteService = Depends(_service),
    _: str = Depends(get_current_user),
):
    return await svc.resumo(ano, mes)


@router.get("/evolucao", response_model=list[TransporteEvolucaoMes])
async def evolucao(
    ano: int,
    svc: TransporteService = Depends(_service),
    _: str = Depends(get_current_user),
):
    return await svc.evolucao(ano)
