from pydantic import BaseModel


class CartaoCreate(BaseModel):
    nome: str
    bandeira: str | None = None
    final_numero: str | None = None
    limite: float | None = None
    cor: str = "#6C63FF"


class CartaoResponse(BaseModel):
    id: int
    nome: str
    bandeira: str | None
    final_numero: str | None
    limite: float | None
    cor: str

    model_config = {"from_attributes": True}
