from fastapi import HTTPException, status

from app.orcamentos.models import Orcamento
from app.orcamentos.repository import OrcamentoRepository
from app.orcamentos.schemas import OrcamentoCreate


class OrcamentoService:
    def __init__(self, repo: OrcamentoRepository) -> None:
        self.repo = repo

    async def listar(self, ano: int, mes: int | None = None) -> list[Orcamento]:
        return await self.repo.listar(ano, mes)

    async def upsert(self, body: OrcamentoCreate) -> Orcamento:
        return await self.repo.upsert(
            categoria_id=body.categoria_id,
            ano=body.ano,
            mes=body.mes,
            valor_limite=body.valor_limite,
        )

    async def excluir(self, id: int) -> None:
        orc = await self.repo.excluir(id)
        if not orc:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Orçamento não encontrado.")
