#!/usr/bin/env python3
"""
Corrige a fatura OUROCARD VISA INFINITE (final 6988) — mes_referencia 2026-06.

Lançamentos extraídos deterministicamente do PDF (Extratos/Cartao VISA/fatura.pdf):
36 lançamentos, total R$ 7.805,87 (confere com o total da fatura, venc. 05/07/2026).

O que o script faz (via API local, localhost:18001):
  1. Login com as credenciais admin do financas.env
  2. Localiza a fatura 2026-06 do cartão VISA/Ourocard
  3. Apaga TODOS os lançamentos atuais dessa fatura (os errados)
  4. Insere os 36 lançamentos corretos (com parcela_atual/total_parcelas)
  5. Roda a recategorização automática (heurística + IA)
  6. Verifica se o total ficou R$ 7.805,87

Uso:  python3 corrigir_fatura_visa.py
      (requer os containers rodando: docker compose up -d)
"""
import json
import sys
import urllib.request
import urllib.error
from pathlib import Path

BASE = "http://localhost:18001/api"
MES = "2026-06"
TOTAL_ESPERADO = 7805.87

# (data, descricao, valor, parcela_atual, total_parcelas)
LANCAMENTOS = [
    # Serviços
    ("2026-06-03", "AMAZON BR SAO PAULO", 39.99, None, None),
    ("2026-06-03", "AMAZON BR SAO PAULO", 44.99, None, None),
    ("2026-06-05", "ASSAI ATACADISTA LJ29 BRASILIA", 837.16, None, None),
    ("2026-06-06", "CONTA VIVO SAO PAULO", 360.98, None, None),
    ("2026-06-08", "NETFLIX ENTRETENIMENTO BARUERI", 59.90, None, None),
    ("2026-06-11", "IFD*iFood Osasco", 5.95, None, None),
    ("2026-06-12", "TIM*61983253305 RIO DE JANEIR", 78.99, None, None),
    ("2026-06-16", "MERCADOLIVRE*MERCADOLIVBOTUCATU", 53.08, None, None),
    ("2026-06-18", "AMAZON BR SAO PAULO", 62.71, None, None),
    ("2026-06-21", "MERCADOLIVRE*MERCADOLIVCAJAMAR", 29.90, None, None),
    # Vestuário
    ("2026-06-18", "MERCADOLIVRE*RELAXADOSTFRANCA", 99.42, None, None),
    ("2026-06-21", "MERCADOLIVRE*MERCADOLIVMORRO AGUDO", 64.94, None, None),
    ("2026-06-24", "MERCADOLIVRE*DSSKATESHOVILA VELHA", 101.14, None, None),
    # Outros lançamentos
    ("2026-01-06", "PAGTO. PARCEL PARC 06/06 0203351359", 1877.47, 6, 6),
    ("2026-01-06", "PAGTO. PARCEL PARC 02/06 0203351359", 1877.47, 2, 6),
    ("2026-05-27", "LATAM AIR*JDXNNO SAO PAULO", 176.60, None, None),
    ("2026-06-23", "ANUIDADE DIFERENCIADA TIT-PARC 06/12", 83.00, 6, 12),
    ("2026-06-23", "APPLE.COM/BILL SAO PAULO", 99.90, None, None),
    # Compras parceladas (data = compra original; ano ajustado quando posterior
    # ao fechamento de 24/06/2026 → compra de 2025)
    ("2025-06-27", "ASAAS*GEOPROC PARC 12/12 Rio de Janei", 49.99, 12, 12),
    ("2025-07-07", "SPRINGER CARR PARC 12/12 ITAJAI", 238.88, 12, 12),
    ("2025-08-24", "MAGALU*Magalu PARC 10/10 FRANCA", 57.47, 10, 10),
    ("2025-09-12", "AMMO VAREJO*S PARC 10/10 VINHEDO", 42.97, 10, 10),
    ("2025-11-03", "HTM *asimo PARC 08/12 Barueri", 78.00, 8, 12),
    ("2026-02-27", "MP*MERCADOLIV PARC 04/06 CAMPINAS", 42.29, 4, 6),
    ("2026-02-28", "VIVO DF LJ D0 PARC 03/21 BRASILIA", 191.33, 3, 21),
    ("2026-02-28", "VIVO DF LJ D0 PARC 03/21 BRASILIA", 393.95, 3, 21),
    ("2026-03-11", "AMAZON BR PARC 04/06 SAO PAULO", 42.48, 4, 6),
    ("2026-03-11", "AMAZON BR PARC 04/05 SAO PAULO", 35.92, 4, 5),
    ("2026-03-30", "AIRBNB * HMFF PARC 03/06 SAO PAULO", 324.99, 3, 6),
    ("2026-04-02", "MP*PUMAS PARC 03/06 EMBU DAS ART", 31.49, 3, 6),
    ("2026-04-13", "MERCADOLIVRE* PARC 03/04 SAO PAULO", 31.48, 3, 4),
    ("2026-04-20", "AMAZONMKTPLC* PARC 03/08 NOVA IGUACU", 56.23, 3, 8),
    ("2026-04-21", "MP *MERCADOLI PARC 03/06 SANTO ANDR", 24.61, 3, 6),
    ("2026-04-27", "AMAZONMKTPLC* PARC 02/02 MAUA", 47.63, 2, 2),
    ("2026-05-01", "AIRBNB * HM3Z PARC 02/06 SAO PAULO", 119.93, 2, 6),
    ("2026-06-16", "AMAZON BR PARC 01/06 SAO PAULO", 42.64, 1, 6),
]


def req(method: str, path: str, token: str | None = None, body: dict | None = None):
    url = f"{BASE}{path}"
    data = json.dumps(body).encode() if body is not None else None
    r = urllib.request.Request(url, data=data, method=method)
    r.add_header("Content-Type", "application/json")
    if token:
        r.add_header("Authorization", f"Bearer {token}")
    try:
        with urllib.request.urlopen(r, timeout=120) as resp:
            raw = resp.read()
            return json.loads(raw) if raw else None
    except urllib.error.HTTPError as e:
        print(f"ERRO {e.code} em {method} {path}: {e.read().decode()[:300]}")
        sys.exit(1)
    except urllib.error.URLError as e:
        print(f"Não consegui conectar em {url} — os containers estão rodando? ({e.reason})")
        sys.exit(1)


def credenciais() -> tuple[str, str]:
    user, pwd = "klayton", ""
    env = Path(__file__).parent / "financas.env"
    if env.exists():
        for line in env.read_text().splitlines():
            if line.startswith("ADMIN_USERNAME="):
                user = line.split("=", 1)[1].strip()
            elif line.startswith("ADMIN_PASSWORD="):
                pwd = line.split("=", 1)[1].strip()
    return user, pwd


def main():
    soma = round(sum(v for _, _, v, _, _ in LANCAMENTOS), 2)
    assert soma == TOTAL_ESPERADO, f"Soma interna {soma} != {TOTAL_ESPERADO}"

    user, pwd = credenciais()
    tok = req("POST", "/auth/login", body={"username": user, "password": pwd})["access_token"]
    print(f"Login ok ({user}).")

    faturas = req("GET", f"/faturas?mes={MES}", tok)
    visa = [f for f in faturas if any(k in f["cartao_nome"].upper() for k in ("VISA", "OUROCARD", "INFINITE"))]
    if not visa:
        print(f"Nenhuma fatura {MES} de cartão VISA/Ourocard encontrada. Faturas do mês:")
        for f in faturas:
            print(f"  id={f['id']} cartao={f['cartao_nome']} total=R${f['valor_total']:.2f}")
        sys.exit(1)
    fat = visa[0]
    fid = fat["id"]
    print(f"Fatura encontrada: id={fid} cartao={fat['cartao_nome']} "
          f"total atual=R${fat['valor_total']:.2f} ({fat['total_lancamentos']} lançamentos)")

    det = req("GET", f"/faturas/{fid}", tok)
    antigos = det["lancamentos"]
    print(f"Apagando {len(antigos)} lançamentos errados...")
    for l in antigos:
        req("DELETE", f"/faturas/lancamentos/{l['id']}", tok)

    print(f"Inserindo {len(LANCAMENTOS)} lançamentos corretos...")
    for data, desc, valor, pa, tp in LANCAMENTOS:
        req("POST", f"/faturas/{fid}/lancamentos", tok, {
            "data": data, "descricao": desc, "valor": valor,
            "parcela_atual": pa, "total_parcelas": tp,
        })

    print("Recategorizando (heurística + IA)...")
    rec = req("POST", "/faturas/recategorizar-outros", tok)
    print(f"  categorizados: {rec.get('atualizados')} de {rec.get('total_outros')}")

    det = req("GET", f"/faturas/{fid}", tok)
    total = round(det["valor_total"], 2)
    n = len(det["lancamentos"])
    status = "OK ✓" if (total == TOTAL_ESPERADO and n == len(LANCAMENTOS)) else "DIVERGENTE ✗"
    print(f"\nResultado: {n} lançamentos, total R${total:.2f} (esperado R${TOTAL_ESPERADO:.2f}) — {status}")


if __name__ == "__main__":
    main()
