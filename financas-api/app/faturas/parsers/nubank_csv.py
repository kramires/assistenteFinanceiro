import io
import re
from datetime import date

import pandas as pd


def _parse_amount(amount_str: str) -> float | None:
    s = str(amount_str).strip()
    if s.startswith("-") or s.startswith("- "):
        return None
    s = s.replace(".", "").replace(",", ".")
    try:
        return float(s)
    except ValueError:
        return None


def _parse_installment(title: str) -> tuple[str, int | None, int | None]:
    match = re.search(r"(\d+)/(\d+)\s*$", title)
    if not match:
        return title.strip(), None, None

    parcela_atual = int(match.group(1))
    total_parcelas = int(match.group(2))
    clean = re.sub(r"\s*[-–]?\s*(?:Parcela\s+)?(\d+)/(\d+)\s*$", "", title, flags=re.IGNORECASE).strip()
    return clean, parcela_atual, total_parcelas


def parse(content: bytes) -> list[dict]:
    df = pd.read_csv(io.BytesIO(content))
    df.columns = [c.strip().lower() for c in df.columns]

    transactions = []
    for _, row in df.iterrows():
        title = str(row.get("title", "")).strip()
        if not title or title.lower() in ("nan",):
            continue

        title_lower = title.lower()
        if "pagamento recebido" in title_lower or "pagamento efetuado" in title_lower:
            continue
        if title_lower.startswith("iof de"):
            continue

        amount = _parse_amount(str(row.get("amount", "")))
        if amount is None or amount <= 0:
            continue

        raw_date = str(row.get("date", "")).strip()
        try:
            tx_date = date.fromisoformat(raw_date)
        except ValueError:
            continue

        clean_title, parcela_atual, total_parcelas = _parse_installment(title)

        transactions.append(
            {
                "data": tx_date,
                "descricao": clean_title[:255],
                "valor": amount,
                "parcela_atual": parcela_atual,
                "total_parcelas": total_parcelas,
            }
        )

    return transactions
