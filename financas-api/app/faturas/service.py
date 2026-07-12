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

    # Heurística local primeiro (gratuita e rápida)
    from app.extrato.service import _heuristic
    heuristica = _heuristic(descricao)
    if heuristica != "Outros":
        cat_id = categorias.get(heuristica)
        cache[descricao] = cat_id
        return cat_id

    # IA como fallback para casos ambíguos
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
    substituir: bool = False,
) -> dict:
    lancamentos_raw = nubank_csv.parse(content)
    return await _persistir(
        lancamentos_raw, None, cartao_id, mes_referencia, data_vencimento, db,
        substituir=substituir,
    )


async def importar_pdf(
    content: bytes,
    cartao_id: int,
    mes_referencia: str,
    data_vencimento: date | None,
    db: AsyncSession,
    substituir: bool = False,
    ignorar_validacao: bool = False,
) -> dict:
    result = await bb_pdf.parse(content, mes_referencia)
    lancamentos_raw = result.get("transacoes", [])

    # ── Validação: soma extraída pela IA deve bater com o total impresso no PDF ──
    total_pdf = result.get("total_pdf")
    if total_pdf is not None and not ignorar_validacao:
        soma = round(sum(float(l.get("valor", 0)) for l in lancamentos_raw), 2)
        if abs(soma - total_pdf) > 0.05:
            raise ValueError(
                f"Extração divergente: os {len(lancamentos_raw)} lançamentos extraídos somam "
                f"R$ {soma:.2f}, mas o total impresso na fatura é R$ {total_pdf:.2f}. "
                f"Nada foi importado. Tente novamente ou envie ignorar_validacao=true para forçar."
            )

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

    return await _persistir(
        lancamentos_raw, None, cartao_id, mes_referencia, data_vencimento, db,
        substituir=substituir,
    )


def _chave_lancamento(l: dict) -> tuple:
    return (
        str(l["data"]),
        l["descricao"][:255],
        round(float(l["valor"]), 2),
        l.get("parcela_atual"),
    )


async def _categorizar_lote(
    lancamentos: list[dict],
    categorias: dict[str, int],
    sem: asyncio.Semaphore,
    cache: dict[str, int | None],
) -> None:
    tasks = [_resolver_categoria(l["descricao"], cache, categorias, sem) for l in lancamentos]
    cat_ids = await asyncio.gather(*tasks)
    for l, cat_id in zip(lancamentos, cat_ids):
        l["categoria_id"] = cat_id


async def _persistir(
    lancamentos_raw: list[dict],
    saldo_parcelado: Decimal | None,
    cartao_id: int,
    mes_referencia: str,
    data_vencimento: date | None,
    db: AsyncSession,
    substituir: bool = False,
) -> dict:
    cat_repo = CategoriaRepository(db)
    cats_list = await cat_repo.listar()
    categorias = {c.nome: c.id for c in cats_list}

    sem = asyncio.Semaphore(_CATEGORIZE_CONCURRENCY)
    cache: dict[str, int | None] = {}

    repo = FaturaRepository(db)
    fatura_existente = await repo.buscar_por_cartao_mes(cartao_id, mes_referencia)

    if fatura_existente and substituir:
        # ── Substituição: apaga tudo e regrava a fatura do zero ───────────────
        removidos = await repo.deletar_lancamentos(fatura_existente.id)
        await _categorizar_lote(lancamentos_raw, categorias, sem, cache)
        await repo.adicionar_lancamentos(fatura_existente.id, lancamentos_raw)

        valor_total = Decimal(str(sum(l["valor"] for l in lancamentos_raw)))
        total_parcelado = Decimal(str(sum(
            l["valor"] for l in lancamentos_raw
            if l.get("total_parcelas") and l.get("parcela_atual")
            and l["parcela_atual"] < l["total_parcelas"]
        )))
        await repo.atualizar_totais(fatura_existente.id, valor_total, saldo_parcelado or total_parcelado)

        return {
            "fatura_id": fatura_existente.id,
            "mes_referencia": mes_referencia,
            "total_lancamentos": len(lancamentos_raw),
            "valor_total": float(valor_total),
            "mensagem": (
                f"Fatura substituída: {removidos} lançamento(s) antigo(s) removido(s), "
                f"{len(lancamentos_raw)} novo(s) gravado(s)."
            ),
        }

    if fatura_existente:
        # ── Upsert: adiciona apenas lançamentos ainda não existentes ──────────
        chaves_existentes = await repo.listar_chaves_lancamentos(fatura_existente.id)
        novos = [l for l in lancamentos_raw if _chave_lancamento(l) not in chaves_existentes]

        if not novos:
            return {
                "fatura_id": fatura_existente.id,
                "mes_referencia": mes_referencia,
                "total_lancamentos": 0,
                "valor_total": float(fatura_existente.valor_total),
                "mensagem": "Fatura já atualizada. Nenhum lançamento novo encontrado.",
            }

        await _categorizar_lote(novos, categorias, sem, cache)
        await repo.adicionar_lancamentos(fatura_existente.id, novos)

        novo_valor = fatura_existente.valor_total + Decimal(str(sum(l["valor"] for l in novos)))
        novo_parcelado = fatura_existente.saldo_parcelado + Decimal(str(sum(
            l["valor"] for l in novos
            if l.get("total_parcelas") and l.get("parcela_atual")
            and l["parcela_atual"] < l["total_parcelas"]
        )))
        await repo.atualizar_totais(fatura_existente.id, novo_valor, novo_parcelado)

        return {
            "fatura_id": fatura_existente.id,
            "mes_referencia": mes_referencia,
            "total_lancamentos": len(novos),
            "valor_total": float(novo_valor),
            "mensagem": f"{len(novos)} novo(s) lançamento(s) adicionado(s). {len(chaves_existentes)} já existiam.",
        }

    # ── Fatura nova ───────────────────────────────────────────────────────────
    await _categorizar_lote(lancamentos_raw, categorias, sem, cache)

    valor_total = Decimal(str(sum(l["valor"] for l in lancamentos_raw)))
    total_parcelado = Decimal(str(sum(
        l["valor"] for l in lancamentos_raw
        if l.get("total_parcelas") and l.get("parcela_atual") and l["parcela_atual"] < l["total_parcelas"]
    )))

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
        "mensagem": f"Fatura criada com {len(lancamentos_raw)} lançamento(s).",
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
        valor=-abs(fatura.valor_total),  # pagamento de fatura é sempre despesa (saída de dinheiro)
        categoria_id=categoria_id,
        origem="fatura",
    )
    tx = await tx_svc.criar(body)

    await repo.marcar_paga(fatura_id, tx.id)
    return {"transacao_id": tx.id, "valor": float(fatura.valor_total)}
