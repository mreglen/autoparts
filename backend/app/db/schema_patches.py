"""Idempotent schema patches for columns added after initial deploy."""
import logging

from sqlalchemy import inspect, text

from app.db.database import engine

logger = logging.getLogger(__name__)


def ensure_organization_markup_columns() -> None:
    """Add per-organization new-parts markup columns if missing."""
    inspector = inspect(engine)
    if "organizations" not in inspector.get_table_names():
        return

    columns = {col["name"] for col in inspector.get_columns("organizations")}
    statements = []

    if "new_parts_markup_percent" not in columns:
        statements.append(
            "ALTER TABLE organizations ADD COLUMN new_parts_markup_percent DOUBLE PRECISION"
        )
    if "new_parts_markup_manual" not in columns:
        statements.append(
            "ALTER TABLE organizations ADD COLUMN new_parts_markup_manual BOOLEAN NOT NULL DEFAULT FALSE"
        )

    if not statements:
        return

    with engine.begin() as conn:
        for stmt in statements:
            conn.execute(text(stmt))
        conn.execute(
            text(
                """
                UPDATE organizations o
                SET new_parts_markup_percent = COALESCE(
                    (SELECT s.new_parts_markup_percent FROM site_settings s WHERE s.id = 1 LIMIT 1),
                    15.0
                )
                WHERE o.new_parts_markup_percent IS NULL
                """
            )
        )

    logger.info("Applied organization markup column patches: %s", statements)


def _index_exists(inspector, table_name: str, index_name: str) -> bool:
    return any(index.get("name") == index_name for index in inspector.get_indexes(table_name))


def _fk_exists(inspector, table_name: str, constraint_name: str) -> bool:
    return any(fk.get("name") == constraint_name for fk in inspector.get_foreign_keys(table_name))


def _has_duplicate_avito_sources(conn) -> bool:
    row = conn.execute(
        text(
            """
            SELECT organization_id, avito_order_id, product_id, COUNT(*) AS cnt
            FROM stock_out
            WHERE source_kind = 'avito' AND avito_order_id IS NOT NULL
            GROUP BY organization_id, avito_order_id, product_id
            HAVING COUNT(*) > 1
            LIMIT 1
            """
        )
    ).first()
    return row is not None


def ensure_stock_out_source_columns() -> None:
    """Add source columns used by the unified stock sale flow."""
    inspector = inspect(engine)
    table_names = set(inspector.get_table_names())
    if "stock_out" not in table_names:
        return

    columns = {col["name"] for col in inspector.get_columns("stock_out")}
    statements = []

    if "source_kind" not in columns:
        statements.append("ALTER TABLE stock_out ADD COLUMN source_kind VARCHAR(32)")
    if "garage_used_order_item_id" not in columns:
        statements.append("ALTER TABLE stock_out ADD COLUMN garage_used_order_item_id INTEGER")

    dialect_name = engine.dialect.name
    avito_index = "uq_stock_out_avito_source_product"
    garage_index = "uq_stock_out_garage_used_order_item"

    with engine.begin() as conn:
        for stmt in statements:
            conn.execute(text(stmt))

        conn.execute(
            text(
                """
                UPDATE stock_out
                SET source_kind = CASE
                    WHEN sale_channel = 'avito' OR avito_order_id IS NOT NULL THEN 'avito'
                    WHEN COALESCE(sale_price, 0) > 0 THEN 'warehouse_manual'
                    ELSE 'writeoff'
                END
                WHERE source_kind IS NULL
                """
            )
        )

        inspector = inspect(engine)
        if dialect_name in {"postgresql", "sqlite"}:
            if not _index_exists(inspector, "stock_out", avito_index):
                if _has_duplicate_avito_sources(conn):
                    logger.warning(
                        "Skipped %s because duplicate Avito stock_out rows already exist",
                        avito_index,
                    )
                else:
                    conn.execute(
                        text(
                            f"""
                            CREATE UNIQUE INDEX {avito_index}
                            ON stock_out (organization_id, avito_order_id, product_id)
                            WHERE source_kind = 'avito' AND avito_order_id IS NOT NULL
                            """
                        )
                    )
            if not _index_exists(inspector, "stock_out", garage_index):
                conn.execute(
                    text(
                        f"""
                        CREATE UNIQUE INDEX {garage_index}
                        ON stock_out (garage_used_order_item_id)
                        WHERE garage_used_order_item_id IS NOT NULL
                        """
                    )
                )

        if (
            dialect_name == "postgresql"
            and "garage_used_order_items" in table_names
            and not _fk_exists(inspector, "stock_out", "fk_stock_out_garage_used_order_item")
        ):
            conn.execute(
                text(
                    """
                    ALTER TABLE stock_out
                    ADD CONSTRAINT fk_stock_out_garage_used_order_item
                    FOREIGN KEY (garage_used_order_item_id)
                    REFERENCES garage_used_order_items(id)
                    ON DELETE SET NULL
                    """
                )
            )

    if statements:
        logger.info("Applied stock_out source column patches: %s", statements)
