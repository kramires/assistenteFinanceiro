import re
from datetime import date
from decimal import Decimal

from fastapi import APIRouter, Depends, Form, HTTPException, UploadFile, status

_MES_RE = re.compile(r"^\d{4}-(0[1-9]|1[0-2])$")
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.service import get_current_user
from app.database import get_db
from app.faturas import service as fatura_svc
from app.faturas.repository import FaturaRepository
from app.faturas.schemas import (
    AddLancamentoRequest,
    FaturaResponse,
    FaturaResumo,
    LancamentoFaturaResponse,
    PagarFaturaRequest,
    PatchLancamentoRequest,
)

router = APIRouter(tags=["faturas"])


def _meses_range(n: int) -> list[str]:
    """Retorna os últimos n meses no formato YYYY-MM, do mais antigo ao mais recente."""
    from datetime import date as _date
    today = _date.today()
    result = []
    for i in range(n - 1, -1, -1):
        y, m = today.year, today.month - i
        while m <= 0:
            m += 12
            y -= 1
        result.append(f"{y:04d}-{m:02d}")
    return result


# ── rotas estáticas ANTES das parametrizadas ──────────────────────────────────


@router.get("/faturas/parcelas-futuras")
async def parcelas_futuras(
    meses: int = 6,
    db: AsyncSession = Depends(get_db),
    _: str = Depends(get_current_user),
):
    repo = FaturaRepository(db)
    rows = await repo.listar_lancamentos_parcelados()

    # De-duplicate: for each unique purchase, keep only the most-recent installment
    # to avoid projecting the same future month from multiple fatura imports.
    best: dict[tuple, object] = {}
    for row in rows:
        lf = row.LancamentoFatura
        key = (lf.descricao, lf.total_parcelas, round(float(lf.valor)))
        existing = best.get(key)
        if existing is None or lf.parcela_atual > existing.LancamentoFatura.parcela_atual:  # type: ignore[union-attr]
            best[key] = row
    rows = list(best.values())

    hoje = date.today()
    mes_base = date(hoje.year, hoje.month, 1)

    agregado: dict[str, dict[str, float]] = {}
    for i in range(meses):
        m = _add_months(mes_base, i + 1)
        agregado[_fmt_mes(m)] = {}

    for row in rows:
        lf = row.LancamentoFatura
        mes_ref = row.mes_referencia
        cartao_nome = row.cartao_nome
        valor = float(lf.valor)
        restantes = (lf.total_parcelas or 0) - (lf.parcela_atual or 0)

        try:
            ano, mes = mes_ref.split("-")
            base = date(int(ano), int(mes), 1)
        except (ValueError, AttributeError):
            continue

        for i in range(1, restantes + 1):
            futuro = _add_months(base, i)
            chave = _fmt_mes(futuro)
            if chave in agregado:
                agregado[chave].setdefault(cartao_nome, 0.0)
                agregado[chave][cartao_nome] += valor

    return [
        {
            "mes": mes,
            "total": round(sum(v for v in cartoes.values()), 2),
            "por_cartao": [
                {"cartao": c, "total": round(v, 2)} for c, v in sorted(cartoes.items())
            ],
        }
        for mes, cartoes in sorted(agregado.items())
    ]


@router.get("/faturas/evolucao-mensal")
async def evolucao_mensal_cartoes(
    meses: int = 6,
    db: AsyncSession = Depends(get_db),
    _: str = Depends(get_current_user),
):
    """Retorna o total de gastos no cartão por mês nos últimos N meses."""
    repo = FaturaRepository(db)
    resultado = []
    for mes_str in _meses_range(min(max(meses, 1), 24)):
        rows = await repo.listar_lancamentos_por_mes(mes_str)
        total = round(sum(float(r.LancamentoFatura.valor) for r in rows), 2)
        por_cat: dict[str, float] = {}
        for r in rows:
            cat = r.categoria_nome or "Outros"
            por_cat[cat] = round(por_cat.get(cat, 0.0) + float(r.LancamentoFatura.valor), 2)
        resultado.append({
            "mes": mes_str,
            "total": total,
            "por_categoria": sorted(
                [{"categoria": k, "total": v} for k, v in por_cat.items()],
                key=lambda x: x["total"],
                reverse=True,
            ),
        })
    return resultado


@router.post("/faturas/recategorizar-outros", status_code=200)
async def recategorizar_outros(
    db: AsyncSession = Depends(get_db),
    _: str = Depends(get_current_user),
):
    """Re-executa categorização em todos os lançamentos com categoria 'Outros' ou sem categoria."""
    import asyncio
    from sqlalchemy import text

    from app.categorias.repository import CategoriaRepository
    from app.extrato.service import _heuristic
    from app.faturas import service as svc_fat

    cat_repo = CategoriaRepository(db)
    cats_list = await cat_repo.listar()
    categorias = {c.nome: c.id for c in cats_list}

    result = await db.execute(text("""
        SELECT lf.id, lf.descricao
        FROM lancamentos_fatura lf
        LEFT JOIN categorias c ON lf.categoria_id = c.id
        WHERE c.nome = 'Outros' OR lf.categoria_id IS NULL
    """))
    items = result.all()

    sem = asyncio.Semaphore(svc_fat._CATEGORIZE_CONCURRENCY)
    atualizados = 0

    for item in items:
        # Heurística primeiro
        cat_nome = _heuristic(item.descricao)
        if cat_nome == "Outros":
            # IA como fallback
            cat_nome = await svc_fat._categorizar(item.descricao, list(categorias.keys()), sem) or "Outros"

        if cat_nome and cat_nome != "Outros":
            cat_id = categorias.get(cat_nome)
            if cat_id:
                await db.execute(
                    text("UPDATE lancamentos_fatura SET categoria_id = :cid WHERE id = :id"),
                    {"cid": cat_id, "id": item.id},
                )
                atualizados += 1

    await db.commit()
    return {"atualizados": atualizados, "total_outros": len(items)}


@router.get("/faturas/dashboard")
async def dashboard_cartoes(
    mes: str | None = None,
    db: AsyncSession = Depends(get_db),
    _: str = Depends(get_current_user),
):
    if not mes:
        hoje = date.today()
        mes = f"{hoje.year:04d}-{hoje.month:02d}"

    repo = FaturaRepository(db)
    rows = await repo.listar_lancamentos_por_mes(mes)
    abertas = await repo.listar_faturas_abertas()

    por_categoria: dict[str, float] = {}
    por_cartao: dict[str, float] = {}
    total = 0.0

    for row in rows:
        lf = row.LancamentoFatura
        cat = row.categoria_nome or "Sem categoria"
        cartao = row.cartao_nome
        v = float(lf.valor)
        por_categoria[cat] = por_categoria.get(cat, 0.0) + v
        por_cartao[cartao] = por_cartao.get(cartao, 0.0) + v
        total += v

    return {
        "mes": mes,
        "total_geral": round(total, 2),
        "por_categoria": [
            {"categoria": k, "total": round(v, 2)}
            for k, v in sorted(por_categoria.items(), key=lambda x: x[1], reverse=True)
        ],
        "por_cartao": [
            {"cartao": k, "total": round(v, 2)}
            for k, v in sorted(por_cartao.items(), key=lambda x: x[1], reverse=True)
        ],
        "faturas_abertas": [
            {
                "id": r.FaturaCartao.id,
                "cartao": r.cartao_nome,
                "mes_referencia": r.FaturaCartao.mes_referencia,
                "vencimento": r.FaturaCartao.data_vencimento.isoformat() if r.FaturaCartao.data_vencimento else None,
                "valor_total": float(r.FaturaCartao.valor_total),
            }
            for r in abertas
        ],
    }


# ── listagem ──────────────────────────────────────────────────────────────────


@router.get("/faturas", response_model=list[FaturaResumo])
async def listar_faturas(
    cartao_id: int | None = None,
    mes: str | None = None,
    db: AsyncSession = Depends(get_db),
    _: str = Depends(get_current_user),
):
    repo = FaturaRepository(db)
    rows = await repo.listar(cartao_id=cartao_id, mes=mes)
    result = []
    for row in rows:
        f = row.FaturaCartao
        result.append(
            FaturaResumo(
                id=f.id,
                cartao_id=f.cartao_id,
                cartao_nome=row.cartao_nome,
                mes_referencia=f.mes_referencia,
                data_vencimento=f.data_vencimento,
                valor_total=float(f.valor_total),
                status=f.status,
                total_lancamentos=row.total_lancamentos,
            )
        )
    return result


# ── importação ────────────────────────────────────────────────────────────────


@router.post("/faturas/importar", status_code=201)
async def importar_fatura(
    file: UploadFile,
    cartao_id: int = Form(...),
    mes_referencia: str = Form(...),
    data_vencimento: str | None = Form(None),
    substituir: bool = Form(False),
    ignorar_validacao: bool = Form(False),
    db: AsyncSession = Depends(get_db),
    _: str = Depends(get_current_user),
):
    if not _MES_RE.match(mes_referencia):
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="mes_referencia deve estar no formato YYYY-MM (ex: 2026-06)",
        )

    content = await file.read()
    filename = (file.filename or "").lower()

    vencimento: date | None = None
    if data_vencimento:
        try:
            vencimento = date.fromisoformat(data_vencimento)
        except ValueError:
            pass

    try:
        if filename.endswith(".csv"):
            return await fatura_svc.importar_csv(
                content, cartao_id, mes_referencia, vencimento, db, substituir=substituir
            )
        elif filename.endswith(".pdf"):
            return await fatura_svc.importar_pdf(
                content, cartao_id, mes_referencia, vencimento, db,
                substituir=substituir, ignorar_validacao=ignorar_validacao,
            )
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=str(exc),
        )

    raise HTTPException(
        status_code=status.HTTP_415_UNSUPPORTED_MEDIA_TYPE,
        detail="Arquivo deve ser .csv ou .pdf",
    )


# ── detalhe ───────────────────────────────────────────────────────────────────


@router.get("/faturas/{id}", response_model=FaturaResponse)
async def detalhe_fatura(
    id: int,
    db: AsyncSession = Depends(get_db),
    _: str = Depends(get_current_user),
):
    repo = FaturaRepository(db)
    row = await repo.get_com_cartao(id)
    if not row:
        raise HTTPException(status_code=404, detail="Fatura não encontrada.")

    f, cartao_nome = row.FaturaCartao, row.cartao_nome
    lancamentos_rows = await repo.listar_lancamentos(id)

    lancamentos = [
        LancamentoFaturaResponse(
            id=lr.LancamentoFatura.id,
            data=lr.LancamentoFatura.data,
            descricao=lr.LancamentoFatura.descricao,
            valor=float(lr.LancamentoFatura.valor),
            categoria_id=lr.LancamentoFatura.categoria_id,
            categoria_nome=lr.categoria_nome,
            parcela_atual=lr.LancamentoFatura.parcela_atual,
            total_parcelas=lr.LancamentoFatura.total_parcelas,
        )
        for lr in lancamentos_rows
    ]

    return FaturaResponse(
        id=f.id,
        cartao_id=f.cartao_id,
        cartao_nome=cartao_nome,
        mes_referencia=f.mes_referencia,
        data_fechamento=f.data_fechamento,
        data_vencimento=f.data_vencimento,
        valor_total=float(f.valor_total),
        status=f.status,
        saldo_parcelado=float(f.saldo_parcelado),
        lancamentos=lancamentos,
    )


@router.put("/faturas/{id}/pagar")
async def pagar_fatura(
    id: int,
    body: PagarFaturaRequest,
    db: AsyncSession = Depends(get_db),
    _: str = Depends(get_current_user),
):
    result = await fatura_svc.pagar_fatura(id, body.data_pagamento, body.categoria_id, db)
    if not result:
        raise HTTPException(status_code=404, detail="Fatura não encontrada.")
    return result


@router.patch("/faturas/lancamentos/{lancamento_id}")
async def atualizar_lancamento(
    lancamento_id: int,
    body: PatchLancamentoRequest,
    db: AsyncSession = Depends(get_db),
    _: str = Depends(get_current_user),
):
    repo = FaturaRepository(db)
    lf = await repo.get_lancamento(lancamento_id)
    if not lf:
        raise HTTPException(status_code=404, detail="Lançamento não encontrado.")
    fatura_id = lf.fatura_id
    if "categoria_id" in body.model_fields_set:
        lf.categoria_id = body.categoria_id
    if body.descricao is not None:
        lf.descricao = body.descricao[:255]
    if body.valor is not None:
        lf.valor = body.valor
    if body.data is not None:
        lf.data = body.data
    await db.commit()
    await repo.recalcular_total(fatura_id)
    return {"id": lf.id, "categoria_id": lf.categoria_id}


@router.delete("/faturas/lancamentos/{lancamento_id}", status_code=204)
async def deletar_lancamento(
    lancamento_id: int,
    db: AsyncSession = Depends(get_db),
    _: str = Depends(get_current_user),
):
    repo = FaturaRepository(db)
    lf = await repo.get_lancamento(lancamento_id)
    if not lf:
        raise HTTPException(status_code=404, detail="Lançamento não encontrado.")
    fatura_id = lf.fatura_id
    await db.delete(lf)
    await db.commit()
    await repo.recalcular_total(fatura_id)


@router.post("/faturas/{fatura_id}/lancamentos", status_code=201)
async def adicionar_lancamento(
    fatura_id: int,
    body: AddLancamentoRequest,
    db: AsyncSession = Depends(get_db),
    _: str = Depends(get_current_user),
):
    repo = FaturaRepository(db)
    row = await repo.get_com_cartao(fatura_id)
    if not row:
        raise HTTPException(status_code=404, detail="Fatura não encontrada.")
    lf = await repo.criar_lancamento_unico(
        fatura_id, body.data, body.descricao, body.valor, body.categoria_id,
        parcela_atual=body.parcela_atual, total_parcelas=body.total_parcelas,
    )
    await db.commit()
    await repo.recalcular_total(fatura_id)
    return {"id": lf.id}


# ── helpers ───────────────────────────────────────────────────────────────────


def _add_months(d: date, n: int) -> date:
    mes = d.month + n
    ano = d.year + (mes - 1) // 12
    mes = (mes - 1) % 12 + 1
    return date(ano, mes, 1)


def _fmt_mes(d: date) -> str:
    return f"{d.year:04d}-{d.month:02d}"
