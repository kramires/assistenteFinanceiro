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


class AnaliseFinanceiraResponse(BaseModel):
    resumo_executivo: str | None = None
    nota_saude_financeira: float | None = None
    pontos_de_atencao: list[str] = []
    maiores_gastos_analise: list[str] = []
    recomendacoes: list[str] = []
    meta_poupanca_sugerida: str | None = None
    distribuicao_ideal: dict = {}
    gerado_em: str | None = None
    erro: str | None = None
