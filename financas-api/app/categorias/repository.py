from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.categorias.models import Categoria


class CategoriaRepository:
    def __init__(self, db: AsyncSession) -> None:
        self.db = db

    async def listar(self) -> list[Categoria]:
        result = await self.db.execute(select(Categoria).order_by(Categoria.nome))
        return list(result.scalars().all())

    async def buscar_por_id(self, id: int) -> Categoria | None:
        return await self.db.get(Categoria, id)

    async def buscar_por_nome(self, nome: str) -> Categoria | None:
        result = await self.db.execute(
            select(Categoria).where(Categoria.nome.ilike(nome))
        )
        return result.scalar_one_or_none()

    async def criar(self, nome: str, tipo: str) -> Categoria:
        cat = Categoria(nome=nome, tipo=tipo)
        self.db.add(cat)
        await self.db.commit()
        await self.db.refresh(cat)
        return cat

    async def atualizar(self, cat: Categoria, nome: str, tipo: str) -> Categoria:
        cat.nome = nome
        cat.tipo = tipo
        await self.db.commit()
        await self.db.refresh(cat)
        return cat

    async def excluir(self, cat: Categoria) -> None:
        await self.db.delete(cat)
        await self.db.commit()
