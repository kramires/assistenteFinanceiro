from decimal import Decimal

from pydantic import BaseModel, field_validator


class OrcamentoCreate(BaseModel):
    categoria_id: int
    ano: int
    mes: int
    valor_limite: Decimal

    @field_validator("mes")
    @classmethod
    def mes_valido(cls, v: int) -> int:
        if not 1 <= v <= 12:
            raise ValueError("Mês deve ser entre 1 e 12")
        return v

    @field_validator("ano")
    @classmethod
    def ano_valido(cls, v: int) -> int:
        if not 2000 <= v <= 2100:
            raise ValueError("Ano deve ser entre 2000 e 2100")
        return v


class OrcamentoResponse(BaseModel):
    id: int
    categoria_id: int
    ano: int
    mes: int
    valor_limite: Decimal

    model_config = {"from_attributes": True}
