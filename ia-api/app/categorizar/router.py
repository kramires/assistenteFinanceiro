import json
from fastapi import APIRouter, HTTPException, status
from pydantic import BaseModel

from app.clients.openai_client import chat_completion
from app.config import settings

router = APIRouter(tags=["categorizar"])

_SYSTEM_PROMPT = """Você é um classificador especialista em transações financeiras brasileiras.
Dado o nome de uma transação de cartão de crédito ou extrato bancário, escolha EXATAMENTE UMA categoria da lista fornecida.

Regras de prioridade (do mais específico ao mais geral):
1. iFood, 99Food, Rappi, Uber Eats, James Delivery, Aiqfome, McDonald's delivery → Delivery
2. Netflix, Spotify, Disney+, Prime Video, Amazon Prime, Globoplay, Max, HBO, Paramount+, Apple TV+, Apple One, Apple Music, Crunchyroll, YouTube Premium, Star+, Deezer, Microsoft 365, Office 365 → Streamings
3. Uber, 99 Pop, 99 Taxi, Cabify, InDriver, táxi → Transporte Alternativo
4. Farmácia, Drogaria, Ultrafarma, Pacheco, Pague Menos, Raia, Drogasil, Droga Raia, São João → Farmácia
5. Smartfit, Bluefit, Academia, Crossfit, Bodytech, Bio Ritmo → Academia
6. Posto, Combustível, Shell, Ipiranga, Petrobras, BR Distribuidora, Ale Combustíveis → Combustível
7. Vivo, Claro, TIM, Oi, Net, Sky, Embratel, GVT → Telefone/Internet
8. Supermercado, Carrefour, Extra, Assaí, Atacadão, Pão de Açúcar, Hortifruti, Sam's Club, Costco, Bistek, BIG → Supermercado
9. Restaurante, Lanchonete, Padaria, Pizzaria, Sushi, Churrascaria, Bar (sem ser app de delivery) → Restaurante
10. Uber escolar, transporte escolar → Transporte Escolar
11. Salário, folha, proventos, FGTS, rescisão → Salário
12. Dividendos, JCP, rendimentos de ações, FII → Dividendos
13. Boleto, DARF, GRU, tributo, imposto, taxa → Boletos
14. Seguro de vida, seguro auto, seguro residencial → Seguros
15. IOF, juros, multa, tarifa bancária → Juros/IOF
16. Investimento, CDB, LCI, LCA, tesouro, ações, FII → Investimentos
17. Aluguel, condomínio, IPTU, luz, água, gás (conta de serviço) → Moradia
18. Roupa, calçado, Renner, Riachuelo, C&A, Zara, Nike, Adidas → Vestuário
19. Escola, curso, faculdade, mensalidade educacional → Educação
20. Consulta médica, hospital, clínica, plano de saúde, Unimed → Saúde
21. Salão, barbearia, manicure, estética, Beauty → Beleza
22. Cinema, show, teatro, parque, viagem, hotel → Lazer
23. Pix recebido sem identificação clara → Pix (se existir) ou Outros
24. Qualquer outro caso → Outros

Retorne SOMENTE o JSON a seguir, sem texto adicional:
{"categoria": "NomeDaCategoria"}"""


class CategorizarRequest(BaseModel):
    descricao: str
    categorias: list[str] = []


@router.post("/categorizar")
async def categorizar(body: CategorizarRequest):
    cats = "\n".join(f"- {c}" for c in body.categorias) if body.categorias else "- Outros"
    messages = [
        {"role": "system", "content": _SYSTEM_PROMPT},
        {
            "role": "user",
            "content": (
                f"Categorias disponíveis:\n{cats}\n\n"
                f"Transação: {body.descricao}\n\n"
                "Responda com JSON: {\"categoria\": \"...\"}"
            ),
        },
    ]
    try:
        raw = await chat_completion(messages, model=settings.openai_model_mini)
        data = json.loads(raw)
        # Garante que a categoria retornada existe na lista enviada
        if body.categorias and data.get("categoria") not in body.categorias:
            data["categoria"] = "Outros"
        return data
    except Exception as exc:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail=str(exc))
