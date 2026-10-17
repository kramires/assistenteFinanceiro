"""Contexto das movimentações enviado à IA (recorte, cartões e transporte)."""
from datetime import date
from decimal import Decimal

from app.ia_proxy.analise import MAX_LANCAMENTOS, Movimento, montar_contexto


def _mov(dia: str, descricao: str, valor: str, categoria: str | None, **kw) -> Movimento:
    return Movimento(date.fromisoformat(dia), descricao, Decimal(valor), categoria, **kw)


MOVIMENTOS = [
    _mov("2026-02-10", "Mercado X", "-200.00", "Alimentação"),
    _mov("2026-03-01", "Salário", "5000.00", "Salário"),
    _mov("2026-03-05", "iFood", "-50.00", "Alimentação"),
    _mov("2026-03-12", "iFood", "-70.00", "Alimentação"),
    _mov("2026-03-15", "Netflix", "-55.90", "Assinaturas"),
    _mov("2026-03-20", "Pix avulso", "-24.10", None),
]

# Março com cartão: compra parcelada, corrida no cartão e na conta, estorno e o pagamento da fatura
COM_CARTAO = MOVIMENTOS + [
    _mov("2026-01-20", "Notebook", "-300.00", "Eletrônicos", fonte="cartão Nubank", mes=3, parcela="3/10"),
    _mov("2026-03-08", "Uber *Trip", "-30.00", "Transporte por Aplicativo", fonte="cartão Nubank", mes=3),
    _mov("2026-03-09", "Dl*99 Ride", "-20.00", None),
    _mov("2026-03-10", "Estorno loja", "15.00", "Eletrônicos", fonte="cartão Nubank", mes=3),
    _mov("2026-03-25", "Fatura Nubank 2026-02", "-900.00", "Cartão de Crédito"),
]


def test_mes_todas_categorias():
    ctx = montar_contexto(MOVIMENTOS, 2026, 3, None)
    assert "Período: Mar/2026" in ctx
    assert "Lançamentos: 5" in ctx
    assert "Gastos: R$ 200,00 (conta R$ 200,00, cartões R$ 0,00)" in ctx
    assert "- Alimentação: R$ 120,00 (60.0%)" in ctx
    assert "- Sem categoria: R$ 24,10" in ctx
    assert "Mercado X" not in ctx  # fevereiro fica só na evolução mensal
    assert "- Fev: R$ 200,00" in ctx
    assert "CARTÕES" not in ctx and "TRANSPORTE" not in ctx


def test_recorte_por_categoria():
    ctx = montar_contexto(MOVIMENTOS, 2026, 3, "Alimentação")
    assert "Lançamentos: 2" in ctx
    assert "Entradas do período (todas as categorias): R$ 5.000,00" in ctx
    assert "Peso da categoria nos gastos do período: 60.0% de R$ 200,00" in ctx
    assert "- ifood: R$ 120,00 em 2x" in ctx
    assert "Netflix" not in ctx
    # evolução só da categoria
    assert "- Fev: R$ 200,00" in ctx and "- Mar: R$ 120,00" in ctx


def test_cartao_entra_nos_gastos_sem_contar_a_fatura_em_dobro():
    ctx = montar_contexto(COM_CARTAO, 2026, 3, None)
    # conta 200 + 20 da corrida; cartão 300 + 30 - 15 de estorno
    assert "Gastos: R$ 535,00 (conta R$ 220,00, cartões R$ 315,00)" in ctx
    assert "Pagamentos de fatura pela conta: R$ 900,00" in ctx
    assert "- Cartão de Crédito:" not in ctx
    assert "- cartão Nubank: R$ 315,00 em 2 compras" in ctx
    assert "Notebook (3/10): R$ 300,00 [cartão Nubank]" in ctx
    # a compra parcelada de janeiro conta no mês de referência da fatura
    assert "| Notebook (3/10) | Eletrônicos | cartão Nubank | -R$ 300,00" in ctx


def test_transporte_por_aplicativo_junta_conta_e_cartao():
    ctx = montar_contexto(COM_CARTAO, 2026, 3, None)
    assert "- Total: R$ 50,00 em 2 corridas (média R$ 25,00 por corrida; no cartão R$ 30,00)" in ctx


def test_categoria_do_cartao_aparece_quando_pedida():
    ctx = montar_contexto(COM_CARTAO, 2026, 3, "Cartão de Crédito")
    assert "Fatura Nubank 2026-02" in ctx
    assert "Pagamentos de fatura pela conta" not in ctx


def test_fonte_restrita_a_um_cartao():
    ctx = montar_contexto(COM_CARTAO, 2026, 3, None, fonte="cartão Nubank")
    assert "Fontes: cartão Nubank (só este cartão)" in ctx
    assert "Gastos: R$ 315,00 (conta R$ 0,00, cartões R$ 315,00)" in ctx
    assert "Entradas na conta no período (referência de renda): R$ 5.000,00" in ctx
    assert "iFood" not in ctx and "Fatura Nubank" not in ctx
    # só a corrida do cartão
    assert "- Total: R$ 30,00 em 1 corridas" in ctx


def test_sem_categoria_e_ano_inteiro():
    ctx = montar_contexto(MOVIMENTOS, 2026, None, "Sem categoria")
    assert "Período: ano de 2026" in ctx
    assert "Pix avulso" in ctx
    assert "Lançamentos: 1" in ctx


def test_recorte_vazio():
    ctx = montar_contexto(MOVIMENTOS, 2026, 1, None)
    assert "(nenhum lançamento neste recorte)" in ctx


def test_limita_lancamentos_aos_maiores():
    muitos = [_mov("2026-05-01", f"Compra {i}", f"-{i + 1}.00", "Outros") for i in range(MAX_LANCAMENTOS + 50)]
    ctx = montar_contexto(muitos, 2026, 5, None)
    assert f"({MAX_LANCAMENTOS} maiores de {MAX_LANCAMENTOS + 50};" in ctx
    assert "| Compra 0 |" not in ctx  # o menor ficou de fora
    assert f"| Compra {MAX_LANCAMENTOS + 49} |" in ctx
