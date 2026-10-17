"""Monta o contexto das movimentações enviado à IA para análise e perguntas livres.

Junta as transações da conta com as compras dos cartões e destaca o transporte por
aplicativo. O pagamento da fatura (categoria "Cartão de Crédito" na conta) não entra nos
gastos: as compras do cartão já estão detalhadas e somá-lo contaria tudo em dobro.
"""
from collections import defaultdict
from dataclasses import dataclass
from datetime import date
from decimal import Decimal

from app.domain.transporte import (
    TRANSPORTE_APP_CALC,
    TRANSPORTE_APP_DESCRICAO,
    TRANSPORTE_APP_DESCRICAO_EXCLUIR,
)

SEM_CATEGORIA = "Sem categoria"
CATEGORIA_FATURA = "Cartão de Crédito"
CONTA = "conta"
_MESES = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"]
# Limita o tamanho do prompt: um ano inteiro pode ter milhares de lançamentos
MAX_LANCAMENTOS = 250
MAX_DESCRICOES = 15
MAX_PARCELADOS = 10


@dataclass
class Movimento:
    data: date
    descricao: str
    valor: Decimal  # saída negativa, entrada positiva (compra no cartão também é negativa)
    categoria: str | None
    fonte: str = CONTA  # "conta" ou o nome do cartão
    mes: int | None = None  # mês de competência; cartão usa o mês de referência da fatura
    parcela: str | None = None  # "3/10" em compras parceladas

    @property
    def competencia(self) -> int:
        return self.mes or self.data.month


def _brl(v: Decimal | float) -> str:
    s = f"{abs(float(v)):,.2f}".replace(",", "X").replace(".", ",").replace("X", ".")
    return f"-R$ {s}" if v < 0 else f"R$ {s}"


def _categoria(m: Movimento) -> str:
    return m.categoria or SEM_CATEGORIA


def _e_pagamento_fatura(m: Movimento) -> bool:
    return m.fonte == CONTA and m.categoria == CATEGORIA_FATURA and m.valor < 0


def e_transporte_app(m: Movimento) -> bool:
    """Mesma regra da aba Transporte: categoria de transporte ou descrição de corrida."""
    if (m.categoria or "").lower() in TRANSPORTE_APP_CALC:
        return True
    d = m.descricao.lower()
    return any(t in d for t in TRANSPORTE_APP_DESCRICAO) and not any(
        t in d for t in TRANSPORTE_APP_DESCRICAO_EXCLUIR
    )


def _saidas(movs: list[Movimento]) -> Decimal:
    """Gasto líquido (compras menos estornos), em valor positivo."""
    return -sum((m.valor for m in movs), Decimal(0))


def descrever_periodo(ano: int, mes: int | None) -> str:
    return f"{_MESES[mes - 1]}/{ano}" if mes else f"ano de {ano}"


def montar_contexto(
    movimentos: list[Movimento], ano: int, mes: int | None, categoria: str | None, fonte: str | None = None
) -> str:
    """Resume as movimentações do ano em texto para o prompt.

    O período (mês ou ano), a categoria e a fonte (um cartão) restringem os lançamentos
    analisados; o ano inteiro serve de base para a evolução mensal e para o peso da categoria.
    As entradas da conta continuam no contexto mesmo com a fonte restrita a um cartão.
    """
    # Pedindo a própria categoria "Cartão de Crédito", os pagamentos são o objeto da análise
    contar_pagamentos = categoria == CATEGORIA_FATURA
    pagamentos = [m for m in movimentos if _e_pagamento_fatura(m)]
    validos = movimentos if contar_pagamentos else [m for m in movimentos if not _e_pagamento_fatura(m)]

    def no_recorte(m: Movimento) -> bool:
        return categoria is None or _categoria(m) == categoria

    def da_fonte(m: Movimento) -> bool:
        return fonte is None or m.fonte == fonte

    periodo_todas_fontes = [m for m in validos if mes is None or m.competencia == mes]
    no_periodo = [m for m in periodo_todas_fontes if da_fonte(m)]
    alvo = [m for m in no_periodo if no_recorte(m)]
    # Gastos: saídas da conta + compras e estornos do cartão; entradas: só a conta
    gastos = [m for m in alvo if m.valor < 0 or m.fonte != CONTA]
    entradas = sum((m.valor for m in alvo if m.valor > 0 and m.fonte == CONTA), Decimal(0))
    total_gastos = _saidas(gastos)
    gastos_cartao = _saidas([m for m in gastos if m.fonte != CONTA])

    linhas = [
        f"Período: {descrever_periodo(ano, mes)}",
        f"Recorte: {'categoria ' + categoria if categoria else 'todas as categorias'}",
        f"Fontes: {fonte + ' (só este cartão)' if fonte else 'conta bancária e faturas de cartão'}"
        " (compras de cartão contam no mês de referência da fatura)",
        f"Lançamentos: {len(alvo)}",
        f"Entradas: {_brl(entradas)} | Gastos: {_brl(total_gastos)} "
        f"(conta {_brl(total_gastos - gastos_cartao)}, cartões {_brl(gastos_cartao)})",
    ]
    if fonte is not None and fonte != CONTA:
        renda = sum((m.valor for m in periodo_todas_fontes if m.valor > 0 and m.fonte == CONTA), Decimal(0))
        linhas.append(f"Entradas na conta no período (referência de renda): {_brl(renda)}")
    elif not contar_pagamentos:
        pagos = [m for m in pagamentos if mes is None or m.competencia == mes]
        if pagos:
            linhas.append(
                f"Pagamentos de fatura pela conta: {_brl(_saidas(pagos))} "
                "(já detalhados nas compras do cartão; não somados aos gastos)"
            )

    if categoria:
        # Renda do período inteiro, para a IA comparar o gasto da categoria com o que entra
        receitas_periodo = sum((m.valor for m in periodo_todas_fontes if m.valor > 0 and m.fonte == CONTA), Decimal(0))
        linhas.append(f"Entradas do período (todas as categorias): {_brl(receitas_periodo)}")
        gastos_periodo = _saidas([m for m in no_periodo if m.valor < 0 or m.fonte != CONTA])
        if gastos_periodo > 0:
            pct = total_gastos / gastos_periodo * 100
            linhas.append(f"Peso da categoria nos gastos do período: {pct:.1f}% de {_brl(gastos_periodo)}")
    else:
        por_cat: dict[str, list[Movimento]] = defaultdict(list)
        for m in gastos:
            por_cat[_categoria(m)].append(m)
        totais = sorted(((n, _saidas(ms)) for n, ms in por_cat.items()), key=lambda x: x[1], reverse=True)
        if totais:
            linhas.append("\nGASTOS POR CATEGORIA (conta + cartões):")
            for nome, total in totais:
                pct = total / total_gastos * 100 if total_gastos else 0
                linhas.append(f"- {nome}: {_brl(total)} ({pct:.1f}%)")

    _secao_cartoes(linhas, gastos)
    if categoria is None:
        _secao_transporte(linhas, gastos, [m for m in validos if da_fonte(m) and (m.valor < 0 or m.fonte != CONTA)], ano)

    # Evolução no ano do mesmo recorte de categoria, para comparar com outros meses
    por_mes: dict[int, list[Movimento]] = defaultdict(list)
    for m in validos:
        if (m.valor < 0 or m.fonte != CONTA) and no_recorte(m) and da_fonte(m):
            por_mes[m.competencia].append(m)
    if por_mes:
        linhas.append(f"\nGASTOS POR MÊS EM {ano}{' (' + categoria + ')' if categoria else ''}:")
        linhas += [f"- {_MESES[n - 1]}: {_brl(_saidas(por_mes[n]))}" for n in sorted(por_mes)]

    # Mesma descrição repetida revela assinaturas e hábitos
    por_desc: dict[str, list[Decimal]] = defaultdict(list)
    for m in gastos:
        if m.valor < 0:
            por_desc[m.descricao.strip().lower()].append(-m.valor)
    repetidas = sorted(por_desc.items(), key=lambda x: sum(x[1]), reverse=True)[:MAX_DESCRICOES]
    if repetidas:
        linhas.append("\nMAIORES DESTINOS DE GASTO (descrição: total em N lançamentos):")
        linhas += [f"- {d}: {_brl(sum(vs))} em {len(vs)}x" for d, vs in repetidas]

    lancamentos = alvo
    if len(alvo) > MAX_LANCAMENTOS:
        lancamentos = sorted(alvo, key=lambda m: abs(m.valor), reverse=True)[:MAX_LANCAMENTOS]
        lancamentos.sort(key=lambda m: m.data)
        linhas.append(f"\nLANÇAMENTOS ({MAX_LANCAMENTOS} maiores de {len(alvo)}; data | descrição | categoria | fonte | valor):")
    else:
        linhas.append("\nLANÇAMENTOS (data | descrição | categoria | fonte | valor):")
    linhas += [
        f"- {m.data.strftime('%d/%m')} | {m.descricao}{f' ({m.parcela})' if m.parcela else ''}"
        f" | {_categoria(m)} | {m.fonte} | {_brl(m.valor)}"
        for m in lancamentos
    ]
    if not lancamentos:
        linhas.append("- (nenhum lançamento neste recorte)")

    return "\n".join(linhas)


def _secao_cartoes(linhas: list[str], gastos: list[Movimento]) -> None:
    por_cartao: dict[str, list[Movimento]] = defaultdict(list)
    for m in gastos:
        if m.fonte != CONTA:
            por_cartao[m.fonte].append(m)
    if not por_cartao:
        return
    linhas.append("\nCARTÕES DE CRÉDITO:")
    for nome, ms in sorted(por_cartao.items(), key=lambda x: _saidas(x[1]), reverse=True):
        compras = [m for m in ms if m.valor < 0]
        linhas.append(f"- {nome}: {_brl(_saidas(ms))} em {len(compras)} compras")
    parcelados = sorted((m for ms in por_cartao.values() for m in ms if m.parcela and m.valor < 0), key=lambda m: m.valor)
    if parcelados:
        total = _saidas(parcelados)
        linhas.append(f"Parcelas no período: {_brl(total)} em {len(parcelados)} parcelas. Maiores:")
        linhas += [
            f"  - {m.descricao} ({m.parcela}): {_brl(-m.valor)} [{m.fonte}]"
            for m in parcelados[:MAX_PARCELADOS]
        ]


def _secao_transporte(linhas: list[str], gastos: list[Movimento], gastos_ano: list[Movimento], ano: int) -> None:
    corridas = [m for m in gastos if e_transporte_app(m)]
    if not corridas:
        return
    total = _saidas(corridas)
    n = len([m for m in corridas if m.valor < 0])
    no_cartao = _saidas([m for m in corridas if m.fonte != CONTA])
    linhas.append("\nTRANSPORTE POR APLICATIVO (Uber, 99, táxi etc.):")
    linhas.append(
        f"- Total: {_brl(total)} em {n} corridas"
        f" (média {_brl(total / n) if n else _brl(0)} por corrida; no cartão {_brl(no_cartao)})"
    )
    por_mes: dict[int, list[Movimento]] = defaultdict(list)
    for m in gastos_ano:
        if e_transporte_app(m):
            por_mes[m.competencia].append(m)
    if len(por_mes) > 1:
        linhas.append(
            f"- Por mês em {ano}: "
            + ", ".join(f"{_MESES[k - 1]} {_brl(_saidas(por_mes[k]))}" for k in sorted(por_mes))
        )
