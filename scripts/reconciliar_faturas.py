"""Reconcilia faturas que já foram pagas pelo extrato bancário.

O extrato do BB traz o pagamento da fatura como "Pagto cartão crédito"; quando esse
lançamento é importado, a fatura continua "aberta" no sistema. Clicar em "Pagar fatura"
depois disso gravaria a mesma despesa duas vezes no saldo do mês.

Este script liga a fatura ao lançamento que já existe (não cria transação nenhuma) e
limpa o sufixo "- nan" que o parser antigo gravava nas descrições do extrato.

Uso (dentro do container da financas-api, com -w /app):
    python /tmp/reconciliar_faturas.py            # só mostra o que faria
    python /tmp/reconciliar_faturas.py --apply    # grava
"""
import asyncio
import sys
from datetime import timedelta
from decimal import Decimal

from sqlalchemy import or_, select

from app.database import AsyncSessionLocal
from app.faturas.models import FaturaCartao
from app.transacoes.models import Transacao

JANELA_DIAS = 20
SUFIXO_LIXO = " - nan"


def _brl(v) -> str:
    texto = f"{abs(float(v)):,.2f}".replace(",", "X").replace(".", ",").replace("X", ".")
    return f"R$ {texto}"


async def main(apply: bool) -> int:
    alterados = 0
    nan_limpos = 0
    nao_casadas = []

    async with AsyncSessionLocal() as db:
        faturas = (await db.execute(select(FaturaCartao))).scalars().all()
        ja_ligados = {f.transacao_pagamento_id for f in faturas if f.transacao_pagamento_id}

        for f in sorted(faturas, key=lambda x: (x.mes_referencia, x.cartao_id)):
            if f.status == "paga" or f.transacao_pagamento_id is not None:
                continue
            referencia = f.data_vencimento or f.data_fechamento
            if referencia is None:
                nao_casadas.append((f, "sem data de vencimento"))
                continue

            alvo = -abs(Decimal(str(f.valor_total)))
            q = (
                select(Transacao)
                .where(
                    Transacao.valor == alvo,
                    Transacao.data >= referencia - timedelta(days=JANELA_DIAS),
                    Transacao.data <= referencia + timedelta(days=JANELA_DIAS),
                    Transacao.contabilizar_dashboard.is_(True),
                    or_(Transacao.origem.is_(None), Transacao.origem != "fatura"),
                )
                .order_by(Transacao.data)
            )
            candidatos = [t for t in (await db.execute(q)).scalars().all() if t.id not in ja_ligados]

            if not candidatos:
                nao_casadas.append((f, "nenhum lançamento com o mesmo valor"))
                continue

            tx = candidatos[0]
            print(
                f"[LIGAR] fatura {f.mes_referencia} (id={f.id}) {_brl(f.valor_total)} "
                f"-> tx id={tx.id} {tx.data} \"{tx.descricao}\""
            )
            if apply:
                f.status = "paga"
                f.transacao_pagamento_id = tx.id
                ja_ligados.add(tx.id)
            alterados += 1

        # Descrições gravadas pelo parser antigo: "Pagto cartão crédito - nan"
        q_nan = select(Transacao).where(Transacao.descricao.like(f"%{SUFIXO_LIXO}"))
        for tx in (await db.execute(q_nan)).scalars().all():
            nova = tx.descricao[: -len(SUFIXO_LIXO)]
            print(f"[LIMPAR] tx id={tx.id}: \"{tx.descricao}\" -> \"{nova}\"")
            if apply:
                tx.descricao = nova
            nan_limpos += 1

        if apply:
            await db.commit()

    print()
    print(f"Faturas ligadas: {alterados}{' (gravado)' if apply else ' (simulação)'}")
    print(f"Descrições limpas: {nan_limpos}{' (gravado)' if apply else ' (simulação)'}")
    if nao_casadas:
        print("\nFaturas abertas sem pagamento equivalente (mantidas como estão):")
        for f, motivo in nao_casadas:
            print(f"  - {f.mes_referencia} id={f.id} {_brl(f.valor_total)}: {motivo}")
    return 0


if __name__ == "__main__":
    sys.exit(asyncio.run(main("--apply" in sys.argv)))
