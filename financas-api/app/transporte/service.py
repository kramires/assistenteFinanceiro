from app.transporte.repository import TransporteRepository
from app.transporte.schemas import (
    CategoriaEmbed,
    TransacaoTransporte,
    TransporteEvolucaoMes,
    TransporteResumo,
)


class TransporteService:
    def __init__(self, repo: TransporteRepository) -> None:
        self.repo = repo

    async def listar_transacoes(self, ano: int, mes: int) -> list[TransacaoTransporte]:
        rows = await self.repo.listar_transacoes(ano, mes)
        result = []
        for tx, cat in rows:
            result.append(
                TransacaoTransporte(
                    id=tx.id,
                    descricao=tx.descricao,
                    valor=float(tx.valor),
                    data=tx.data.isoformat(),
                    origem=tx.origem,
                    destino=tx.destino,
                    categoria_id=tx.categoria_id,
                    categoria=CategoriaEmbed(id=cat.id, nome=cat.nome, tipo=cat.tipo) if cat else None,
                )
            )
        return result

    async def resumo(self, ano: int, mes: int) -> TransporteResumo:
        data = await self.repo.resumo(ano, mes)
        return TransporteResumo(**data)

    async def evolucao(self, ano: int) -> list[TransporteEvolucaoMes]:
        rows = await self.repo.evolucao(ano)
        return [TransporteEvolucaoMes(**r) for r in rows]
