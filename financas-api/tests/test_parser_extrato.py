from datetime import date

from app.extrato.parser import parse_csv

CABECALHO = "Data;Lançamento;Detalhe;Valor;Tipo Lançamento\n"


def test_detalhe_vazio_nao_vira_nan_na_descricao():
    """Célula vazia no CSV (NaN do pandas) gerava "Pagto cartão crédito - nan"."""
    csv = (
        CABECALHO
        + "01/09/2026;Pagto cartão crédito;;4.246,78;D\n"
        + "01/09/2026;Compra com Cartão;01/09 19:29 LOJA;11,99;D\n"
    ).encode("latin1")

    rows = parse_csv(csv)

    assert rows[0]["descricao"] == "Pagto cartão crédito"
    assert rows[0]["detalhe"] == ""
    assert rows[0]["data"] == date(2026, 9, 1)
    assert rows[0]["valor"] == -4246.78

    assert rows[1]["descricao"] == "Compra com Cartão - 01/09 19:29 LOJA"


def test_celula_nan_literal_tambem_e_limpa():
    csv = (CABECALHO + "02/09/2026;Pagto cartão crédito;nan;100,00;D\n").encode("latin1")

    rows = parse_csv(csv)

    assert rows[0]["detalhe"] == ""
    assert rows[0]["descricao"] == "Pagto cartão crédito"


def test_linha_de_saldo_nao_vira_transacao():
    """Extrato do BB traz "S A L D O" (com espaços): é saldo, não gasto."""
    csv = (
        CABECALHO
        + "30/09/2026;S A L D O;;1.001,99;C\n"
        + "30/09/2026;Pagto cartão crédito;;100,00;D\n"
    ).encode("latin1")

    rows = parse_csv(csv)

    assert len(rows) == 1
    assert rows[0]["descricao"] == "Pagto cartão crédito"
