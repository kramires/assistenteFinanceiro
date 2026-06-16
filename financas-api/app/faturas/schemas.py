from datetime import date
from pydantic import BaseModel


class LancamentoFaturaResponse(BaseModel):
    id: int
    data: date
    descricao: str
    valor: float
    categoria_id: int | None
    categoria_nome: str | None
    parcela_atual: int | None
    total_parcelas: int | None

    model_config = {"from_attributes": True}


class FaturaResponse(BaseModel):
    id: int
    cartao_id: int
    cartao_nome: str
    mes_referencia: str
    data_fechamento: date | None
    data_vencimento: date | None
    valor_total: float
    status: str
    saldo_parcelado: float
    lancamentos: list[LancamentoFaturaResponse] = []

    model_config = {"from_attributes": True}


class FaturaResumo(BaseModel):
    id: int
    cartao_id: int
    cartao_nome: str
    mes_referencia: str
    data_vencimento: date | None
    valor_total: float
    status: str
    total_lancamentos: int

    model_config = {"from_attributes": True}


class PagarFaturaRequest(BaseModel):
    data_pagamento: date | None = None
    categoria_id: int | None = None


class PatchLancamentoRequest(BaseModel):
    categoria_id: int | None = None
