from pydantic import BaseModel


class CategoriaEmbed(BaseModel):
    id: int
    nome: str
    tipo: str

    model_config = {"from_attributes": True}


class TransacaoTransporte(BaseModel):
    id: int
    descricao: str
    valor: float
    data: str
    origem: str | None
    destino: str | None
    categoria_id: int | None
    categoria: CategoriaEmbed | None
    fonte: str = "extrato"  # "extrato" | "fatura"

    model_config = {"from_attributes": True}


class TransporteResumo(BaseModel):
    total_mes: float
    total_ano: float
    quantidade_mes: int


class TransporteEvolucaoMes(BaseModel):
    mes: str
    uber_mes: float
    uber_acumulado: float
    despesas_mes: float
    percentual_uber_despesas: float
