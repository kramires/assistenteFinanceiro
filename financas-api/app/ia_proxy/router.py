"""
Proxy para ia-api: extrai dados via IA e persiste no DB.
Mantém o frontend usando um único host (financas-api /api/*) com JWT.
"""
import httpx
from decimal import Decimal, InvalidOperation
from datetime import date

from fastapi import APIRouter, Depends, HTTPException, UploadFile, status
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.service import get_current_user
from app.categorias.repository import CategoriaRepository
from app.categorias.service import CategoriaService
from app.config import settings
from app.database import get_db
from app.domain.transporte import TRANSPORTE_APP_EXCLUIR_DASHBOARD
from app.transacoes.schemas import TransacaoCreate
from app.transacoes.service import TransacaoService

router = APIRouter(tags=["ia-proxy"])


class LancarTextoRequest(BaseModel):
    texto: str


async def _salvar_dados_ia(dados: dict, db: AsyncSession) -> dict:
    """Resolve category + persist transaction from IA-extracted dict."""
    descricao = (dados.get("descricao") or "").strip()[:255]
    try:
        valor = Decimal(str(dados.get("valor", 0)))
    except InvalidOperation:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Valor inválido retornado pela IA.")

    if not descricao or valor == 0:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="IA não extraiu dados suficientes.")

    data_str = dados.get("data") or date.today().isoformat()
    try:
        tx_date = date.fromisoformat(data_str)
    except ValueError:
        tx_date = date.today()

    cat_repo = CategoriaRepository(db)
    cat_svc = CategoriaService(cat_repo)

    categoria_nome = (dados.get("categoria") or "Outros").strip()
    if categoria_nome.lower() in TRANSPORTE_APP_EXCLUIR_DASHBOARD:
        cat = await cat_svc.normalizar_transporte()
        categoria_nome = cat.nome

    tipo = "rendimento" if valor > 0 else "despesa"
    categoria = await cat_svc.obter_ou_criar(categoria_nome, tipo)

    tx_svc = TransacaoService(db)
    body = TransacaoCreate(
        data=tx_date,
        descricao=descricao,
        valor=valor,
        categoria_id=categoria.id,
        origem=dados.get("origem"),
        destino=dados.get("destino"),
    )
    tx = await tx_svc.criar(body)
    return {"id": tx.id, "descricao": tx.descricao, "valor": float(tx.valor), "data": tx.data.isoformat()}


@router.post("/ia/lancar-texto")
async def lancar_texto(
    body: LancarTextoRequest,
    db: AsyncSession = Depends(get_db),
    _: str = Depends(get_current_user),
):
    cat_repo = CategoriaRepository(db)
    categorias = [c.nome for c in await cat_repo.listar()]

    async with httpx.AsyncClient(timeout=30.0) as client:
        try:
            resp = await client.post(
                f"{settings.ia_api_url}/ia/lancar-texto",
                json={"texto": body.texto, "categorias": categorias},
            )
            resp.raise_for_status()
            dados = resp.json()
        except httpx.HTTPError as exc:
            raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail=f"IA indisponível: {exc}")

    if not dados:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="IA não conseguiu extrair informações do texto.")

    return await _salvar_dados_ia(dados, db)


@router.post("/ia/lancar-audio")
async def lancar_audio(
    file: UploadFile,
    db: AsyncSession = Depends(get_db),
    _: str = Depends(get_current_user),
):
    form_data = {"file": (file.filename or "audio.webm", await file.read(), file.content_type)}

    async with httpx.AsyncClient(timeout=60.0) as client:
        try:
            resp = await client.post(
                f"{settings.ia_api_url}/ia/lancar-audio",
                files=form_data,
            )
            resp.raise_for_status()
            dados = resp.json()
        except httpx.HTTPError as exc:
            raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail=f"IA indisponível: {exc}")

    if not dados:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="IA não conseguiu extrair dados do áudio.")

    return await _salvar_dados_ia(dados, db)


@router.post("/nota/upload")
async def nota_upload(
    file: UploadFile,
    db: AsyncSession = Depends(get_db),
    _: str = Depends(get_current_user),
):
    form_data = {"file": (file.filename, await file.read(), file.content_type)}

    async with httpx.AsyncClient(timeout=60.0) as client:
        try:
            resp = await client.post(
                f"{settings.ia_api_url}/ia/nota/upload",
                files=form_data,
            )
            resp.raise_for_status()
            dados = resp.json()
        except httpx.HTTPError as exc:
            raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail=f"IA indisponível: {exc}")

    if not dados:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="IA não conseguiu extrair dados da nota.")

    return await _salvar_dados_ia(dados, db)
