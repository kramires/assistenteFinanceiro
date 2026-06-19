from sqlalchemy.ext.asyncio import AsyncSession

from app.categorias.repository import CategoriaRepository
from app.categorias.service import CategoriaService
from app.domain.transporte import TRANSPORTE_APP_EXCLUIR_DASHBOARD
from app.extrato.categorizer_client import categorizar_via_ia
from app.extrato.parser import parse_csv
from app.transacoes.repository import TransacaoRepository
from app.transacoes.service import TransacaoService


_HEURISTICS: list[tuple[list[str], str]] = [
    # Delivery — antes de Alimentação para não cair em "Alimentação"
    (["ifood", "i food", "99food", "rappi", "uber eats", "ubereats",
      "james delivery", "aiqfome", "goomer"], "Delivery"),
    # Transporte por app — antes de "uber" genérico
    (["uber", "99 pop", "99cab", "99taxi", "cabify", "indriver",
      "taxi", "táxi"], "Transporte Alternativo"),
    (["transporte escolar"], "Transporte Escolar"),
    # Streamings
    (["netflix", "spotify", "disney", "amazon prime", "primevideo", "globoplay",
      "hbo max", "hbomax", "paramount", "apple tv", "apple one", "apple music",
      "crunchyroll", "youtube premium", "star+", "star plus", "deezer",
      "microsoft 365", "office 365", "max streaming"], "Streamings"),
    # Farmácia
    (["farmacia", "farmácia", "drogaria", "ultrafarma", "pacheco",
      "pague menos", "raia drogasil", "drogasil", "droga raia",
      "sao joao", "são joão", "nissei"], "Farmácia"),
    # Academia
    (["smartfit", "bluefit", "academia", "crossfit",
      "bodytech", "bio ritmo", "fórmula academia"], "Academia"),
    # Combustível
    (["posto ", "combustivel", "combustível", "gasolina", "shell",
      "ipiranga", "petrobras", "br distribuidora",
      "ale combustivel", "ale combustível"], "Combustível"),
    # Telefone / Internet
    (["vivo", "claro ", "tim ", "oi internet", "net combo", "net claro",
      "sky ", "embratel", "gvt ", "vivo fibra", "claro fibra",
      "tim fibra", "anatel"], "Telefone/Internet"),
    # Supermercado — nomes comuns de redes
    (["supermercado", "carrefour", "extra ", "assai", "assaí", "atacadao",
      "atacadão", "pao de acucar", "pão de açúcar", "hortifruti",
      "bistek", "sams club", "costco"], "Supermercado"),
    # Salário
    (["recebimento de proventos", "salário", "salario",
      "folha de pagamento", "fgts", "rescisao"], "Salário"),
    # Cartão de crédito (pagamento de fatura)
    (["compra com cartão", "cartão de crédito", "cartao de credito",
      "fatura cartao", "fatura cartão", "pgto cartao"], "Cartão de Crédito"),
    # Boletos
    (["pagamento de boleto", "boleto bancário", "boleto bancario",
      "darf", "gru tributo"], "Boletos"),
    # Seguros
    (["seguro de vida", "seguro auto", "seguro residencial", "seguro"], "Seguros"),
    # Juros / tarifas
    (["juros", "i.o.f", "iof ", "tarifa bancaria",
      "tarifa bancária", "multa"], "Juros/IOF"),
]


def _heuristic(texto: str) -> str:
    t = texto.lower()
    for keywords, categoria in _HEURISTICS:
        if any(k in t for k in keywords):
            return categoria
    return "Outros"


async def processar_extrato(raw_bytes: bytes, db: AsyncSession) -> str:
    rows = parse_csv(raw_bytes)
    if not rows:
        return "Nenhuma transação encontrada no arquivo."

    cat_repo = CategoriaRepository(db)
    cat_svc = CategoriaService(cat_repo)
    tx_repo = TransacaoRepository(db)
    tx_svc = TransacaoService(db)

    todas_categorias = await cat_repo.listar()
    nomes_categorias = [c.nome for c in todas_categorias]

    cache: dict[str, str] = {}
    criadas = 0
    duplicadas = 0

    for row in rows:
        # BR-040: skip duplicates
        if await tx_repo.existe_duplicata(row["data"], row["valor"], row["descricao"]):
            duplicadas += 1
            continue

        cache_key = f"{row['descricao_raw'].lower()}|{row['detalhe'].lower()}"
        categoria_nome = cache.get(cache_key)

        if not categoria_nome:
            # BR-037: try ia-api first
            cat_ia = await categorizar_via_ia(row["descricao"], nomes_categorias)
            if cat_ia:
                categoria_nome = cat_ia
            else:
                # BR-038: heuristic fallback
                categoria_nome = _heuristic(row["descricao"])

            # BR-039: normalizar transporte (EXCLUIR set → reuse existing transport cat)
            if categoria_nome.lower() in TRANSPORTE_APP_EXCLUIR_DASHBOARD:
                cat_obj = await cat_svc.normalizar_transporte()
                categoria_nome = cat_obj.nome

            cache[cache_key] = categoria_nome

        tipo = "rendimento" if row["valor"] > 0 else "despesa"
        categoria = await cat_svc.obter_ou_criar(categoria_nome, tipo)

        from app.transacoes.schemas import TransacaoCreate
        from decimal import Decimal

        body = TransacaoCreate(
            data=row["data"],
            descricao=row["descricao"],
            valor=Decimal(str(row["valor"])),
            categoria_id=categoria.id,
        )
        await tx_svc.criar(body)
        criadas += 1

    if criadas == 0:
        msg = "Nenhuma transação nova foi importada."
        if duplicadas:
            msg += f" {duplicadas} já existiam (duplicatas ignoradas)."
        return msg

    msg = f"{criadas} transação(ões) importada(s) com sucesso."
    if duplicadas:
        msg += f" {duplicadas} duplicata(s) ignorada(s)."
    return msg
