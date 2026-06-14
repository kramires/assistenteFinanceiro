from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.service import get_current_user
from app.database import get_db
from app.transacoes.schemas import TransacaoCreate, TransacaoResponse
from app.transacoes.service import TransacaoService

router = APIRouter(prefix="/transacoes", tags=["transacoes"])


def _service(db: AsyncSession = Depends(get_db)) -> TransacaoService:
    return TransacaoService(db)


# BR-MIGRAR-009: ano obrigatório quando mes presente
@router.get("", response_model=list[TransacaoResponse])
async def listar(
    ano: int,
    mes: int | None = Query(default=None, ge=1, le=12),
    svc: TransacaoService = Depends(_service),
    _: str = Depends(get_current_user),
):
    return await svc.listar(ano, mes)


@router.post("", response_model=TransacaoResponse, status_code=201)
async def criar(
    body: TransacaoCreate,
    svc: TransacaoService = Depends(_service),
    _: str = Depends(get_current_user),
):
    return await svc.criar(body)


@router.put("/{id}", response_model=TransacaoResponse)
async def atualizar(
    id: int,
    body: TransacaoCreate,
    svc: TransacaoService = Depends(_service),
    _: str = Depends(get_current_user),
):
    return await svc.atualizar(id, body)


@router.delete("/{id}", status_code=204)
async def excluir(
    id: int,
    svc: TransacaoService = Depends(_service),
    _: str = Depends(get_current_user),
):
    await svc.excluir(id)
