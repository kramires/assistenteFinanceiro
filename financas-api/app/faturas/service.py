import asyncio
import re
from datetime import date
from decimal import Decimal

import httpx
from sqlalchemy.ext.asyncio import AsyncSession

from app.cartoes.repository import CartaoRepository
from app.categorias.repository import CategoriaRepository
from app.categorias.service import CategoriaService
from app.config import settings
from app.faturas.parsers import bb_pdf, nubank_csv
from app.faturas.repository import FaturaRepository
from app.transacoes.schemas import TransacaoCreate
from app.transacoes.service import TransacaoService


_CATEGORIZE_CONCURRENCY = 5


def _brl(valor) -> str:
    """Valor em reais no formato brasileiro (R$ 1.234,56)."""
    texto = f"{abs(float(valor)):,.2f}".replace(",", "X").replace(".", ",").replace("X", ".")
    return f"R$ {texto}"


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
    # PDF não pode mesclar com fatura existente: a IA descreve os mesmos lançamentos de
    # forma diferente a cada leitura, e a deduplicação por descrição gravaria duplicatas.
    if not substituir:
        existente = await FaturaRepository(db).buscar_por_cartao_mes(cartao_id, mes_referencia)
        if existente:
            raise ValueError(
                f"A fatura de {mes_referencia} deste cartão já foi importada "
                f"(R$ {existente.valor_total:.2f}). Nada foi alterado. "
                f"Para reimportar, exclua a fatura antes ou use a opção substituir."
            )

    result = await bb_pdf.parse(content, mes_referencia)
    lancamentos_raw = result.get("transacoes", [])

    # ── Validação: soma extraída pela IA deve bater com o total impresso no PDF ──
    # Esperado = Total − Saldo anterior + Pagamentos/Créditos; sem esses dados, usa o Total.
    total_pdf = result.get("total_pdf")
    esperado = result.get("total_debitos_pdf")
    if esperado is None:
        esperado = total_pdf
    if esperado is not None and not ignorar_validacao:
        soma = round(sum(float(l.get("valor", 0)) for l in lancamentos_raw), 2)
        if abs(soma - esperado) > 0.05:
            raise ValueError(
                f"Extração divergente: os {len(lancamentos_raw)} lançamentos extraídos somam "
                f"R$ {soma:.2f}, mas os débitos da fatura somam R$ {esperado:.2f} "
                f"(total impresso R$ {total_pdf:.2f}, descontados saldo anterior e pagamentos). "
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
    forcar: bool = False,
) -> dict:
    repo = FaturaRepository(db)
    row = await repo.get_com_cartao(fatura_id)
    if not row:
        return {}

    fatura, cartao_nome = row.FaturaCartao, row.cartao_nome

    # Duplo clique no botão gerava dois pagamentos (despesa contada em dobro)
    if fatura.transacao_pagamento_id is not None or fatura.status == "paga":
        raise ValueError(f"A fatura {cartao_nome} {fatura.mes_referencia} já está paga.")

    # O pagamento pode já existir como lançamento importado do extrato bancário
    # ("Pagto cartão crédito"): gravar outro contaria a mesma despesa duas vezes.
    referencia = data_pagamento or fatura.data_vencimento or date.today()
    if not forcar:
        existente = await repo.buscar_pagamento_equivalente(fatura.valor_total, referencia)
        if existente is not None:
            raise ValueError(
                f"Já existe o lançamento \"{existente.descricao}\" de "
                f"{_brl(abs(Decimal(str(existente.valor))))} em "
                f"{existente.data.strftime('%d/%m/%Y')}, que parece ser o pagamento desta "
                f"fatura importado do extrato. Marcar a fatura como paga agora contaria a "
                f"despesa duas vezes no saldo do mês. Confira o lançamento em "
                f"Movimentações — se for outro pagamento, repita a operação com forçar."
            )

    if categoria_id is None:
        categoria = await CategoriaService(CategoriaRepository(db)).obter_ou_criar(
            "Cartão de Crédito", "despesa"
        )
        categoria_id = categoria.id

    tx_svc = TransacaoService(db)
    body = TransacaoCreate(
        # Sem data informada, o pagamento entra no vencimento (não no dia do clique),
        # para cair no mês certo do dashboard.
        data=referencia,
        descricao=f"Fatura {cartao_nome} {fatura.mes_referencia}",
        valor=-abs(fatura.valor_total),  # pagamento de fatura é sempre despesa (saída de dinheiro)
        categoria_id=categoria_id,
        origem="fatura",
    )
    tx = await tx_svc.criar(body)

    await repo.marcar_paga(fatura_id, tx.id)
    return {"transacao_id": tx.id, "valor": float(fatura.valor_total)}


# ── Importação automática (Discord): detecta cartão e mês pelo próprio arquivo ──

_NUBANK_CSV_RE = re.compile(r"(\d{4})-(\d{2})-(\d{2})")


def _mes_anterior(d: date) -> str:
    """Convenção do sistema: mês de referência = mês anterior ao vencimento."""
    ano, mes = (d.year, d.month - 1) if d.month > 1 else (d.year - 1, 12)
    return f"{ano:04d}-{mes:02d}"


async def importar_auto(
    content: bytes, filename: str, db: AsyncSession, substituir: bool = False
) -> dict:
    nome = filename.lower()
    cartoes = await CartaoRepository(db).listar()

    if nome.endswith(".pdf"):
        text = bb_pdf.extract_text(content)
        final = bb_pdf.detectar_final_cartao(text)
        vencimento = bb_pdf.detectar_vencimento(text)
        cartao = next((c for c in cartoes if final and c.final_numero == final), None)
        if not cartao:
            raise ValueError(
                f"Nenhum cartão cadastrado com final {final}." if final
                else "Não encontrei o final do cartão no PDF."
            )
    elif nome.endswith(".csv"):
        # Export do Nubank: "Nubank_2026-07-05.csv" (data = vencimento)
        m = _NUBANK_CSV_RE.search(nome)
        vencimento = date(int(m.group(1)), int(m.group(2)), int(m.group(3))) if m else None
        cartao = next((c for c in cartoes if "nubank" in c.nome.lower()), None)
        if not cartao:
            raise ValueError("Nenhum cartão Nubank cadastrado.")
    else:
        raise ValueError("Envie o PDF da fatura do BB ou o CSV do Nubank.")

    if not vencimento:
        raise ValueError("Não encontrei a data de vencimento no arquivo.")

    mes_referencia = _mes_anterior(vencimento)
    if nome.endswith(".pdf"):
        result = await importar_pdf(
            content, cartao.id, mes_referencia, vencimento, db, substituir=substituir
        )
    else:
        result = await importar_csv(
            content, cartao.id, mes_referencia, vencimento, db, substituir=substituir
        )
    return {**result, "cartao": cartao.nome, "data_vencimento": vencimento.isoformat()}
