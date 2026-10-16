import io
import re
from datetime import date

import httpx
import pdfplumber

from app.config import settings

# "Total da Fatura R$ 7.805,87" — âncora determinística no rodapé dos lançamentos
_TOTAL_RE = re.compile(r"Total\s+da\s+Fatura\s+R?\$?\s*([\d\.]+,\d{2})", re.IGNORECASE)
# Seção de lançamentos: começa em "SALDO FATURA ANTERIOR" (maiúsculas; o resumo do topo usa minúsculas)
_SALDO_RE = re.compile(r"SALDO FATURA ANTERIOR.*?R\$\s*(-?[\d\.]+,\d{2})")
# Pagamentos/créditos: valores negativos na seção de lançamentos
_NEGATIVO_RE = re.compile(r"R\$\s*-\s*([\d\.]+,\d{2})")


# Cabeçalho BB: "fatura de OUROCARD VISA INFINITE Final1234" / "Vencimento ... 05/10/2026"
_FINAL_RE = re.compile(r"Final\s*(\d{4})", re.IGNORECASE)
_VENCIMENTO_RE = re.compile(r"Vencimento\b.*?(\d{2})/(\d{2})/(\d{4})", re.DOTALL)


def detectar_final_cartao(text: str) -> str | None:
    m = _FINAL_RE.search(text)
    return m.group(1) if m else None


def detectar_vencimento(text: str) -> date | None:
    m = _VENCIMENTO_RE.search(text)
    if not m:
        return None
    try:
        return date(int(m.group(3)), int(m.group(2)), int(m.group(1)))
    except ValueError:
        return None


def _valor(s: str) -> float:
    return float(s.replace(".", "").replace(",", "."))


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
        return _valor(m.group(1))
    except ValueError:
        return None


def extrair_total_debitos(text: str) -> float | None:
    """Soma esperada dos débitos do mês: Total − Saldo anterior + Pagamentos/Créditos.

    O total impresso já desconta saldo anterior e pagamentos (ex.: pagamento a maior,
    parcelamento da fatura), então só bate com a soma da IA após esse ajuste.
    """
    total = extrair_total(text)
    m = _SALDO_RE.search(text)
    if total is None or not m:
        return None
    inicio = m.end()
    fim_m = _TOTAL_RE.search(text, inicio)
    secao = text[inicio : fim_m.start() if fim_m else len(text)]
    try:
        saldo = _valor(m.group(1))
        creditos = sum(_valor(v) for v in _NEGATIVO_RE.findall(secao))
    except ValueError:
        return None
    return round(total - saldo + creditos, 2)


async def parse(content: bytes, mes_referencia: str) -> dict:
    """Extract text from PDF and send to ia-api for GPT structured extraction."""
    text = extract_text(content)
    try:
        ano = int(mes_referencia.split("-")[0]) if mes_referencia else 2026
    except (ValueError, IndexError):
        ano = 2026

    # DeepSeek (até ~150s) + fallback OpenAI; nginx corta em 300s
    async with httpx.AsyncClient(timeout=280.0) as client:
        resp = await client.post(
            f"{settings.ia_api_url}/ia/extrair-fatura",
            json={"texto": text, "ano": ano, "mes_referencia": mes_referencia},
        )
        resp.raise_for_status()
        result = resp.json()

    # Total lido deterministicamente do PDF, para validar a extração da IA
    result["total_pdf"] = extrair_total(text)
    result["total_debitos_pdf"] = extrair_total_debitos(text)
    return result
