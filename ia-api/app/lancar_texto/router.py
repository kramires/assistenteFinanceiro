from fastapi import APIRouter, HTTPException, status
from pydantic import BaseModel

from app.lancar_texto.service import extrair_lancamento

router = APIRouter(tags=["lancar-texto"])


class LancarTextoRequest(BaseModel):
    texto: str
    categorias: list[str] = []


@router.post("/lancar-texto")
async def lancar_texto(body: LancarTextoRequest):
    try:
        return await extrair_lancamento(body.texto, body.categorias)
    except Exception as exc:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail=str(exc))
