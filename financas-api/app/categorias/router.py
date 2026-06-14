from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.service import get_current_user
from app.categorias.repository import CategoriaRepository
from app.categorias.schemas import CategoriaCreate, CategoriaResponse
from app.categorias.service import CategoriaService
from app.database import get_db

router = APIRouter(prefix="/categorias", tags=["categorias"])


def _service(db: AsyncSession = Depends(get_db)) -> CategoriaService:
    return CategoriaService(CategoriaRepository(db))


@router.get("", response_model=list[CategoriaResponse])
async def listar(
    svc: CategoriaService = Depends(_service),
    _: str = Depends(get_current_user),
):
    return await svc.listar()


@router.post("", response_model=CategoriaResponse, status_code=201)
async def criar(
    body: CategoriaCreate,
    svc: CategoriaService = Depends(_service),
    _: str = Depends(get_current_user),
):
    return await svc.criar(body.nome, body.tipo)


@router.delete("/{id}", status_code=204)
async def excluir(
    id: int,
    svc: CategoriaService = Depends(_service),
    _: str = Depends(get_current_user),
):
    await svc.excluir(id)
