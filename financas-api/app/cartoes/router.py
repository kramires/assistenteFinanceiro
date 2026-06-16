from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.service import get_current_user
from app.cartoes.repository import CartaoRepository
from app.cartoes.schemas import CartaoCreate, CartaoResponse
from app.database import get_db

router = APIRouter(tags=["cartoes"])


@router.get("/cartoes", response_model=list[CartaoResponse])
async def listar_cartoes(
    db: AsyncSession = Depends(get_db),
    _: str = Depends(get_current_user),
):
    repo = CartaoRepository(db)
    return await repo.listar()


@router.post("/cartoes", response_model=CartaoResponse, status_code=201)
async def criar_cartao(
    body: CartaoCreate,
    db: AsyncSession = Depends(get_db),
    _: str = Depends(get_current_user),
):
    repo = CartaoRepository(db)
    return await repo.criar(
        nome=body.nome,
        bandeira=body.bandeira,
        final_numero=body.final_numero,
        limite=body.limite,
        cor=body.cor,
    )


@router.delete("/cartoes/{id}", status_code=204)
async def excluir_cartao(
    id: int,
    db: AsyncSession = Depends(get_db),
    _: str = Depends(get_current_user),
):
    repo = CartaoRepository(db)
    if not await repo.excluir(id):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Cartão não encontrado.")
