# BR-MIGRAR-003: constantes de transporte — CALC vs EXCLUIR do dashboard

TRANSPORTE_APP_EXCLUIR_DASHBOARD: frozenset[str] = frozenset({
    "uber",
    "99",
    "taxi",
    "táxi",
    "transporte por aplicativo",
    "transporte por aplicativo",
    # "transporte escolar" NÃO está aqui — entra no dashboard
})

TRANSPORTE_APP_CALC: frozenset[str] = frozenset({
    "uber",
    "99",
    "taxi",
    "táxi",
    "transporte por aplicativo",
    "transporte por aplicativo",
    "transporte escolar",  # incluído apenas para cálculo de transporte
})

PRIORIDADE_CATEGORIA_TRANSPORTE: list[str] = [
    "transporte por aplicativo",
    "transporte por aplicativo",
    "uber",
    "99",
    "taxi",
]

# Fallback por descrição (lançamentos sem categoria de transporte). Termos específicos
# de corrida: "99" sozinho pegava 99food e Pix com CPF/telefone contendo "99".
TRANSPORTE_APP_DESCRICAO: tuple[str, ...] = (
    "uber",
    "99 ride", "99ride", "99app", "99 pop", "99pop", "99 taxi", "99taxi", "99cab",
    "taxi", "táxi", "cabify", "indriver",
    "transporte escolar",
)

# Delivery dos mesmos apps não é transporte (Uber Eats, 99Food)
TRANSPORTE_APP_DESCRICAO_EXCLUIR: tuple[str, ...] = ("eats", "food")
