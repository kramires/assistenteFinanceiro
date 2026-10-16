"""Leitura determinística do texto da fatura BB (sem IA)."""
from datetime import date

from app.faturas.parsers import bb_pdf

# Trechos no formato do texto extraído pelo pdfplumber das faturas Ourocard
CABECALHO = (
    "Olá, Fulano, esta é sua fatura de OUROCARD VISA INFINITE Final1234\n"
    "Vencimento\n"
    "outubro Saldo fatura anterior R$ 4.246,78\n"
    "05/10/2026\n"
    "Pagamentos/Créditos R$ -4.246,78\n"
)

# Pagou exatamente a fatura anterior: total == soma dos débitos
FATURA_SIMPLES = CABECALHO + (
    "SALDO FATURA ANTERIOR BR R$ 4.246,78\n"
    "Pagamentos/Créditos\n"
    "02/09 PGTO. CASH AG. 1245 000124500 200 BR R$ -4.246,78\n"
    "10/09 MERCADO BRASILIA BR R$ 2.908,06\n"
    "27/08 IOF - COMPRA NO EXTERIOR R$ 2,00\n"
    "22/09 ANUIDADE DIFERENCIADA TIT-PARC 12/12 BR R$ 83,00\n"
    "Subtotal R$ 2.993,06\n"
    "Total da Fatura R$ 2.993,06\n"
)

# Pagou a mais + estorno: o total impresso já desconta a diferença
FATURA_PAGAMENTO_A_MAIOR = (
    "SALDO FATURA ANTERIOR BR R$ 2.764,31\n"
    "Pagamentos/Créditos\n"
    "02/03 PGTO. CASH AG. 1245 000124500 200 BR R$ -3.235,14\n"
    "13/03 APPLE.COM/BILL SAO PAULO BR R$ -22,99\n"
    "15/03 COMPRAS DO MES R$ 2.637,46\n"
    "Total da Fatura R$ 2.143,64\n"
)


def test_extrai_total_da_fatura():
    assert bb_pdf.extrair_total(FATURA_SIMPLES) == 2993.06


def test_debitos_esperados_quando_pagou_exato():
    # IOF e anuidade fazem parte do total (bug: prompt antigo os ignorava)
    assert bb_pdf.extrair_total_debitos(FATURA_SIMPLES) == 2993.06


def test_debitos_esperados_descontam_saldo_e_pagamentos():
    # 2.143,64 − 2.764,31 + 3.235,14 + 22,99 = 2.637,46
    assert bb_pdf.extrair_total_debitos(FATURA_PAGAMENTO_A_MAIOR) == 2637.46


def test_pagamento_do_resumo_do_topo_nao_conta_duas_vezes():
    # O resumo do topo também traz "Pagamentos/Créditos R$ -4.246,78";
    # só a seção de lançamentos (após SALDO FATURA ANTERIOR) entra na conta.
    assert bb_pdf.extrair_total_debitos(FATURA_SIMPLES) == bb_pdf.extrair_total(FATURA_SIMPLES)


def test_sem_saldo_anterior_retorna_none():
    assert bb_pdf.extrair_total_debitos("Total da Fatura R$ 10,00") is None


def test_detecta_final_do_cartao():
    assert bb_pdf.detectar_final_cartao(CABECALHO) == "1234"
    assert bb_pdf.detectar_final_cartao("sem cartão aqui") is None


def test_detecta_vencimento():
    assert bb_pdf.detectar_vencimento(CABECALHO) == date(2026, 10, 5)
    assert bb_pdf.detectar_vencimento("Vencimento a combinar") is None
