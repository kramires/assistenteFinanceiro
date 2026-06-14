from fastapi import HTTPException, status
from sqlalchemy.exc import IntegrityError

from app.categorias.models import Categoria
from app.categorias.repository import CategoriaRepository
from app.domain.transporte import PRIORIDADE_CATEGORIA_TRANSPORTE


class CategoriaService:
    def __init__(self, repo: CategoriaRepository) -> None:
        self.repo = repo

    async def listar(self) -> list[Categoria]:
        return await self.repo.listar()

    async def criar(self, nome: str, tipo: str) -> Categoria:
        try:
            return await self.repo.criar(nome, tipo)
        except IntegrityError:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Já existe uma categoria com este nome.",
            )

    async def excluir(self, id: int) -> None:
        cat = await self.repo.buscar_por_id(id)
        if not cat:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Categoria não encontrada.")
        try:
            await self.repo.excluir(cat)
        except IntegrityError:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Esta categoria possui transações vinculadas e não pode ser excluída.",
            )

    async def obter_ou_criar(self, nome: str, tipo: str = "despesa") -> Categoria:
        existente = await self.repo.buscar_por_nome(nome)
        if existente:
            return existente
        try:
            return await self.repo.criar(nome, tipo)
        except IntegrityError:
            # race condition: outro request criou antes
            return await self.repo.buscar_por_nome(nome)  # type: ignore[return-value]

    # BR-MIGRAR-008
    async def normalizar_transporte(self) -> Categoria:
        for nome in PRIORIDADE_CATEGORIA_TRANSPORTE:
            cat = await self.repo.buscar_por_nome(nome)
            if cat:
                return cat
        return await self.obter_ou_criar("Transporte Alternativo", "despesa")
