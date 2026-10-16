"""Categorização por regra fixa e filtro da aba Transporte por Aplicativo."""
import pytest

from app.domain.transporte import TRANSPORTE_APP_DESCRICAO, TRANSPORTE_APP_DESCRICAO_EXCLUIR
from app.extrato.service import _heuristic


@pytest.mark.parametrize(
    "descricao, categoria",
    [
        ("99food *E2f Alimentos", "Alimentação"),
        ("99food *99food", "Alimentação"),
        ("Dl*99 Ride", "Transporte por Aplicativo"),
        ("Pg *99 Ride", "Transporte por Aplicativo"),
        ("99APP 99App Sao Paulo", "Transporte por Aplicativo"),
        ("Uber *One Membership U", "Transporte por Aplicativo"),
        ("Uber Eats", "Delivery"),
        ("IFOOD *RESTAURANTE", "Delivery"),
    ],
)
def test_heuristica(descricao, categoria):
    assert _heuristic(descricao) == categoria


def _e_corrida(descricao: str) -> bool:
    """Mesma lógica do filtro SQL em transporte/repository.py (_descricao_match)."""
    d = descricao.lower()
    return any(t in d for t in TRANSPORTE_APP_DESCRICAO) and not any(
        t in d for t in TRANSPORTE_APP_DESCRICAO_EXCLUIR
    )


@pytest.mark.parametrize(
    "descricao, esperado",
    [
        ("Dl*99 Ride", True),
        ("99APP 99App Sao Paulo", True),
        ("UBER * PENDING SAO PAULO", True),
        ("transporte escolar das crianças", True),
        ("99food *Pizza e Vinho", False),
        ("Uber Eats", False),
        # Pix com CPF/telefone contendo "99" entrava na aba antes da correção
        ("Pix - Recebido - 01/02 17:49 11999998877 FULANO DE TAL", False),
    ],
)
def test_filtro_aba_transporte(descricao, esperado):
    assert _e_corrida(descricao) is esperado
