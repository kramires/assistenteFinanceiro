# BR-MIGRAR-003: constantes de transporte — CALC vs EXCLUIR do dashboard

TRANSPORTE_APP_EXCLUIR_DASHBOARD: frozenset[str] = frozenset({
    "uber",
    "99",
    "taxi",
    "táxi",
    "transporte alternativo",
    "transporte por aplicativo",
    # "transporte escolar" NÃO está aqui — entra no dashboard
})

TRANSPORTE_APP_CALC: frozenset[str] = frozenset({
    "uber",
    "99",
    "taxi",
    "táxi",
    "transporte alternativo",
    "transporte por aplicativo",
    "transporte escolar",  # incluído apenas para cálculo de transporte
})

PRIORIDADE_CATEGORIA_TRANSPORTE: list[str] = [
    "transporte alternativo",
    "transporte por aplicativo",
    "uber",
    "99",
    "taxi",
]
