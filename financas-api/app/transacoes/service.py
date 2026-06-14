from fastapi import HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.categorias.repository import CategoriaRepository
from app.domain.transporte import TRANSPORTE_APP_EXCLUIR_DASHBOARD
from app.transacoes.models import Transacao
from app.transacoes.repository import TransacaoRepository
from app.transacoes.schemas import TransacaoCreate


class TransacaoService:
    def __init__(self, db: AsyncSession) -> None:
        self.repo = TransacaoRepository(db)
        self.cat_repo = CategoriaRepository(db)

    # BR-MIGRAR-002 + BR-MIGRAR-004
    async def _contabilizar(self, categoria_id: int | None) -> bool:
        if categoria_id is None:
            return True
        cat = await self.cat_repo.buscar_por_id(categoria_id)
        if cat is None:
            return True
        return cat.nome.lower() not in TRANSPORTE_APP_EXCLUIR_DASHBOARD

    async def listar(self, ano: int, mes: int | None = None) -> list[Transacao]:
        return await self.repo.listar(ano, mes)

    async def criar(self, body: TransacaoCreate) -> Transacao:
        return await self.repo.criar(
            data=body.data,
            descricao=body.descricao,
            valor=body.valor,
            categoria_id=body.categoria_id,
            contabilizar_dashboard=await self._contabilizar(body.categoria_id),
            origem=body.origem,
            destino=body.destino,
        )

    # BR-MIGRAR-010: PUT full-replace
    async def atualizar(self, id: int, body: TransacaoCreate) -> Transacao:
        t = await self.repo.buscar_por_id(id)
        if not t:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Transação não encontrada.")
        return await self.repo.atualizar(
            t,
            data=body.data,
            descricao=body.descricao,
            valor=body.valor,
            categoria_id=body.categoria_id,
            contabilizar_dashboard=await self._contabilizar(body.categoria_id),
            origem=body.origem,
            destino=body.destino,
        )

    async def excluir(self, id: int) -> None:
        t = await self.repo.buscar_por_id(id)
        if not t:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Transação não encontrada.")
        await self.repo.excluir(t)
