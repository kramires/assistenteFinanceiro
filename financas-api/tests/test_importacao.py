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


async def test_fatura_ja_paga_nao_gera_segundo_pagamento(monkeypatch):
    """Duplo clique em 'pagar' criava duas transações (despesa contada em dobro)."""
    fatura = SimpleNamespace(
        id=20, mes_referencia="2026-08", status="paga", transacao_pagamento_id=533,
        data_vencimento=date(2026, 9, 5), valor_total=Decimal("7592.00"),
    )

    class RepoFake:
        def __init__(self, db):
            pass

        async def get_com_cartao(self, fatura_id):
            return SimpleNamespace(FaturaCartao=fatura, cartao_nome="Nubank")

    class TransacaoServiceFake:
        def __init__(self, db):
            pass

        async def criar(self, body):
            raise AssertionError("não deveria criar transação para fatura já paga")

    monkeypatch.setattr(service, "FaturaRepository", RepoFake)
    monkeypatch.setattr(service, "TransacaoService", TransacaoServiceFake)

    with pytest.raises(ValueError, match="já está paga"):
        await service.pagar_fatura(20, None, None, db=None)


async def test_pagamento_vindo_do_extrato_bloqueia_marcar_como_paga(monkeypatch):
    """Fatura já paga pelo extrato ("Pagto cartão crédito") não pode virar despesa de novo."""
    fatura = SimpleNamespace(
        id=21, mes_referencia="2026-08", status="aberta", transacao_pagamento_id=None,
        data_vencimento=date(2026, 9, 5), valor_total=Decimal("4246.78"),
    )
    lancamento_extrato = SimpleNamespace(
        descricao="Pagto cartão crédito", valor=Decimal("-4246.78"), data=date(2026, 9, 1),
    )

    class RepoFake:
        def __init__(self, db):
            pass

        async def get_com_cartao(self, fatura_id):
            return SimpleNamespace(FaturaCartao=fatura, cartao_nome="BB Ourocard")

        async def buscar_pagamento_equivalente(self, valor, referencia, dias=20):
            assert Decimal(str(valor)) == Decimal("4246.78")
            return lancamento_extrato

    class TransacaoServiceFake:
        def __init__(self, db):
            pass

        async def criar(self, body):
            raise AssertionError("não deveria criar despesa duplicada")

    monkeypatch.setattr(service, "FaturaRepository", RepoFake)
    monkeypatch.setattr(service, "TransacaoService", TransacaoServiceFake)

    with pytest.raises(ValueError, match="duas vezes"):
        await service.pagar_fatura(21, None, None, db=None)


async def test_forcar_marca_como_paga_mesmo_com_lancamento_equivalente(monkeypatch):
    """Confirmação explícita (forcar) continua permitindo lançar o pagamento."""
    fatura = SimpleNamespace(
        id=22, mes_referencia="2026-08", status="aberta", transacao_pagamento_id=None,
        data_vencimento=date(2026, 9, 5), valor_total=Decimal("4246.78"),
    )
    criadas = []

    class RepoFake:
        def __init__(self, db):
            pass

        async def get_com_cartao(self, fatura_id):
            return SimpleNamespace(FaturaCartao=fatura, cartao_nome="BB Ourocard")

        async def buscar_pagamento_equivalente(self, valor, referencia, dias=20):
            raise AssertionError("forcar=True não deve consultar duplicidade")

        async def marcar_paga(self, fatura_id, transacao_id):
            criadas.append(("paga", fatura_id, transacao_id))

    class TransacaoServiceFake:
        def __init__(self, db):
            pass

        async def criar(self, body):
            criadas.append(("tx", float(body.valor), body.origem))
            return SimpleNamespace(id=900)

    monkeypatch.setattr(service, "FaturaRepository", RepoFake)
    monkeypatch.setattr(service, "TransacaoService", TransacaoServiceFake)

    await service.pagar_fatura(22, None, 1, db=None, forcar=True)
    assert criadas == [("tx", -4246.78, "fatura"), ("paga", 22, 900)]
