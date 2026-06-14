from pydantic import BaseModel


class MaiorGasto(BaseModel):
    descricao: str | None
    valor: float | None


class ResumoMes(BaseModel):
    receitas: float
    despesas: float
    saldo: float
    saldo_acumulado: float
    media_mensal: float
    saldo_mes_anterior: float
    maior_gasto: MaiorGasto


class GastoCategoria(BaseModel):
    categoria: str
    total: float


class EvolucaoMensal(BaseModel):
    mes: str
    total: float


class ResumoMesAnual(BaseModel):
    mes: str
    receitas: float
    despesas: float
    saldo: float
    saldo_acumulado: float


class AlertasResponse(BaseModel):
    alertas: list[str]


class ResumoNarrativoResponse(BaseModel):
    texto: str | None = None
    erro: str | None = None
