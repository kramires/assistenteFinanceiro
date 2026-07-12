import io
import re

import httpx
import pdfplumber

from app.config import settings

# "Total da Fatura R$ 7.805,87" — âncora determinística no rodapé dos lançamentos
_TOTAL_RE = re.compile(r"Total\s+da\s+Fatura\s+R?\$?\s*([\d\.]+,\d{2})", re.IGNORECASE)


def extract_text(content: bytes) -> str:
    with pdfplumber.open(io.BytesIO(content)) as pdf:
        pages = [page.extract_text() or "" for page in pdf.pages]
    return "\n".join(pages)


def extrair_total(text: str) -> float | None:
    """Extrai o total da fatura direto do texto do PDF (sem IA)."""
    m = _TOTAL_RE.search(text)
    if not m:
        return None
    try:
        return float(m.group(1).replace(".", "").replace(",", "."))
    except ValueError:
        return None


async def parse(content: bytes, mes_referencia: str) -> dict:
    """Extract text from PDF and send to ia-api for GPT structured extraction."""
    text = extract_text(content)
    try:
        ano = int(mes_referencia.split("-")[0]) if mes_referencia else 2026
    except (ValueError, IndexError):
        ano = 2026

    async with httpx.AsyncClient(timeout=90.0) as client:
        resp = await client.post(
            f"{settings.ia_api_url}/ia/extrair-fatura",
            json={"texto": text, "ano": ano, "mes_referencia": mes_referencia},
        )
        resp.raise_for_status()
        result = resp.json()

    # Total lido deterministicamente do PDF, para validar a extração da IA
    result["total_pdf"] = extrair_total(text)
    return result
