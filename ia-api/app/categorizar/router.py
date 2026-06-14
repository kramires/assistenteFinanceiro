import json
from fastapi import APIRouter, HTTPException, status
from pydantic import BaseModel

from app.clients.openai_client import chat_completion
from app.config import settings

router = APIRouter(tags=["categorizar"])


class CategorizarRequest(BaseModel):
    descricao: str
    categorias: list[str] = []


@router.post("/categorizar")
async def categorizar(body: CategorizarRequest):
    cats = ", ".join(body.categorias) if body.categorias else "Outros"
    messages = [
        {"role": "system", "content": "Retorne JSON com campo 'categoria' escolhendo a mais adequada das fornecidas."},
        {"role": "user", "content": f"Categorias: {cats}\nDescrição: {body.descricao}"},
    ]
    try:
        raw = await chat_completion(messages, model=settings.openai_model_mini)
        return json.loads(raw)
    except Exception as exc:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail=str(exc))
