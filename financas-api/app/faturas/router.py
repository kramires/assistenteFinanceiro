from datetime import date
from decimal import Decimal

from fastapi import APIRouter, Depends, Form, HTTPException, UploadFile, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.service import get_current_user
from app.database import get_db
from app.faturas import service as fatura_svc
from app.faturas.repository import FaturaRepository
from app.faturas.schemas import (
    FaturaResponse,
    FaturaResumo,
    LancamentoFaturaResponse,
    PagarFaturaRequest,
    PatchLancamentoRequest,
)

router = APIRouter(tags=["faturas"])


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
    db: AsyncSession = Depends(get_db),
    _: str = Depends(get_current_user),
):
    content = await file.read()
    filename = (file.filename or "").lower()

    vencimento: date | None = None
    if data_vencimento:
        try:
            vencimento = date.fromisoformat(data_vencimento)
        except ValueError:
            pass

    if filename.endswith(".csv"):
        return await fatura_svc.importar_csv(content, cartao_id, mes_referencia, vencimento, db)
    elif filename.endswith(".pdf"):
        return await fatura_svc.importar_pdf(content, cartao_id, mes_referencia, vencimento, db)
    else:
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
    lf.categoria_id = body.categoria_id
    await db.commit()
    return {"id": lf.id, "categoria_id": lf.categoria_id}


# ── helpers ───────────────────────────────────────────────────────────────────


def _add_months(d: date, n: int) -> date:
    mes = d.month + n
    ano = d.year + (mes - 1) // 12
    mes = (mes - 1) % 12 + 1
    return date(ano, mes, 1)


def _fmt_mes(d: date) -> str:
    return f"{d.year:04d}-{d.month:02d}"
