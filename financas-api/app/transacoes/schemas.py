from datetime import date
from decimal import Decimal

from pydantic import BaseModel, field_validator


class TransacaoCreate(BaseModel):
    data: date
    descricao: str
    valor: Decimal
    categoria_id: int | None = None
    origem: str | None = None
    destino: str | None = None

    @field_validator("valor")
    @classmethod
    def valor_nao_zero(cls, v: Decimal) -> Decimal:
        if v == 0:
            raise ValueError("Valor é obrigatório e deve ser diferente de zero")
        return v

    @field_validator("descricao")
    @classmethod
    def descricao_nao_vazia(cls, v: str) -> str:
        v = v.strip()
        if not v:
            raise ValueError("Descrição é obrigatória")
        return v[:255]


class TransacaoUpdate(TransacaoCreate):
    pass


class TransacaoResponse(BaseModel):
    id: int
    data: date
    descricao: str
    valor: Decimal
    categoria_id: int | None
    contabilizar_dashboard: bool
    origem: str | None
    destino: str | None

    model_config = {"from_attributes": True}
