import datetime
import io
from typing import Optional

import pandas as pd


# BR-033: flexible column aliases
_ALIASES: dict[str, list[str]] = {
    "Data": ["Data", "data", "Data Lançamento", "Data do Lançamento"],
    "Descricao": ["Lançamento", "Lancamento", "Histórico", "Historico", "Descrição", "Descricao"],
    "Detalhe": ["Detalhe", "Detalhes", "Complemento", "Detalhes do Lançamento"],
    "Valor": ["Valor", "valor", "Valor (R$)", "Valor Original", "Valor Final"],
    "Tipo": ["Tipo Lançamento", "Tipo Lancamento", "Tipo"],
}

_SKIP_PHRASES = frozenset(
    ["saldo do dia", "saldo anterior", "bb rende fácil", "rende facil", "bb rende facil"]
)


def _map_cols(columns: list[str]) -> dict[str, Optional[str]]:
    found: dict[str, Optional[str]] = {}
    for key, aliases in _ALIASES.items():
        found[key] = next((c for c in aliases if c in columns), None)
    return found


def _parse_data(s: str) -> Optional[datetime.date]:
    s = (s or "").strip()
    if not s or s == "00/00/0000":
        return None
    for fmt in ("%d/%m/%Y", "%d-%m-%Y", "%Y-%m-%d"):
        try:
            return datetime.datetime.strptime(s, fmt).date()
        except ValueError:
            continue
    return None


def _parse_valor(s: str) -> Optional[float]:
    texto = str(s or "").strip()
    if not texto:
        return None
    texto = texto.replace(".", "").replace(",", ".")
    try:
        v = float(texto)
        return v if v != 0.0 else None
    except ValueError:
        return None


def parse_csv(raw_bytes: bytes) -> list[dict]:
    """Return list of parsed row dicts ready for DB insertion. Raises ValueError on bad CSV."""
    # BR-031: latin1 encoding; BR-032: auto-detect separator
    buffer = io.StringIO(raw_bytes.decode("latin1", errors="replace"))
    try:
        df = pd.read_csv(buffer, sep=None, engine="python", header=0, dtype=str)
    except Exception as exc:
        raise ValueError(f"Erro ao ler CSV: {exc}") from exc

    col_map = _map_cols(list(df.columns))

    if not all(col_map[k] for k in ("Data", "Descricao", "Valor")):
        missing = [k for k in ("Data", "Descricao", "Valor") if not col_map[k]]
        raise ValueError(
            f"Colunas essenciais não encontradas ({missing}). "
            f"Colunas disponíveis: {list(df.columns)}"
        )

    rows = []
    for _, row in df.iterrows():
        data_str = str(row[col_map["Data"]] or "").strip()
        descricao = str(row[col_map["Descricao"]] or "").strip()
        detalhe = str(row[col_map["Detalhe"]] or "").strip() if col_map["Detalhe"] else ""
        valor_str = str(row[col_map["Valor"]] or "").strip()

        # BR-034: skip header/balance rows
        texto = f"{descricao} {detalhe}".lower()
        if not descricao or any(p in texto for p in _SKIP_PHRASES):
            continue

        data_final = _parse_data(data_str)
        valor_final = _parse_valor(valor_str)
        if data_final is None or valor_final is None:
            continue

        descricao_final = f"{descricao} - {detalhe}" if detalhe else descricao
        descricao_final = descricao_final[:255]

        rows.append({
            "data": data_final,
            "descricao": descricao_final,
            "descricao_raw": descricao,
            "detalhe": detalhe,
            "valor": valor_final,
        })
    return rows
