import datetime
import io
import math
import re
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


def _e_linha_de_saldo(texto: str) -> bool:
    """O extrato do BB traz uma linha "S A L D O" (com espaços) que é o saldo, não um gasto.

    Compara só as letras, então "S A L D O", "SALDO" e "Saldo do dia" caem todos aqui.
    """
    compacto = re.sub(r"[^a-z]", "", texto.lower())
    if compacto.endswith("nan"):  # detalhe vazio que o pandas antigo escrevia como NaN
        compacto = compacto[:-3]
    return compacto in ("saldo", "saldododia", "saldoanterior")


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


def _txt(valor) -> str:
    """Célula do CSV como texto limpo.

    O pandas devolve NaN (float) nas células vazias mesmo com dtype=str; sem este
    tratamento a descrição saía como "Pagto cartão crédito - nan".
    """
    if valor is None:
        return ""
    if isinstance(valor, float) and math.isnan(valor):
        return ""
    texto = str(valor).strip()
    return "" if texto.lower() in ("nan", "none", "nat") else texto


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
        data_str = _txt(row[col_map["Data"]])
        descricao = _txt(row[col_map["Descricao"]])
        detalhe = _txt(row[col_map["Detalhe"]]) if col_map["Detalhe"] else ""
        valor_str = _txt(row[col_map["Valor"]])

        # BR-034: skip header/balance rows
        texto = f"{descricao} {detalhe}".lower()
        if not descricao or _e_linha_de_saldo(texto) or any(p in texto for p in _SKIP_PHRASES):
            continue

        data_final = _parse_data(data_str)
        valor_final = _parse_valor(valor_str)
        if data_final is None or valor_final is None:
            continue

        # BB CSV pode exportar todos os valores como positivos com coluna "Tipo Lançamento" = "D" (débito) / "C" (crédito).
        # Débito = dinheiro saindo da conta → deve ser negativo.
        if col_map["Tipo"]:
            tipo_str = str(row[col_map["Tipo"]] or "").strip().lower()
            _DEBITO_MARKERS = ("d", "deb", "déb", "debito", "débito", "debit")
            if tipo_str in _DEBITO_MARKERS and valor_final > 0:
                valor_final = -valor_final

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
