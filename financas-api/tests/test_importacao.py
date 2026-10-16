"""Regras da importação de faturas que não dependem de IA nem de banco real."""
from datetime import date
from decimal import Decimal
from types import SimpleNamespace

import pytest

from app.faturas import service


@pytest.mark.parametrize(
    "vencimento, esperado",
    [(date(2026, 10, 5), "2026-09"), (date(2026, 1, 5), "2025-12")],
)
def test_mes_referencia_e_o_mes_anterior_ao_vencimento(vencimento, esperado):
    assert service._mes_anterior(vencimento) == esperado


async def test_pdf_ja_importado_e_recusado_sem_chamar_ia(monkeypatch):
    """Reimportar PDF mesclava duplicatas (a IA descreve diferente a cada leitura)."""

    class RepoFake:
        def __init__(self, db):
            pass

        async def buscar_por_cartao_mes(self, cartao_id, mes):
            return SimpleNamespace(id=24, valor_total=Decimal("2993.06"))

    async def ia_nao_deve_ser_chamada(*args, **kwargs):
        raise AssertionError("não deveria extrair o PDF de uma fatura já importada")

    monkeypatch.setattr(service, "FaturaRepository", RepoFake)
    monkeypatch.setattr(service.bb_pdf, "parse", ia_nao_deve_ser_chamada)

    with pytest.raises(ValueError, match="já foi importada"):
        await service.importar_pdf(b"%PDF", 2, "2026-09", date(2026, 10, 5), db=None)


async def test_divergencia_de_total_bloqueia_importacao(monkeypatch):
    class RepoFake:
        def __init__(self, db):
            pass

        async def buscar_por_cartao_mes(self, cartao_id, mes):
            return None

    async def parse_fake(content, mes):
        return {
            "transacoes": [{"data": "2026-09-10", "descricao": "MERCADO", "valor": 100.0}],
            "total_pdf": 185.15,
            "total_debitos_pdf": 185.15,  # faltou IOF + anuidade
        }

    monkeypatch.setattr(service, "FaturaRepository", RepoFake)
    monkeypatch.setattr(service.bb_pdf, "parse", parse_fake)

    with pytest.raises(ValueError, match="Extração divergente"):
        await service.importar_pdf(b"%PDF", 2, "2026-09", None, db=None)
