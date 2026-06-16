import asyncio
from datetime import date
from decimal import Decimal

import httpx
from sqlalchemy.ext.asyncio import AsyncSession

from app.categorias.repository import CategoriaRepository
from app.config import settings
from app.faturas.parsers import bb_pdf, nubank_csv
from app.faturas.repository import FaturaRepository
from app.transacoes.schemas import TransacaoCreate
from app.transacoes.service import TransacaoService


_CATEGORIZE_CONCURRENCY = 5


async def _categorizar(descricao: str, cats: list[str], sem: asyncio.Semaphore) -> str | None:
    async with sem:
        try:
            async with httpx.AsyncClient(timeout=15.0) as client:
                resp = await client.post(
                    f"{settings.ia_api_url}/ia/categorizar",
                    json={"descricao": descricao, "categorias": cats},
                )
                if resp.status_code == 200:
                    return resp.json().get("categoria")
        except Exception:
            pass
    return None


async def _resolver_categoria(
    descricao: str,
    cache: dict[str, int | None],
    categorias: dict[str, int],
    sem: asyncio.Semaphore,
) -> int | None:
    if descricao in cache:
        return cache[descricao]

    nome = await _categorizar(descricao, list(categorias.keys()), sem)
    cat_id = categorias.get(nome) if nome else None
    cache[descricao] = cat_id
    return cat_id


async def importar_csv(
    content: bytes,
    cartao_id: int,
    mes_referencia: str,
    data_vencimento: date | None,
    db: AsyncSession,
) -> dict:
    lancamentos_raw = nubank_csv.parse(content)
    return await _persistir(lancamentos_raw, None, cartao_id, mes_referencia, data_vencimento, db)


async def importar_pdf(
    content: bytes,
    cartao_id: int,
    mes_referencia: str,
    data_vencimento: date | None,
    db: AsyncSession,
) -> dict:
    result = await bb_pdf.parse(content, mes_referencia)
    lancamentos_raw = result.get("transacoes", [])

    if not data_vencimento and result.get("vencimento"):
        try:
            data_vencimento = date.fromisoformat(result["vencimento"])
        except (ValueError, TypeError):
            pass

    for l in lancamentos_raw:
        if isinstance(l.get("data"), str):
            try:
                l["data"] = date.fromisoformat(l["data"])
            except ValueError:
                l["data"] = date.today()

    return await _persistir(lancamentos_raw, None, cartao_id, mes_referencia, data_vencimento, db)


async def _persistir(
    lancamentos_raw: list[dict],
    saldo_parcelado: Decimal | None,
    cartao_id: int,
    mes_referencia: str,
    data_vencimento: date | None,
    db: AsyncSession,
) -> dict:
    cat_repo = CategoriaRepository(db)
    cats_list = await cat_repo.listar()
    categorias = {c.nome: c.id for c in cats_list}

    sem = asyncio.Semaphore(_CATEGORIZE_CONCURRENCY)
    cache: dict[str, int | None] = {}

    tasks = [
        _resolver_categoria(l["descricao"], cache, categorias, sem)
        for l in lancamentos_raw
    ]
    cat_ids = await asyncio.gather(*tasks)

    for l, cat_id in zip(lancamentos_raw, cat_ids):
        l["categoria_id"] = cat_id

    valor_total = Decimal(str(sum(l["valor"] for l in lancamentos_raw)))
    total_parcelado = Decimal(str(sum(
        l["valor"] for l in lancamentos_raw
        if l.get("total_parcelas") and l.get("parcela_atual") and l["parcela_atual"] < l["total_parcelas"]
    )))

    repo = FaturaRepository(db)
    fatura = await repo.criar_fatura(
        cartao_id=cartao_id,
        mes_referencia=mes_referencia,
        data_fechamento=None,
        data_vencimento=data_vencimento,
        valor_total=valor_total,
        saldo_parcelado=saldo_parcelado or total_parcelado,
    )
    await repo.adicionar_lancamentos(fatura.id, lancamentos_raw)

    return {
        "fatura_id": fatura.id,
        "mes_referencia": mes_referencia,
        "total_lancamentos": len(lancamentos_raw),
        "valor_total": float(valor_total),
    }


async def pagar_fatura(
    fatura_id: int,
    data_pagamento: date | None,
    categoria_id: int | None,
    db: AsyncSession,
) -> dict:
    repo = FaturaRepository(db)
    row = await repo.get_com_cartao(fatura_id)
    if not row:
        return {}

    fatura, cartao_nome = row.FaturaCartao, row.cartao_nome

    tx_svc = TransacaoService(db)
    body = TransacaoCreate(
        data=data_pagamento or date.today(),
        descricao=f"Fatura {cartao_nome} {fatura.mes_referencia}",
        valor=fatura.valor_total,
        categoria_id=categoria_id,
        origem="fatura",
    )
    tx = await tx_svc.criar(body)

    await repo.marcar_paga(fatura_id, tx.id)
    return {"transacao_id": tx.id, "valor": float(fatura.valor_total)}
