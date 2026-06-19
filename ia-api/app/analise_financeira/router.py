import json
from datetime import datetime

from fastapi import APIRouter, HTTPException, status
from pydantic import BaseModel

from app.clients.openai_client import chat_completion
from app.config import settings

router = APIRouter(tags=["analise-financeira"])

_SYSTEM_PROMPT = """Você é um consultor financeiro sênior especialista em finanças pessoais brasileiras.
Analise os dados financeiros fornecidos e gere uma análise profissional, detalhada e acionável.
Seja direto, assertivo e prático. Use linguagem clara.

Diretrizes de especialistas financeiros (use como referência):
- Regra 50/30/20: 50% necessidades básicas, 30% desejos/estilo de vida, 20% poupança/investimentos
- Alimentação total (mercado + restaurante + delivery): ideal até 15% da renda
- Moradia (aluguel + condomínio + IPTU): até 30% da renda
- Transporte: até 15% da renda
- Entretenimento e assinaturas: até 5% da renda
- Poupança/investimentos: mínimo 10-20% da renda
- Faturas de cartão idealmente abaixo de 30% da renda mensal

Retorne SOMENTE o seguinte JSON, sem texto adicional:
{
  "resumo_executivo": "2-3 frases sobre o estado financeiro geral do período",
  "nota_saude_financeira": número de 0 a 10,
  "pontos_de_atencao": ["situação preocupante 1 com valores específicos", "..."],
  "maiores_gastos_analise": ["análise do gasto 1 comparando com o ideal", "..."],
  "recomendacoes": ["ação concreta e específica 1", "..."],
  "meta_poupanca_sugerida": "valor em R$ e percentual baseado na renda detectada",
  "distribuicao_ideal": {"Alimentação": "15%", "Moradia": "30%", "Transporte": "15%", "Lazer": "10%", "Poupança": "20%", "Outros": "10%"}
}"""


class CategoriaGasto(BaseModel):
    categoria: str
    total: float
    percentual_renda: float


class MesGasto(BaseModel):
    mes: str
    total: float


class AnaliseRequest(BaseModel):
    periodo_descricao: str
    renda_mensal_media: float
    total_cartao_periodo: float
    media_mensal_cartao: float
    percentual_renda_em_cartao: float
    top_categorias: list[CategoriaGasto]
    evolucao_mensal: list[MesGasto]


@router.post("/analise-financeira")
async def analise_financeira(body: AnaliseRequest):
    top_cats_txt = "\n".join(
        f"  - {c.categoria}: R$ {c.total:.2f} no período ({c.percentual_renda:.1f}% da renda mensal)"
        for c in body.top_categorias
    )
    evolucao_txt = "\n".join(
        f"  - {m.mes}: R$ {m.total:.2f}"
        for m in body.evolucao_mensal
    )

    user_msg = f"""Período analisado: {body.periodo_descricao}
Renda mensal média (receitas): R$ {body.renda_mensal_media:.2f}

GASTOS NO CARTÃO DE CRÉDITO:
- Total no período: R$ {body.total_cartao_periodo:.2f}
- Média mensal: R$ {body.media_mensal_cartao:.2f}
- Representa {body.percentual_renda_em_cartao:.1f}% da renda mensal

TOP CATEGORIAS DE GASTO (cartão):
{top_cats_txt}

EVOLUÇÃO MENSAL DOS GASTOS NO CARTÃO:
{evolucao_txt}

Gere uma análise financeira profissional e acionável desses dados."""

    messages = [
        {"role": "system", "content": _SYSTEM_PROMPT},
        {"role": "user", "content": user_msg},
    ]

    try:
        raw = await chat_completion(messages, model=settings.openai_model)
        data = json.loads(raw)
        data["gerado_em"] = datetime.now().isoformat()
        return data
    except Exception as exc:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail=str(exc))
