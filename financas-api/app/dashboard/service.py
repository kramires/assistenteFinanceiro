from decimal import Decimal

from app.dashboard.repository import DashboardRepository
from app.dashboard.schemas import (
    AlertasResponse,
    EvolucaoMensal,
    GastoCategoria,
    MaiorGasto,
    ResumoMes,
    ResumoMesAnual,
)


class DashboardService:
    def __init__(self, repo: DashboardRepository) -> None:
        self.repo = repo

    async def resumo_mes(self, ano: int, mes: int) -> ResumoMes:
        data = await self.repo.resumo_mes(ano, mes)
        return ResumoMes(
            receitas=data["receitas"],
            despesas=data["despesas"],
            saldo=data["saldo"],
            saldo_acumulado=data["saldo_acumulado"],
            media_mensal=data["media_mensal"],
            saldo_mes_anterior=data["saldo_mes_anterior"],
            maior_gasto=MaiorGasto(
                descricao=data["maior_gasto"]["descricao"],
                valor=data["maior_gasto"]["valor"],
            ),
        )

    async def gastos_por_categoria(self, ano: int, mes: int) -> list[GastoCategoria]:
        rows = await self.repo.gastos_por_categoria(ano, mes)
        return [GastoCategoria(categoria=r["categoria"], total=r["total"]) for r in rows]

    async def evolucao_mensal(self, ano: int) -> list[EvolucaoMensal]:
        rows = await self.repo.evolucao_mensal(ano)
        return [EvolucaoMensal(mes=r["mes"], total=r["total"]) for r in rows]

    async def resumo_anual(self, ano: int) -> list[ResumoMesAnual]:
        rows = await self.repo.resumo_anual(ano)
        return [ResumoMesAnual(**r) for r in rows]

    async def alertas(self, ano: int, mes: int) -> AlertasResponse:
        rows = await self.repo.listar_orcamentos_com_gasto(ano, mes)
        msgs: list[str] = []
        for row in rows:
            orc = row[0]
            gasto = Decimal(str(row[1]))
            nome = row[2]
            limite = orc.valor_limite
            if limite > 0 and gasto >= limite * Decimal("0.8"):
                pct = int(gasto / limite * 100)
                if gasto >= limite:
                    msgs.append(f"🚨 {nome}: limite atingido ({pct}% usado)")
                else:
                    msgs.append(f"⚠️ {nome}: {pct}% do limite usado")
        return AlertasResponse(alertas=msgs)
