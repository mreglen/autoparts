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


def ensure_garage_used_order_item_fulfillment_columns() -> None:
    """Link marketplace order lines to stock_out after assembled fulfillment."""
    inspector = inspect(engine)
    table_names = set(inspector.get_table_names())
    if "garage_used_order_items" not in table_names:
        return

    columns = {col["name"] for col in inspector.get_columns("garage_used_order_items")}
    statements = []

    if "stock_out_id" not in columns:
        statements.append(
            "ALTER TABLE garage_used_order_items ADD COLUMN stock_out_id INTEGER"
        )
    if "fulfilled_at" not in columns:
        if engine.dialect.name == "postgresql":
            statements.append(
                "ALTER TABLE garage_used_order_items ADD COLUMN fulfilled_at TIMESTAMPTZ"
            )
        else:
            statements.append(
                "ALTER TABLE garage_used_order_items ADD COLUMN fulfilled_at DATETIME"
            )

    fk_name = "fk_garage_used_order_item_stock_out"
    with engine.begin() as conn:
        for stmt in statements:
            conn.execute(text(stmt))

        inspector = inspect(engine)
        if (
            engine.dialect.name == "postgresql"
            and "stock_out" in table_names
            and not _fk_exists(inspector, "garage_used_order_items", fk_name)
        ):
            conn.execute(
                text(
                    f"""
                    ALTER TABLE garage_used_order_items
                    ADD CONSTRAINT {fk_name}
                    FOREIGN KEY (stock_out_id)
                    REFERENCES stock_out(id)
                    ON DELETE SET NULL
                    """
                )
            )

    if statements:
        logger.info(
            "Applied garage_used_order_items fulfillment column patches: %s",
            statements,
        )


def ensure_avito_order_fulfillment_columns() -> None:
    """Persist warehouse fulfillment status and skip reasons for Avito orders."""
    inspector = inspect(engine)
    table_names = set(inspector.get_table_names())
    if "avito_orders_cache" not in table_names:
        return

    columns = {col["name"] for col in inspector.get_columns("avito_orders_cache")}
    statements = []

    if "stock_fulfillment_status" not in columns:
        statements.append(
            "ALTER TABLE avito_orders_cache ADD COLUMN stock_fulfillment_status VARCHAR(20)"
        )
    if "last_skip_reasons" not in columns:
        if engine.dialect.name == "postgresql":
            statements.append(
                "ALTER TABLE avito_orders_cache ADD COLUMN last_skip_reasons JSONB"
            )
        else:
            statements.append(
                "ALTER TABLE avito_orders_cache ADD COLUMN last_skip_reasons JSON"
            )
    if "last_fulfillment_at" not in columns:
        if engine.dialect.name == "postgresql":
            statements.append(
                "ALTER TABLE avito_orders_cache ADD COLUMN last_fulfillment_at TIMESTAMPTZ"
            )
        else:
            statements.append(
                "ALTER TABLE avito_orders_cache ADD COLUMN last_fulfillment_at DATETIME"
            )

    if not statements:
        return

    with engine.begin() as conn:
        for stmt in statements:
            conn.execute(text(stmt))

    logger.info("Applied avito_orders_cache fulfillment column patches: %s", statements)


def ensure_event_log_audit_columns() -> None:
    """Extend event_log for audit journal."""
    inspector = inspect(engine)
    table_names = set(inspector.get_table_names())
    if "event_log" not in table_names:
        return

    columns = {col["name"] for col in inspector.get_columns("event_log")}
    statements = []

    col_defs = [
        ("organization_id", "VARCHAR(10)"),
        ("category", "VARCHAR(50)"),
        ("summary", "VARCHAR(500)"),
        ("actor_name", "VARCHAR(255)"),
        ("ip_address", "VARCHAR(45)"),
        ("entity_type", "VARCHAR(50)"),
        ("entity_id", "VARCHAR(64)"),
    ]
    for name, col_type in col_defs:
        if name not in columns:
            statements.append(f"ALTER TABLE event_log ADD COLUMN {name} {col_type}")

    if statements:
        with engine.begin() as conn:
            for stmt in statements:
                conn.execute(text(stmt))
        logger.info("Applied event_log audit column patches: %s", statements)

    index_defs = [
        ("ix_event_log_category", "category"),
        ("ix_event_log_organization_id", "organization_id"),
    ]
    with engine.begin() as conn:
        for index_name, col_name in index_defs:
            if not _index_exists(inspector, "event_log", index_name):
                try:
                    conn.execute(
                        text(f"CREATE INDEX IF NOT EXISTS {index_name} ON event_log ({col_name})")
                    )
                except Exception:
                    pass


def ensure_user_public_code() -> None:
    """Add users.public_code column and unique index (values via remigrate script)."""
    inspector = inspect(engine)
    table_names = set(inspector.get_table_names())
    if "users" not in table_names:
        return

    columns = {col["name"] for col in inspector.get_columns("users")}
    if "public_code" not in columns:
        with engine.begin() as conn:
            conn.execute(text("ALTER TABLE users ADD COLUMN public_code VARCHAR(10)"))

    if not _index_exists(inspector, "users", "ix_users_public_code"):
        try:
            with engine.begin() as conn:
                conn.execute(
                    text("CREATE UNIQUE INDEX IF NOT EXISTS ix_users_public_code ON users (public_code)")
                )
        except Exception:
            pass

    logger.info("Applied users.public_code column patch (run remigrate_user_public_codes.py to assign codes)")


def ensure_garage_order_delivery_columns() -> None:
    inspector = inspect(engine)
    table_names = set(inspector.get_table_names())
    statements: list[str] = []
    for table in ("garage_used_orders", "garage_new_orders"):
        if table not in table_names:
            continue
        columns = {col["name"] for col in inspector.get_columns(table)}
        if "delivery_region_id" not in columns:
            statements.append(f"ALTER TABLE {table} ADD COLUMN delivery_region_id INTEGER")
        if "delivery_region_name" not in columns:
            statements.append(f"ALTER TABLE {table} ADD COLUMN delivery_region_name VARCHAR(255)")
    if not statements:
        return
    with engine.begin() as conn:
        for stmt in statements:
            conn.execute(text(stmt))
    logger.info("Applied garage order delivery column patches: %s", statements)


def ensure_avito_pro_status_columns() -> None:
    """Persist Avito Pro subscription probe results on organization_avito_integration."""
    inspector = inspect(engine)
    table_names = set(inspector.get_table_names())
    if "organization_avito_integration" not in table_names:
        return

    columns = {col["name"] for col in inspector.get_columns("organization_avito_integration")}
    statements: list[str] = []

    if "pro_active" not in columns:
        statements.append(
            "ALTER TABLE organization_avito_integration ADD COLUMN pro_active BOOLEAN NOT NULL DEFAULT TRUE"
        )
    if "pro_status_message" not in columns:
        statements.append(
            "ALTER TABLE organization_avito_integration ADD COLUMN pro_status_message TEXT"
        )
    if "pro_status_checked_at" not in columns:
        if engine.dialect.name == "postgresql":
            statements.append(
                "ALTER TABLE organization_avito_integration ADD COLUMN pro_status_checked_at TIMESTAMPTZ"
            )
        else:
            statements.append(
                "ALTER TABLE organization_avito_integration ADD COLUMN pro_status_checked_at DATETIME"
            )
    if "pro_features_json" not in columns:
        if engine.dialect.name == "postgresql":
            statements.append(
                "ALTER TABLE organization_avito_integration ADD COLUMN pro_features_json JSONB"
            )
        else:
            statements.append(
                "ALTER TABLE organization_avito_integration ADD COLUMN pro_features_json TEXT"
            )

    if not statements:
        return

    with engine.begin() as conn:
        for stmt in statements:
            conn.execute(text(stmt))

    logger.info("Applied Avito Pro status column patches: %s", statements)


def ensure_site_reviews_table() -> None:
    """Create site_reviews table for public testimonials."""
    inspector = inspect(engine)
    if "site_reviews" in inspector.get_table_names():
        return

    if engine.dialect.name == "postgresql":
        ddl = """
        CREATE TABLE site_reviews (
            id SERIAL PRIMARY KEY,
            user_id INTEGER REFERENCES users(id),
            author_name VARCHAR(120) NOT NULL,
            author_role VARCHAR(80),
            text TEXT NOT NULL,
            rating INTEGER NOT NULL DEFAULT 5,
            source VARCHAR(32) NOT NULL DEFAULT 'platform',
            review_date TIMESTAMPTZ,
            featured BOOLEAN NOT NULL DEFAULT FALSE,
            enabled BOOLEAN NOT NULL DEFAULT TRUE,
            sort_order INTEGER NOT NULL DEFAULT 0,
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
        """
    else:
        ddl = """
        CREATE TABLE site_reviews (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER REFERENCES users(id),
            author_name VARCHAR(120) NOT NULL,
            author_role VARCHAR(80),
            text TEXT NOT NULL,
            rating INTEGER NOT NULL DEFAULT 5,
            source VARCHAR(32) NOT NULL DEFAULT 'platform',
            review_date DATETIME,
            featured BOOLEAN NOT NULL DEFAULT 0,
            enabled BOOLEAN NOT NULL DEFAULT 1,
            sort_order INTEGER NOT NULL DEFAULT 0,
            created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
        )
        """

    with engine.begin() as conn:
        conn.execute(text(ddl))

    logger.info("Applied site_reviews table patch")


def ensure_site_reviews_user_id_column() -> None:
    """Add user_id to site_reviews for authenticated submissions."""
    inspector = inspect(engine)
    if "site_reviews" not in inspector.get_table_names():
        return

    columns = {col["name"] for col in inspector.get_columns("site_reviews")}
    if "user_id" in columns:
        return

    with engine.begin() as conn:
        conn.execute(text("ALTER TABLE site_reviews ADD COLUMN user_id INTEGER REFERENCES users(id)"))

    logger.info("Applied site_reviews user_id column patch")


def ensure_site_settings_show_site_reviews_column() -> None:
    """Add show_site_reviews toggle to site_settings."""
    inspector = inspect(engine)
    if "site_settings" not in inspector.get_table_names():
        return

    columns = {col["name"] for col in inspector.get_columns("site_settings")}
    if "show_site_reviews" in columns:
        return

    if engine.dialect.name == "postgresql":
        stmt = "ALTER TABLE site_settings ADD COLUMN show_site_reviews BOOLEAN NOT NULL DEFAULT TRUE"
    else:
        stmt = "ALTER TABLE site_settings ADD COLUMN show_site_reviews BOOLEAN NOT NULL DEFAULT 1"

    with engine.begin() as conn:
        conn.execute(text(stmt))

    logger.info("Applied site_settings show_site_reviews column patch")


def ensure_group_chat_columns() -> None:
    """Add group chat columns to chats and create chat_participants table."""
    inspector = inspect(engine)
    table_names = set(inspector.get_table_names())
    if "chats" not in table_names:
        return

    columns = {col["name"] for col in inspector.get_columns("chats")}
    statements = []

    if "chat_type" not in columns:
        statements.append(
            "ALTER TABLE chats ADD COLUMN chat_type VARCHAR(20) NOT NULL DEFAULT 'direct'"
        )
    if "organization_id" not in columns:
        statements.append(
            "ALTER TABLE chats ADD COLUMN organization_id VARCHAR(10) REFERENCES organizations(id)"
        )
    if "title" not in columns:
        statements.append("ALTER TABLE chats ADD COLUMN title VARCHAR(255)")

    dialect = engine.dialect.name
    with engine.begin() as conn:
        for stmt in statements:
            conn.execute(text(stmt))

        if dialect == "postgresql":
            conn.execute(text("ALTER TABLE chats ALTER COLUMN buyer_id DROP NOT NULL"))
            conn.execute(text("ALTER TABLE chats ALTER COLUMN seller_id DROP NOT NULL"))
        elif dialect == "sqlite":
            # SQLite cannot drop NOT NULL in-place; create_all handles new installs.
            pass

        inspector = inspect(engine)
        if "chat_participants" not in inspector.get_table_names():
            if dialect == "postgresql":
                conn.execute(
                    text(
                        """
                        CREATE TABLE chat_participants (
                            id SERIAL PRIMARY KEY,
                            chat_id INTEGER NOT NULL REFERENCES chats(id),
                            user_id INTEGER NOT NULL REFERENCES users(id),
                            joined_at TIMESTAMPTZ DEFAULT NOW(),
                            CONSTRAINT uq_chat_participant UNIQUE (chat_id, user_id)
                        )
                        """
                    )
                )
                conn.execute(
                    text("CREATE INDEX IF NOT EXISTS ix_chat_participants_user_id ON chat_participants (user_id)")
                )
            else:
                conn.execute(
                    text(
                        """
                        CREATE TABLE chat_participants (
                            id INTEGER PRIMARY KEY AUTOINCREMENT,
                            chat_id INTEGER NOT NULL REFERENCES chats(id),
                            user_id INTEGER NOT NULL REFERENCES users(id),
                            joined_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                            UNIQUE (chat_id, user_id)
                        )
                        """
                    )
                )
                conn.execute(
                    text("CREATE INDEX IF NOT EXISTS ix_chat_participants_user_id ON chat_participants (user_id)")
                )

    if statements:
        logger.info("Applied group chat column patches: %s", statements)
    else:
        logger.info("Group chat schema already up to date")


def ensure_seo_product_url_exports_table() -> None:
    """Table tracking product URLs already included in daily SEO export batches."""
    inspector = inspect(engine)
    if "seo_product_url_exports" in inspector.get_table_names():
        return

    dialect = engine.dialect.name
    with engine.begin() as conn:
        if dialect == "postgresql":
            conn.execute(
                text(
                    """
                    CREATE TABLE seo_product_url_exports (
                        id SERIAL PRIMARY KEY,
                        product_id INTEGER NOT NULL REFERENCES products(id),
                        export_date DATE NOT NULL,
                        exported_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                        CONSTRAINT uq_seo_product_url_exports_product_id UNIQUE (product_id)
                    )
                    """
                )
            )
            conn.execute(
                text(
                    "CREATE INDEX IF NOT EXISTS ix_seo_product_url_exports_export_date "
                    "ON seo_product_url_exports (export_date)"
                )
            )
        else:
            conn.execute(
                text(
                    """
                    CREATE TABLE seo_product_url_exports (
                        id INTEGER PRIMARY KEY AUTOINCREMENT,
                        product_id INTEGER NOT NULL REFERENCES products(id),
                        export_date DATE NOT NULL,
                        exported_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
                        UNIQUE (product_id)
                    )
                    """
                )
            )
            conn.execute(
                text(
                    "CREATE INDEX IF NOT EXISTS ix_seo_product_url_exports_export_date "
                    "ON seo_product_url_exports (export_date)"
                )
            )

    logger.info("Created seo_product_url_exports table")


def ensure_user_avatar_column() -> None:
    """Add avatar_url column to users if missing."""
    inspector = inspect(engine)
    if "users" not in inspector.get_table_names():
        return

    columns = {col["name"] for col in inspector.get_columns("users")}
    if "avatar_url" in columns:
        return

    with engine.begin() as conn:
        conn.execute(text("ALTER TABLE users ADD COLUMN avatar_url VARCHAR(512)"))

    logger.info("Applied users.avatar_url column patch")

