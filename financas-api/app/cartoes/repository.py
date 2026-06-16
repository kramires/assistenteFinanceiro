from decimal import Decimal

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.cartoes.models import CartaoCredito


class CartaoRepository:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def listar(self) -> list[CartaoCredito]:
        result = await self.db.execute(select(CartaoCredito).order_by(CartaoCredito.nome))
        return list(result.scalars().all())

    async def get(self, id: int) -> CartaoCredito | None:
        return await self.db.get(CartaoCredito, id)

    async def criar(
        self,
        nome: str,
        bandeira: str | None,
        final_numero: str | None,
        limite: float | None,
        cor: str,
    ) -> CartaoCredito:
        c = CartaoCredito(
            nome=nome,
            bandeira=bandeira,
            final_numero=final_numero,
            limite=Decimal(str(limite)) if limite is not None else None,
            cor=cor,
        )
        self.db.add(c)
        await self.db.commit()
        await self.db.refresh(c)
        return c

    async def excluir(self, id: int) -> bool:
        c = await self.db.get(CartaoCredito, id)
        if not c:
            return False
        await self.db.delete(c)
        await self.db.commit()
        return True
