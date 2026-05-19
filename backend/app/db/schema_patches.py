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
