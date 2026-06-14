import json
from datetime import date, timedelta

from app.clients.openai_client import chat_completion
from app.config import settings

_IGNORAR = {"bb rende fácil", "bb rende facil", "rende facil"}

_SYSTEM_PROMPT = """Você é um assistente financeiro. Extraia a transação do texto e retorne JSON com os campos:
- data: string YYYY-MM-DD
- descricao: string (max 255 chars)
- valor: number (negativo=despesa, positivo=receita)
- categoria: string (use uma das categorias fornecidas ou crie uma nova)
- origem: string ou null
- destino: string ou null

Hoje é {hoje}. "ontem" = {ontem}. Retorne apenas JSON válido."""


async def extrair_lancamento(texto: str, categorias: list[str]) -> dict:
    # BR-MIGRAR-026: ignorar BB Rende Fácil
    if any(ig in texto.lower() for ig in _IGNORAR):
        return {}

    hoje = date.today()
    ontem = hoje - timedelta(days=1)
    cats = ", ".join(categorias) if categorias else "Alimentação, Transporte, Salário, Outros"

    messages = [
        {
            "role": "system",
            "content": _SYSTEM_PROMPT.format(hoje=hoje.isoformat(), ontem=ontem.isoformat()),
        },
        {
            "role": "user",
            "content": f"Categorias disponíveis: {cats}\n\nTexto: {texto}",
        },
    ]
    raw = await chat_completion(messages, model=settings.openai_model)
    return json.loads(raw)
