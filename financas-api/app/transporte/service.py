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
        fatura_rows = await self.repo.listar_transacoes_fatura(ano, mes)

        result: list[TransacaoTransporte] = []

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
                    fonte="extrato",
                )
            )

        for lf, cat in fatura_rows:
            result.append(
                TransacaoTransporte(
                    id=lf.id,
                    descricao=lf.descricao,
                    valor=-abs(float(lf.valor)),  # despesas de fatura como negativo (padrão visual)
                    data=lf.data.isoformat(),
                    origem=None,
                    destino=None,
                    categoria_id=lf.categoria_id,
                    categoria=CategoriaEmbed(id=cat.id, nome=cat.nome, tipo=cat.tipo) if cat else None,
                    fonte="fatura",
                )
            )

        result.sort(key=lambda x: x.data, reverse=True)
        return result

    async def resumo(self, ano: int, mes: int) -> TransporteResumo:
        extrato = await self.repo.resumo(ano, mes)
        fatura = await self.repo.resumo_fatura(ano, mes)
        return TransporteResumo(
            total_mes=extrato["total_mes"] + fatura["total_mes"],
            total_ano=extrato["total_ano"] + fatura["total_ano"],
            quantidade_mes=extrato["quantidade_mes"] + fatura["quantidade_mes"],
        )

    async def evolucao(self, ano: int) -> list[TransporteEvolucaoMes]:
        rows = await self.repo.evolucao(ano)  # list[dict] with extrato data
        fatura_monthly = await self.repo.evolucao_fatura_mensal(ano)

        rows_by_month = {r["mes"]: r for r in rows}
        all_months = sorted(set(rows_by_month) | set(fatura_monthly))

        result: list[TransporteEvolucaoMes] = []
        acumulado = 0.0
        for mes_str in all_months:
            existing = rows_by_month.get(mes_str, {})
            uber_extrato = existing.get("uber_mes", 0.0)
            uber_fatura = fatura_monthly.get(mes_str, 0.0)
            uber_mes = uber_extrato + uber_fatura
            despesas_mes = existing.get("despesas_mes", 0.0)
            acumulado += uber_mes
            pct = (uber_mes / despesas_mes * 100) if despesas_mes > 0 else 0.0
            result.append(
                TransporteEvolucaoMes(
                    mes=mes_str,
                    uber_mes=uber_mes,
                    uber_acumulado=acumulado,
                    despesas_mes=despesas_mes,
                    percentual_uber_despesas=round(pct, 2),
                )
            )
        return result
