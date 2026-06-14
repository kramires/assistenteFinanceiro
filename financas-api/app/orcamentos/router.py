from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.service import get_current_user
from app.database import get_db
from app.orcamentos.repository import OrcamentoRepository
from app.orcamentos.schemas import OrcamentoCreate, OrcamentoResponse
from app.orcamentos.service import OrcamentoService

router = APIRouter(prefix="/orcamentos", tags=["orcamentos"])


def _service(db: AsyncSession = Depends(get_db)) -> OrcamentoService:
    return OrcamentoService(OrcamentoRepository(db))


@router.get("", response_model=list[OrcamentoResponse])
async def listar(
    ano: int,
    mes: int | None = Query(default=None, ge=1, le=12),
    svc: OrcamentoService = Depends(_service),
    _: str = Depends(get_current_user),
):
    return await svc.listar(ano, mes)


# BR-MIGRAR-011: upsert cria ou atualiza
@router.post("", response_model=OrcamentoResponse, status_code=201)
async def upsert(
    body: OrcamentoCreate,
    svc: OrcamentoService = Depends(_service),
    _: str = Depends(get_current_user),
):
    return await svc.upsert(body)


@router.delete("/{id}", status_code=204)
async def excluir(
    id: int,
    svc: OrcamentoService = Depends(_service),
    _: str = Depends(get_current_user),
):
    await svc.excluir(id)
