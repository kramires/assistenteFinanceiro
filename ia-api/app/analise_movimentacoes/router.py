import json
import logging

from fastapi import APIRouter, HTTPException, status
from pydantic import BaseModel

from app.clients.openai_client import chat_completion
from app.config import settings

logger = logging.getLogger(__name__)

router = APIRouter(tags=["analise-movimentacoes"])

_SYSTEM_PROMPT = """Você é um consultor de finanças pessoais brasileiro, direto e prático.
Você recebe as movimentações reais do usuário (entradas positivas, saídas negativas) e responde
perguntas sobre elas. Baseie-se SOMENTE nos dados fornecidos: cite valores, datas e descrições
concretas, e diga quando os dados não bastam para responder. Não invente lançamentos.

Os dados juntam a conta bancária e as faturas dos cartões (a coluna "fonte" diz de onde veio
cada lançamento). O pagamento da fatura não é somado aos gastos, pois as compras do cartão já
aparecem uma a uma: nunca conte os dois.

Ao analisar, procure: gastos recorrentes e assinaturas, compras repetidas no mesmo lugar,
meses ou lançamentos fora do padrão, possíveis duplicidades, peso de cada categoria na renda,
uso do cartão e parcelas que comprometem os próximos meses, gasto com transporte por aplicativo
(frequência, valor médio por corrida e alternativas) e onde dá para economizar (com estimativa
em R$ por mês quando possível).
Referências: alimentação até 15% da renda, moradia até 30%, transporte até 15%,
lazer e assinaturas até 5-10%, poupança mínima de 10-20%.

Retorne SOMENTE este JSON, sem texto fora dele:
{
  "resposta": "resposta direta à pergunta, em 2 a 6 frases",
  "destaques": ["fato relevante com valor, ex.: 'iFood: R$ 820 em 14 pedidos'", "..."],
  "sugestoes": ["ação concreta e específica, com economia estimada quando der", "..."],
  "perguntas_sugeridas": ["próxima pergunta útil para aprofundar", "...", "..."]
}
Use listas vazias quando não houver o que pôr. Máximo de 6 itens em destaques e sugestões, 3 em perguntas_sugeridas."""

_PERGUNTA_PADRAO = "Faça uma análise geral dessas movimentações e diga o que posso melhorar."


class Troca(BaseModel):
    pergunta: str
    resposta: str


class AnaliseMovimentacoesRequest(BaseModel):
    contexto: str
    periodo: str
    categoria: str | None = None  # rótulo do recorte, ex.: "categoria Delivery · cartão Nubank"
    pergunta: str | None = None
    historico: list[Troca] = []


def _lista(valor) -> list[str]:
    return [str(v) for v in valor if v] if isinstance(valor, list) else []


@router.post("/analisar-movimentacoes")
async def analisar_movimentacoes(body: AnaliseMovimentacoesRequest):
    recorte = body.categoria or "todas as categorias"
    messages = [
        {"role": "system", "content": _SYSTEM_PROMPT},
        {
            "role": "user",
            "content": f"Dados das minhas movimentações ({body.periodo}, {recorte}):\n\n{body.contexto}",
        },
        {"role": "assistant", "content": '{"resposta": "Dados recebidos. Pode perguntar."}'},
    ]
    for troca in body.historico:
        messages.append({"role": "user", "content": troca.pergunta})
        messages.append({"role": "assistant", "content": json.dumps({"resposta": troca.resposta}, ensure_ascii=False)})
    messages.append({"role": "user", "content": body.pergunta or _PERGUNTA_PADRAO})

    try:
        raw = await chat_completion(messages, model=settings.openai_model)
        data = json.loads(raw)
    except Exception as exc:
        logger.warning("Falha na análise de movimentações: %r", exc)
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail="a IA não conseguiu gerar a análise.")

    return {
        "resposta": str(data.get("resposta") or ""),
        "destaques": _lista(data.get("destaques")),
        "sugestoes": _lista(data.get("sugestoes")),
        "perguntas_sugeridas": _lista(data.get("perguntas_sugeridas"))[:3],
    }
