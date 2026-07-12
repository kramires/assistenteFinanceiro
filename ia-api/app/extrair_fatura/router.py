import json

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from app.clients.openai_client import chat_completion
from app.config import settings

router = APIRouter(tags=["extrair_fatura"])


class ExtrairFaturaRequest(BaseModel):
    texto: str
    ano: int
    mes_referencia: str


@router.post("/extrair-fatura")
async def extrair_fatura(body: ExtrairFaturaRequest):
    system_prompt = (
        "Você extrai transações de faturas de cartão de crédito brasileiras. "
        "Retorne SOMENTE compras/débitos (valores positivos). "
        "IGNORE: SALDO FATURA ANTERIOR, Pagamentos, Créditos, IOF, Tarifas, encargos. "
        "Datas no formato DD/MM — converta para YYYY-MM-DD usando o ano fornecido. "
        "Parcelamentos BB aparecem como 'DESCRICAO 02/12' (parcela/total) no final da linha. "
        "Retorne JSON válido: "
        '{"transacoes": [{"data":"YYYY-MM-DD","descricao":"...","valor":0.0,'
        '"parcela_atual":null,"total_parcelas":null}], "vencimento":"YYYY-MM-DD"}'
    )
    messages = [
        {"role": "system", "content": system_prompt},
        {
            "role": "user",
            "content": (
                f"Ano de referência: {body.ano}\n"
                f"Mês: {body.mes_referencia}\n\n"
                f"Texto da fatura:\n{body.texto[:100000]}"
            ),
        },
    ]
    try:
        raw = await chat_completion(messages, model=settings.openai_model)
        return json.loads(raw)
    except json.JSONDecodeError:
        raise HTTPException(status_code=422, detail="IA retornou JSON inválido.")
    except Exception as exc:
        raise HTTPException(status_code=503, detail=str(exc))
