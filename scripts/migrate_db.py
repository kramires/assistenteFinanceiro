#!/usr/bin/env python3
"""
ETL: SQLite financas.db → PostgreSQL (financas-api schema)

Usage:
    python scripts/migrate_db.py \
        --sqlite financas.db \
        --pg "postgresql://user:pass@localhost:5432/financas"

The script is idempotent: re-running it only inserts rows that do not yet
exist in PostgreSQL (dedup by PK for categorias/orcamentos; by
(data, valor, descricao) for transacoes per BR-MIGRAR-040).

It does NOT modify the source SQLite database.
"""
import argparse
import sqlite3
import sys
from datetime import date
from decimal import Decimal

try:
    import psycopg2
    from psycopg2.extras import execute_values
except ImportError:
    sys.exit("psycopg2 not installed. Run: pip install psycopg2-binary")


def connect_sqlite(path: str) -> sqlite3.Connection:
    conn = sqlite3.connect(path)
    conn.row_factory = sqlite3.Row
    return conn


def connect_pg(dsn: str):
    return psycopg2.connect(dsn)


def migrate_categorias(sqlite_conn, pg_cur):
    rows = sqlite_conn.execute("SELECT id, nome, tipo FROM categorias ORDER BY id").fetchall()
    print(f"  categorias: {len(rows)} rows in SQLite")
    inserted = 0
    for r in rows:
        pg_cur.execute(
            """
            INSERT INTO categorias (id, nome, tipo)
            VALUES (%s, %s, %s)
            ON CONFLICT (id) DO NOTHING
            """,
            (r["id"], r["nome"], r["tipo"]),
        )
        if pg_cur.rowcount:
            inserted += 1
    print(f"  categorias: {inserted} inserted, {len(rows) - inserted} skipped (already exist)")
    return {r["id"]: r["id"] for r in rows}  # id map (1:1 here)


def migrate_transacoes(sqlite_conn, pg_cur):
    rows = sqlite_conn.execute(
        "SELECT id, descricao, valor, data, categoria_id, contabilizar_dashboard, origem, destino "
        "FROM transacoes ORDER BY id"
    ).fetchall()
    print(f"  transacoes: {len(rows)} rows in SQLite")
    inserted = 0
    dupes = 0
    for r in rows:
        data_val = r["data"]
        if isinstance(data_val, str):
            try:
                data_val = date.fromisoformat(data_val)
            except ValueError:
                print(f"    SKIP transacao id={r['id']}: invalid date {data_val!r}")
                continue

        valor = Decimal(str(r["valor"])) if r["valor"] is not None else None
        descricao = (r["descricao"] or "")[:255]

        # BR-MIGRAR-040: dedup by (data, valor, descricao)
        pg_cur.execute(
            "SELECT 1 FROM transacoes WHERE data=%s AND valor=%s AND descricao=%s LIMIT 1",
            (data_val, valor, descricao),
        )
        if pg_cur.fetchone():
            dupes += 1
            continue

        contabilizar = bool(r["contabilizar_dashboard"]) if r["contabilizar_dashboard"] is not None else True

        pg_cur.execute(
            """
            INSERT INTO transacoes
                (descricao, valor, data, categoria_id, contabilizar_dashboard, origem, destino)
            VALUES (%s, %s, %s, %s, %s, %s, %s)
            """,
            (
                descricao,
                valor,
                data_val,
                r["categoria_id"],
                contabilizar,
                r["origem"],
                r["destino"],
            ),
        )
        inserted += 1

    print(f"  transacoes: {inserted} inserted, {dupes} duplicates skipped")


def migrate_orcamentos(sqlite_conn, pg_cur):
    rows = sqlite_conn.execute(
        "SELECT id, categoria_id, ano, mes, valor_limite FROM orcamentos ORDER BY id"
    ).fetchall()
    print(f"  orcamentos: {len(rows)} rows in SQLite")
    inserted = 0
    for r in rows:
        # BR-MIGRAR-011: upsert by (categoria_id, ano, mes)
        pg_cur.execute(
            """
            INSERT INTO orcamentos (categoria_id, ano, mes, valor_limite)
            VALUES (%s, %s, %s, %s)
            ON CONFLICT (categoria_id, ano, mes)
            DO UPDATE SET valor_limite = EXCLUDED.valor_limite
            """,
            (r["categoria_id"], r["ano"], r["mes"], Decimal(str(r["valor_limite"]))),
        )
        if pg_cur.rowcount:
            inserted += 1

    print(f"  orcamentos: {inserted} upserted")


def sync_sequences(pg_cur):
    """Reset PostgreSQL sequences to avoid PK collisions after bulk insert."""
    for table in ("categorias", "transacoes", "orcamentos"):
        pg_cur.execute(
            f"SELECT setval(pg_get_serial_sequence('{table}', 'id'), MAX(id)) FROM {table}"
        )
    print("  sequences: reset OK")


def main():
    parser = argparse.ArgumentParser(description="Migrate financas.db → PostgreSQL")
    parser.add_argument("--sqlite", default="financas.db", help="Path to SQLite file")
    parser.add_argument("--pg", required=True, help="PostgreSQL DSN (postgresql://...)")
    parser.add_argument("--dry-run", action="store_true", help="Parse only, do not commit")
    args = parser.parse_args()

    print(f"Connecting to SQLite: {args.sqlite}")
    sqlite_conn = connect_sqlite(args.sqlite)

    print(f"Connecting to PostgreSQL: {args.pg[:40]}...")
    pg_conn = connect_pg(args.pg)
    pg_cur = pg_conn.cursor()

    try:
        print("\n--- Migrating categorias ---")
        migrate_categorias(sqlite_conn, pg_cur)

        print("\n--- Migrating transacoes ---")
        migrate_transacoes(sqlite_conn, pg_cur)

        print("\n--- Migrating orcamentos ---")
        migrate_orcamentos(sqlite_conn, pg_cur)

        print("\n--- Syncing sequences ---")
        sync_sequences(pg_cur)

        if args.dry_run:
            pg_conn.rollback()
            print("\nDRY RUN: rolled back, nothing committed.")
        else:
            pg_conn.commit()
            print("\nMigration committed successfully.")
    except Exception as exc:
        pg_conn.rollback()
        print(f"\nERROR: {exc}")
        sys.exit(1)
    finally:
        sqlite_conn.close()
        pg_cur.close()
        pg_conn.close()


if __name__ == "__main__":
    main()
