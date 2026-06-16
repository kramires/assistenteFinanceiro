import io

import httpx
import pdfplumber

from app.config import settings


def extract_text(content: bytes) -> str:
    with pdfplumber.open(io.BytesIO(content)) as pdf:
        pages = [page.extract_text() or "" for page in pdf.pages]
    return "\n".join(pages)


async def parse(content: bytes, mes_referencia: str) -> dict:
    """Extract text from PDF and send to ia-api for GPT structured extraction."""
    text = extract_text(content)
    ano = int(mes_referencia.split("-")[0]) if mes_referencia else 2026

    async with httpx.AsyncClient(timeout=90.0) as client:
        resp = await client.post(
            f"{settings.ia_api_url}/ia/extrair-fatura",
            json={"texto": text, "ano": ano, "mes_referencia": mes_referencia},
        )
        resp.raise_for_status()
        return resp.json()
