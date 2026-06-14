import json
from fastapi import APIRouter, HTTPException, status
from pydantic import BaseModel

from app.clients.openai_client import chat_completion
from app.config import settings

router = APIRouter(tags=["resumo-narrativo"])


class ResumoRequest(BaseModel):
    mes: int
    ano: int
    total_receitas: float
    total_despesas: float
    saldo: float
    top_categorias: list[dict] = []


@router.post("/resumo-narrativo")
async def resumo_narrativo(body: ResumoRequest):
    messages = [
        {"role": "system", "content": "Você é um consultor financeiro. Gere um resumo narrativo curto (3-5 frases) em português sobre o mês financeiro do usuário. Retorne JSON com campo 'resumo'."},
        {"role": "user", "content": f"Mês {body.mes}/{body.ano}: receitas R${body.total_receitas:.2f}, despesas R${body.total_despesas:.2f}, saldo R${body.saldo:.2f}. Top categorias: {body.top_categorias}"},
    ]
    try:
        raw = await chat_completion(messages, model=settings.openai_model_mini)
        return json.loads(raw)
    except Exception as exc:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail=str(exc))
