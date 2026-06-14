from enum import Enum

from pydantic import BaseModel


class TipoCategoria(str, Enum):
    DESPESA = "despesa"
    RENDIMENTO = "rendimento"


class CategoriaCreate(BaseModel):
    nome: str
    tipo: TipoCategoria


class CategoriaResponse(BaseModel):
    id: int
    nome: str
    tipo: str

    model_config = {"from_attributes": True}
