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
    if "append_marketplace_site_info" not in columns:
        statements.append(
            "ALTER TABLE organizations ADD COLUMN append_marketplace_site_info BOOLEAN NOT NULL DEFAULT FALSE"
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


def ensure_garage_used_order_item_payment_columns() -> None:
    """Per-line payment fields for marketplace used orders."""
    inspector = inspect(engine)
    table_names = set(inspector.get_table_names())
    if "garage_used_order_items" not in table_names:
        return

    columns = {col["name"] for col in inspector.get_columns("garage_used_order_items")}
    statements = []

    if "is_paid" not in columns:
        if engine.dialect.name == "postgresql":
            statements.append(
                "ALTER TABLE garage_used_order_items "
                "ADD COLUMN is_paid BOOLEAN NOT NULL DEFAULT FALSE"
            )
        else:
            statements.append(
                "ALTER TABLE garage_used_order_items "
                "ADD COLUMN is_paid BOOLEAN NOT NULL DEFAULT 0"
            )
    if "payment_method_id" not in columns:
        statements.append(
            "ALTER TABLE garage_used_order_items ADD COLUMN payment_method_id INTEGER"
        )
    if "payment_method_name" not in columns:
        statements.append(
            "ALTER TABLE garage_used_order_items "
            "ADD COLUMN payment_method_name VARCHAR(255)"
        )
    if "paid_at" not in columns:
        if engine.dialect.name == "postgresql":
            statements.append(
                "ALTER TABLE garage_used_order_items ADD COLUMN paid_at TIMESTAMPTZ"
            )
        else:
            statements.append(
                "ALTER TABLE garage_used_order_items ADD COLUMN paid_at DATETIME"
            )

    with engine.begin() as conn:
        for stmt in statements:
            conn.execute(text(stmt))
        if engine.dialect.name == "postgresql":
            conn.execute(
                text(
                    """
                    UPDATE garage_used_order_items AS i
                    SET
                        is_paid = TRUE,
                        payment_method_id = o.payment_method_id,
                        payment_method_name = o.payment_method_name,
                        paid_at = o.paid_at
                    FROM garage_used_orders AS o
                    WHERE i.order_id = o.id
                      AND o.is_paid = TRUE
                      AND i.is_paid = FALSE
                    """
                )
            )
        else:
            conn.execute(
                text(
                    """
                    UPDATE garage_used_order_items
                    SET
                        is_paid = 1,
                        payment_method_id = (
                            SELECT payment_method_id FROM garage_used_orders
                            WHERE garage_used_orders.id = garage_used_order_items.order_id
                        ),
                        payment_method_name = (
                            SELECT payment_method_name FROM garage_used_orders
                            WHERE garage_used_orders.id = garage_used_order_items.order_id
                        ),
                        paid_at = (
                            SELECT paid_at FROM garage_used_orders
                            WHERE garage_used_orders.id = garage_used_order_items.order_id
                        )
                    WHERE order_id IN (
                        SELECT id FROM garage_used_orders WHERE is_paid = 1
                    )
                    AND is_paid = 0
                    """
                )
            )

    if statements:
        logger.info(
            "Applied garage_used_order_items payment column patches: %s",
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


def ensure_site_settings_show_yandex_badge_column() -> None:
    """Add show_yandex_badge toggle to site_settings."""
    inspector = inspect(engine)
    if "site_settings" not in inspector.get_table_names():
        return

    columns = {col["name"] for col in inspector.get_columns("site_settings")}
    if "show_yandex_badge" in columns:
        return

    if engine.dialect.name == "postgresql":
        stmt = "ALTER TABLE site_settings ADD COLUMN show_yandex_badge BOOLEAN NOT NULL DEFAULT TRUE"
    else:
        stmt = "ALTER TABLE site_settings ADD COLUMN show_yandex_badge BOOLEAN NOT NULL DEFAULT 1"

    with engine.begin() as conn:
        conn.execute(text(stmt))

    logger.info("Applied site_settings show_yandex_badge column patch")


def ensure_site_settings_used_parts_purchase_mode_column() -> None:
    """Add used_parts_purchase_mode to site_settings."""
    inspector = inspect(engine)
    if "site_settings" not in inspector.get_table_names():
        return

    columns = {col["name"] for col in inspector.get_columns("site_settings")}
    if "used_parts_purchase_mode" in columns:
        return

    if engine.dialect.name == "postgresql":
        stmt = (
            "ALTER TABLE site_settings ADD COLUMN used_parts_purchase_mode "
            "VARCHAR(20) NOT NULL DEFAULT 'both'"
        )
    else:
        stmt = (
            "ALTER TABLE site_settings ADD COLUMN used_parts_purchase_mode "
            "VARCHAR(20) NOT NULL DEFAULT 'both'"
        )

    with engine.begin() as conn:
        conn.execute(text(stmt))

    logger.info("Applied site_settings used_parts_purchase_mode column patch")


def ensure_site_settings_round_product_prices_column() -> None:
    """Add round_product_prices toggle to site_settings."""
    inspector = inspect(engine)
    if "site_settings" not in inspector.get_table_names():
        return

    columns = {col["name"] for col in inspector.get_columns("site_settings")}
    if "round_product_prices" in columns:
        return

    if engine.dialect.name == "postgresql":
        stmt = "ALTER TABLE site_settings ADD COLUMN round_product_prices BOOLEAN NOT NULL DEFAULT FALSE"
    else:
        stmt = "ALTER TABLE site_settings ADD COLUMN round_product_prices BOOLEAN NOT NULL DEFAULT 0"

    with engine.begin() as conn:
        conn.execute(text(stmt))

    logger.info("Applied site_settings round_product_prices column patch")


def ensure_site_settings_show_warehouse_inventory_column() -> None:
    """Add show_warehouse_inventory toggle to site_settings."""
    inspector = inspect(engine)
    if "site_settings" not in inspector.get_table_names():
        return

    columns = {col["name"] for col in inspector.get_columns("site_settings")}
    if "show_warehouse_inventory" in columns:
        return

    if engine.dialect.name == "postgresql":
        stmt = "ALTER TABLE site_settings ADD COLUMN show_warehouse_inventory BOOLEAN NOT NULL DEFAULT FALSE"
    else:
        stmt = "ALTER TABLE site_settings ADD COLUMN show_warehouse_inventory BOOLEAN NOT NULL DEFAULT 0"

    with engine.begin() as conn:
        conn.execute(text(stmt))

    logger.info("Applied site_settings show_warehouse_inventory column patch")


def ensure_site_settings_show_autoservice_column() -> None:
    """Add show_autoservice toggle to site_settings."""
    inspector = inspect(engine)
    if "site_settings" not in inspector.get_table_names():
        return

    columns = {col["name"] for col in inspector.get_columns("site_settings")}
    if "show_autoservice" in columns:
        return

    if engine.dialect.name == "postgresql":
        stmt = "ALTER TABLE site_settings ADD COLUMN show_autoservice BOOLEAN NOT NULL DEFAULT FALSE"
    else:
        stmt = "ALTER TABLE site_settings ADD COLUMN show_autoservice BOOLEAN NOT NULL DEFAULT 0"

    with engine.begin() as conn:
        conn.execute(text(stmt))

    logger.info("Applied site_settings show_autoservice column patch")


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


def ensure_chat_created_by_column() -> None:
    """Колонка создателя для пользовательских групповых чатов."""
    inspector = inspect(engine)
    if "chats" not in inspector.get_table_names():
        return
    columns = {col["name"] for col in inspector.get_columns("chats")}
    if "created_by_id" in columns:
        return
    with engine.begin() as conn:
        conn.execute(text("ALTER TABLE chats ADD COLUMN created_by_id INTEGER REFERENCES users(id)"))
    logger.info("Applied chats.created_by_id column patch")


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


def ensure_seo_new_part_url_exports_table() -> None:
    """Table tracking Rossko SEO card URLs in daily SEO export batches."""
    inspector = inspect(engine)
    if "seo_new_part_url_exports" in inspector.get_table_names():
        return

    dialect = engine.dialect.name
    with engine.begin() as conn:
        if dialect == "postgresql":
            conn.execute(
                text(
                    """
                    CREATE TABLE seo_new_part_url_exports (
                        id SERIAL PRIMARY KEY,
                        card_id INTEGER NOT NULL REFERENCES new_parts_seo_cards(id),
                        export_date DATE NOT NULL,
                        exported_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                        CONSTRAINT uq_seo_new_part_url_exports_card_id UNIQUE (card_id)
                    )
                    """
                )
            )
            conn.execute(
                text(
                    "CREATE INDEX IF NOT EXISTS ix_seo_new_part_url_exports_export_date "
                    "ON seo_new_part_url_exports (export_date)"
                )
            )
        else:
            conn.execute(
                text(
                    """
                    CREATE TABLE seo_new_part_url_exports (
                        id INTEGER PRIMARY KEY AUTOINCREMENT,
                        card_id INTEGER NOT NULL REFERENCES new_parts_seo_cards(id),
                        export_date DATE NOT NULL,
                        exported_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
                        UNIQUE (card_id)
                    )
                    """
                )
            )
            conn.execute(
                text(
                    "CREATE INDEX IF NOT EXISTS ix_seo_new_part_url_exports_export_date "
                    "ON seo_new_part_url_exports (export_date)"
                )
            )

    logger.info("Created seo_new_part_url_exports table")


def ensure_seo_sitemap_cache_table() -> None:
    """Table storing cached product sitemap XML."""
    inspector = inspect(engine)
    if "seo_sitemap_cache" in inspector.get_table_names():
        return

    dialect = engine.dialect.name
    with engine.begin() as conn:
        if dialect == "postgresql":
            conn.execute(
                text(
                    """
                    CREATE TABLE seo_sitemap_cache (
                        id SERIAL PRIMARY KEY,
                        cache_key VARCHAR(32) NOT NULL,
                        xml_content TEXT NOT NULL,
                        url_count INTEGER NOT NULL DEFAULT 0,
                        generated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                        CONSTRAINT uq_seo_sitemap_cache_cache_key UNIQUE (cache_key)
                    )
                    """
                )
            )
            conn.execute(
                text(
                    "CREATE INDEX IF NOT EXISTS ix_seo_sitemap_cache_cache_key "
                    "ON seo_sitemap_cache (cache_key)"
                )
            )
        else:
            conn.execute(
                text(
                    """
                    CREATE TABLE seo_sitemap_cache (
                        id INTEGER PRIMARY KEY AUTOINCREMENT,
                        cache_key VARCHAR(32) NOT NULL UNIQUE,
                        xml_content TEXT NOT NULL,
                        url_count INTEGER NOT NULL DEFAULT 0,
                        generated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
                    )
                    """
                )
            )
            conn.execute(
                text(
                    "CREATE INDEX IF NOT EXISTS ix_seo_sitemap_cache_cache_key "
                    "ON seo_sitemap_cache (cache_key)"
                )
            )

    logger.info("Created seo_sitemap_cache table")


def ensure_new_parts_seo_sync_log_table() -> None:
    """Log of product-pair → Rossko SEO card sync attempts."""
    inspector = inspect(engine)
    if "new_parts_seo_sync_log" in inspector.get_table_names():
        return

    dialect = engine.dialect.name
    with engine.begin() as conn:
        if dialect == "postgresql":
            conn.execute(
                text(
                    """
                    CREATE TABLE new_parts_seo_sync_log (
                        id SERIAL PRIMARY KEY,
                        lookup_key VARCHAR(255) NOT NULL,
                        lookup_brand VARCHAR(120) NOT NULL,
                        lookup_article VARCHAR(120) NOT NULL,
                        rossko_brand VARCHAR(120),
                        rossko_article VARCHAR(120),
                        seo_card_id INTEGER REFERENCES new_parts_seo_cards(id),
                        status VARCHAR(32) NOT NULL,
                        error_message TEXT,
                        checked_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                        next_retry_at TIMESTAMPTZ,
                        CONSTRAINT uq_new_parts_seo_sync_log_lookup_key UNIQUE (lookup_key)
                    )
                    """
                )
            )
            conn.execute(
                text(
                    "CREATE INDEX IF NOT EXISTS ix_new_parts_seo_sync_log_status "
                    "ON new_parts_seo_sync_log (status)"
                )
            )
            conn.execute(
                text(
                    "CREATE INDEX IF NOT EXISTS ix_new_parts_seo_sync_log_checked_at "
                    "ON new_parts_seo_sync_log (checked_at)"
                )
            )
            conn.execute(
                text(
                    "CREATE INDEX IF NOT EXISTS ix_new_parts_seo_sync_log_next_retry_at "
                    "ON new_parts_seo_sync_log (next_retry_at)"
                )
            )
        else:
            conn.execute(
                text(
                    """
                    CREATE TABLE new_parts_seo_sync_log (
                        id INTEGER PRIMARY KEY AUTOINCREMENT,
                        lookup_key VARCHAR(255) NOT NULL UNIQUE,
                        lookup_brand VARCHAR(120) NOT NULL,
                        lookup_article VARCHAR(120) NOT NULL,
                        rossko_brand VARCHAR(120),
                        rossko_article VARCHAR(120),
                        seo_card_id INTEGER REFERENCES new_parts_seo_cards(id),
                        status VARCHAR(32) NOT NULL,
                        error_message TEXT,
                        checked_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
                        next_retry_at TIMESTAMP
                    )
                    """
                )
            )
            conn.execute(
                text(
                    "CREATE INDEX IF NOT EXISTS ix_new_parts_seo_sync_log_status "
                    "ON new_parts_seo_sync_log (status)"
                )
            )

    logger.info("Created new_parts_seo_sync_log table")


def ensure_seo_sync_pending_candidates_table() -> None:
    inspector = inspect(engine)
    if "seo_sync_pending_candidates" in inspector.get_table_names():
        return

    dialect = engine.dialect.name
    with engine.begin() as conn:
        if dialect == "postgresql":
            conn.execute(
                text(
                    """
                    CREATE TABLE seo_sync_pending_candidates (
                        lookup_key VARCHAR(255) PRIMARY KEY,
                        brand VARCHAR(120) NOT NULL,
                        article VARCHAR(120) NOT NULL,
                        source VARCHAR(32) NOT NULL DEFAULT 'cross',
                        priority INTEGER NOT NULL DEFAULT 100,
                        discovered_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
                    )
                    """
                )
            )
            conn.execute(
                text(
                    "CREATE INDEX IF NOT EXISTS ix_seo_sync_pending_candidates_source "
                    "ON seo_sync_pending_candidates (source)"
                )
            )
        else:
            conn.execute(
                text(
                    """
                    CREATE TABLE seo_sync_pending_candidates (
                        lookup_key VARCHAR(255) PRIMARY KEY,
                        brand VARCHAR(120) NOT NULL,
                        article VARCHAR(120) NOT NULL,
                        source VARCHAR(32) NOT NULL DEFAULT 'cross',
                        priority INTEGER NOT NULL DEFAULT 100,
                        discovered_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
                    )
                    """
                )
            )
    logger.info("Created seo_sync_pending_candidates table")


def ensure_seo_rossko_seed_queue_table() -> None:
    inspector = inspect(engine)
    if "seo_rossko_seed_queue" in inspector.get_table_names():
        return

    dialect = engine.dialect.name
    with engine.begin() as conn:
        if dialect == "postgresql":
            conn.execute(
                text(
                    """
                    CREATE TABLE seo_rossko_seed_queue (
                        lookup_key VARCHAR(255) PRIMARY KEY,
                        brand VARCHAR(120) NOT NULL,
                        article VARCHAR(120) NOT NULL,
                        source VARCHAR(32) NOT NULL DEFAULT 'product',
                        status VARCHAR(32) NOT NULL DEFAULT 'pending',
                        priority INTEGER NOT NULL DEFAULT 100,
                        rossko_payload_json TEXT,
                        rossko_checked_at TIMESTAMPTZ,
                        next_retry_at TIMESTAMPTZ,
                        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
                    )
                    """
                )
            )
            conn.execute(
                text(
                    "CREATE INDEX IF NOT EXISTS ix_seo_rossko_seed_queue_status "
                    "ON seo_rossko_seed_queue (status)"
                )
            )
            conn.execute(
                text(
                    "CREATE INDEX IF NOT EXISTS ix_seo_rossko_seed_queue_source "
                    "ON seo_rossko_seed_queue (source)"
                )
            )
        else:
            conn.execute(
                text(
                    """
                    CREATE TABLE seo_rossko_seed_queue (
                        lookup_key VARCHAR(255) PRIMARY KEY,
                        brand VARCHAR(120) NOT NULL,
                        article VARCHAR(120) NOT NULL,
                        source VARCHAR(32) NOT NULL DEFAULT 'product',
                        status VARCHAR(32) NOT NULL DEFAULT 'pending',
                        priority INTEGER NOT NULL DEFAULT 100,
                        rossko_payload_json TEXT,
                        rossko_checked_at TIMESTAMP,
                        next_retry_at TIMESTAMP,
                        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
                        updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
                    )
                    """
                )
            )
    logger.info("Created seo_rossko_seed_queue table")


def ensure_seo_sync_daily_counters_table() -> None:
    inspector = inspect(engine)
    if "seo_sync_daily_counters" in inspector.get_table_names():
        return

    dialect = engine.dialect.name
    with engine.begin() as conn:
        if dialect == "postgresql":
            conn.execute(
                text(
                    """
                    CREATE TABLE seo_sync_daily_counters (
                        stat_date DATE PRIMARY KEY,
                        cross_recurse_calls INTEGER NOT NULL DEFAULT 0,
                        precheck_calls INTEGER NOT NULL DEFAULT 0
                    )
                    """
                )
            )
        else:
            conn.execute(
                text(
                    """
                    CREATE TABLE seo_sync_daily_counters (
                        stat_date DATE PRIMARY KEY,
                        cross_recurse_calls INTEGER NOT NULL DEFAULT 0,
                        precheck_calls INTEGER NOT NULL DEFAULT 0
                    )
                    """
                )
            )
    logger.info("Created seo_sync_daily_counters table")


def ensure_seo_sync_daily_counters_created_by_source_column() -> None:
    inspector = inspect(engine)
    if "seo_sync_daily_counters" not in inspector.get_table_names():
        return

    columns = {col["name"] for col in inspector.get_columns("seo_sync_daily_counters")}
    if "created_by_source_json" in columns:
        return

    dialect = engine.dialect.name
    with engine.begin() as conn:
        if dialect == "postgresql":
            conn.execute(
                text("ALTER TABLE seo_sync_daily_counters ADD COLUMN created_by_source_json TEXT")
            )
        else:
            conn.execute(
                text("ALTER TABLE seo_sync_daily_counters ADD COLUMN created_by_source_json TEXT")
            )
    logger.info("Applied seo_sync_daily_counters.created_by_source_json column patch")


def ensure_seo_pipeline_state_table() -> None:
    inspector = inspect(engine)
    if "seo_pipeline_state" in inspector.get_table_names():
        return

    dialect = engine.dialect.name
    with engine.begin() as conn:
        if dialect == "postgresql":
            conn.execute(
                text(
                    """
                    CREATE TABLE seo_pipeline_state (
                        id INTEGER PRIMARY KEY DEFAULT 1,
                        tecdoc_direct_cursor INTEGER NOT NULL DEFAULT 0,
                        tecdoc_cross_cursor INTEGER NOT NULL DEFAULT 0
                    )
                    """
                )
            )
            conn.execute(
                text(
                    """
                    INSERT INTO seo_pipeline_state (id, tecdoc_direct_cursor, tecdoc_cross_cursor)
                    VALUES (1, 0, 0)
                    ON CONFLICT (id) DO NOTHING
                    """
                )
            )
        else:
            conn.execute(
                text(
                    """
                    CREATE TABLE seo_pipeline_state (
                        id INTEGER PRIMARY KEY,
                        tecdoc_direct_cursor INTEGER NOT NULL DEFAULT 0,
                        tecdoc_cross_cursor INTEGER NOT NULL DEFAULT 0
                    )
                    """
                )
            )
            conn.execute(
                text(
                    """
                    INSERT OR IGNORE INTO seo_pipeline_state (id, tecdoc_direct_cursor, tecdoc_cross_cursor)
                    VALUES (1, 0, 0)
                    """
                )
            )
    logger.info("Created seo_pipeline_state table")


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


def ensure_user_notification_preference_columns() -> None:
    """Add notification preference columns to users if missing."""
    inspector = inspect(engine)
    if "users" not in inspector.get_table_names():
        return

    columns = {col["name"] for col in inspector.get_columns("users")}
    patches: list[str] = []
    if "notify_push_enabled" not in columns:
        patches.append("ALTER TABLE users ADD COLUMN notify_push_enabled BOOLEAN NOT NULL DEFAULT TRUE")
    if "notify_email_enabled" not in columns:
        patches.append("ALTER TABLE users ADD COLUMN notify_email_enabled BOOLEAN NOT NULL DEFAULT TRUE")

    if not patches:
        return

    with engine.begin() as conn:
        for stmt in patches:
            conn.execute(text(stmt))

    logger.info("Applied users notification preference columns patch")


def ensure_user_notification_prefs_column() -> None:
    """Add per-category notification_prefs JSONB column and migrate legacy toggles."""
    inspector = inspect(engine)
    if "users" not in inspector.get_table_names():
        return

    columns = {col["name"] for col in inspector.get_columns("users")}
    default_json = (
        '{"orders":{"push":true,"email":true},'
        '"messages":{"push":true,"email":true},'
        '"search":{"push":true,"email":true},'
        '"other":{"push":true,"email":true}}'
    )

    with engine.begin() as conn:
        if "notification_prefs" not in columns:
            conn.execute(
                text(
                    "ALTER TABLE users ADD COLUMN notification_prefs JSONB "
                    "NOT NULL DEFAULT CAST(:default_json AS jsonb)"
                ),
                {"default_json": default_json},
            )
            logger.info("Added users.notification_prefs column")

        conn.execute(
            text(
                """
                UPDATE users
                SET notification_prefs = jsonb_build_object(
                    'orders', jsonb_build_object(
                        'push', COALESCE(notify_push_enabled, TRUE),
                        'email', COALESCE(notify_email_enabled, TRUE)
                    ),
                    'messages', jsonb_build_object(
                        'push', COALESCE(notify_push_enabled, TRUE),
                        'email', COALESCE(notify_email_enabled, TRUE)
                    ),
                    'search', jsonb_build_object(
                        'push', COALESCE(notify_push_enabled, TRUE),
                        'email', COALESCE(notify_email_enabled, TRUE)
                    ),
                    'other', jsonb_build_object(
                        'push', COALESCE(notify_push_enabled, TRUE),
                        'email', COALESCE(notify_email_enabled, TRUE)
                    )
                )
                WHERE notification_prefs IS NULL
                   OR notification_prefs = '{}'::jsonb
                """
            )
        )

    logger.info("Applied users notification_prefs migration patch")


def ensure_product_photo_thumb_url_column() -> None:
    """Add thumb_url column to product_photos if missing."""
    inspector = inspect(engine)
    if "product_photos" not in inspector.get_table_names():
        return

    columns = {col["name"] for col in inspector.get_columns("product_photos")}
    if "thumb_url" in columns:
        return

    with engine.begin() as conn:
        conn.execute(text("ALTER TABLE product_photos ADD COLUMN thumb_url TEXT"))

    logger.info("Applied product_photos.thumb_url column patch")


def ensure_rossko_settings_table() -> None:
    """Create rossko_settings table and default row id=1."""
    inspector = inspect(engine)
    if "rossko_settings" not in inspector.get_table_names():
        if engine.dialect.name == "postgresql":
            ddl = """
            CREATE TABLE rossko_settings (
                id INTEGER PRIMARY KEY,
                delivery_id VARCHAR(64),
                address_id VARCHAR(64),
                payment_id INTEGER,
                requisite_id INTEGER,
                contact_name VARCHAR(255) NOT NULL DEFAULT '',
                contact_phone VARCHAR(50) NOT NULL DEFAULT '',
                default_comment TEXT,
                delivery_parts BOOLEAN NOT NULL DEFAULT FALSE,
                delivery_name VARCHAR(255),
                address_label VARCHAR(512),
                payment_name VARCHAR(255),
                requisite_name VARCHAR(255),
                is_pickup BOOLEAN,
                requires_address BOOLEAN,
                requires_requisite BOOLEAN,
                updated_at TIMESTAMPTZ DEFAULT NOW(),
                updated_by_user_id INTEGER REFERENCES users(id)
            )
            """
        else:
            ddl = """
            CREATE TABLE rossko_settings (
                id INTEGER PRIMARY KEY,
                delivery_id VARCHAR(64),
                address_id VARCHAR(64),
                payment_id INTEGER,
                requisite_id INTEGER,
                contact_name VARCHAR(255) NOT NULL DEFAULT '',
                contact_phone VARCHAR(50) NOT NULL DEFAULT '',
                default_comment TEXT,
                delivery_parts BOOLEAN NOT NULL DEFAULT 0,
                delivery_name VARCHAR(255),
                address_label VARCHAR(512),
                payment_name VARCHAR(255),
                requisite_name VARCHAR(255),
                is_pickup BOOLEAN,
                requires_address BOOLEAN,
                requires_requisite BOOLEAN,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_by_user_id INTEGER REFERENCES users(id)
            )
            """
        with engine.begin() as conn:
            conn.execute(text(ddl))
        logger.info("Created rossko_settings table")

    _seed_default_row()


def _rossko_settings_seed_sql() -> str:
    if engine.dialect.name == "postgresql":
        return """
            INSERT INTO rossko_settings (
                id, contact_name, contact_phone, delivery_parts
            )
            SELECT 1, '', '', FALSE
            WHERE NOT EXISTS (SELECT 1 FROM rossko_settings WHERE id = 1)
        """
    return """
        INSERT INTO rossko_settings (
            id, contact_name, contact_phone, delivery_parts
        )
        SELECT 1, '', '', 0
        WHERE NOT EXISTS (SELECT 1 FROM rossko_settings WHERE id = 1)
    """


def _seed_default_row() -> None:
    with engine.begin() as conn:
        conn.execute(text(_rossko_settings_seed_sql()))


def ensure_rossko_settings_row_defaults() -> None:
    """Fix NULLs in default row and add DB defaults if table was created via create_all."""
    inspector = inspect(engine)
    if "rossko_settings" not in inspector.get_table_names():
        return

    columns = {col["name"]: col for col in inspector.get_columns("rossko_settings")}
    statements: list[str] = []

    if "contact_name" in columns:
        statements.append(
            "UPDATE rossko_settings SET contact_name = '' "
            "WHERE id = 1 AND contact_name IS NULL"
        )
    if "contact_phone" in columns:
        statements.append(
            "UPDATE rossko_settings SET contact_phone = '' "
            "WHERE id = 1 AND contact_phone IS NULL"
        )
    if "delivery_parts" in columns:
        if engine.dialect.name == "postgresql":
            statements.append(
                "UPDATE rossko_settings SET delivery_parts = FALSE "
                "WHERE id = 1 AND delivery_parts IS NULL"
            )
        else:
            statements.append(
                "UPDATE rossko_settings SET delivery_parts = 0 "
                "WHERE id = 1 AND delivery_parts IS NULL"
            )

    with engine.begin() as conn:
        for stmt in statements:
            conn.execute(text(stmt))
        conn.execute(text(_rossko_settings_seed_sql()))

    logger.info("Applied rossko_settings row defaults patch")


def ensure_garage_new_order_rossko_columns() -> None:
    """Add Rossko order linkage columns to garage_new_orders."""
    inspector = inspect(engine)
    if "garage_new_orders" not in inspector.get_table_names():
        return

    columns = {col["name"] for col in inspector.get_columns("garage_new_orders")}
    statements: list[str] = []
    if "rossko_order_id" not in columns:
        statements.append("ALTER TABLE garage_new_orders ADD COLUMN rossko_order_id VARCHAR(64)")
    if "rossko_response_raw" not in columns:
        col_type = "TEXT" if engine.dialect.name == "postgresql" else "TEXT"
        statements.append(f"ALTER TABLE garage_new_orders ADD COLUMN rossko_response_raw {col_type}")

    if not statements:
        return
    with engine.begin() as conn:
        for stmt in statements:
            conn.execute(text(stmt))
    logger.info("Applied garage_new_orders Rossko column patches: %s", statements)


def ensure_garage_new_order_item_seo_card_column() -> None:
    """Ссылка на SEO-карточку новой запчасти в позиции заказа."""
    inspector = inspect(engine)
    if "garage_new_order_items" not in inspector.get_table_names():
        return

    columns = {col["name"] for col in inspector.get_columns("garage_new_order_items")}
    if "seo_card_id" in columns:
        return

    with engine.begin() as conn:
        conn.execute(
            text(
                "ALTER TABLE garage_new_order_items "
                "ADD COLUMN seo_card_id INTEGER REFERENCES new_parts_seo_cards(id)"
            )
        )
        conn.execute(
            text(
                "CREATE INDEX IF NOT EXISTS ix_garage_new_order_items_seo_card_id "
                "ON garage_new_order_items (seo_card_id)"
            )
        )
    logger.info("Applied garage_new_order_items.seo_card_id column patch")


def ensure_garage_new_order_user_id_column() -> None:
    """Add user_id column to garage_new_orders for buyer linkage."""
    inspector = inspect(engine)
    if "garage_new_orders" not in inspector.get_table_names():
        return

    columns = {col["name"] for col in inspector.get_columns("garage_new_orders")}
    if "user_id" in columns:
        return

    with engine.begin() as conn:
        if engine.dialect.name == "postgresql":
            conn.execute(
                text(
                    "ALTER TABLE garage_new_orders "
                    "ADD COLUMN user_id INTEGER REFERENCES users(id)"
                )
            )
            conn.execute(
                text(
                    "CREATE INDEX IF NOT EXISTS ix_garage_new_orders_user_id "
                    "ON garage_new_orders (user_id)"
                )
            )
        else:
            conn.execute(text("ALTER TABLE garage_new_orders ADD COLUMN user_id INTEGER"))
            conn.execute(
                text(
                    "CREATE INDEX IF NOT EXISTS ix_garage_new_orders_user_id "
                    "ON garage_new_orders (user_id)"
                )
            )

    logger.info("Applied garage_new_orders.user_id column patch")


def ensure_garage_used_order_user_id_column() -> None:
    """Add user_id column to garage_used_orders for buyer linkage."""
    inspector = inspect(engine)
    if "garage_used_orders" not in inspector.get_table_names():
        return

    columns = {col["name"] for col in inspector.get_columns("garage_used_orders")}
    if "user_id" in columns:
        return

    with engine.begin() as conn:
        if engine.dialect.name == "postgresql":
            conn.execute(
                text(
                    "ALTER TABLE garage_used_orders "
                    "ADD COLUMN user_id INTEGER REFERENCES users(id)"
                )
            )
            conn.execute(
                text(
                    "CREATE INDEX IF NOT EXISTS ix_garage_used_orders_user_id "
                    "ON garage_used_orders (user_id)"
                )
            )
        else:
            conn.execute(text("ALTER TABLE garage_used_orders ADD COLUMN user_id INTEGER"))
            conn.execute(
                text(
                    "CREATE INDEX IF NOT EXISTS ix_garage_used_orders_user_id "
                    "ON garage_used_orders (user_id)"
                )
            )

    logger.info("Applied garage_used_orders.user_id column patch")


def ensure_garage_used_order_buyer_comment_column() -> None:
    """Add buyer_comment column to garage_used_orders."""
    inspector = inspect(engine)
    if "garage_used_orders" not in inspector.get_table_names():
        return

    columns = {col["name"] for col in inspector.get_columns("garage_used_orders")}
    if "buyer_comment" in columns:
        return

    with engine.begin() as conn:
        conn.execute(text("ALTER TABLE garage_used_orders ADD COLUMN buyer_comment TEXT"))

    logger.info("Applied garage_used_orders.buyer_comment column patch")


def ensure_cart_max_quantity_columns() -> None:
    """Add max_quantity to new-parts cart tables for stock limits."""
    inspector = inspect(engine)
    table_names = set(inspector.get_table_names())
    statements: list[str] = []

    for table in ("new_parts_cart", "guest_new_parts_cart"):
        if table not in table_names:
            continue
        columns = {col["name"] for col in inspector.get_columns(table)}
        if "max_quantity" not in columns:
            statements.append(f"ALTER TABLE {table} ADD COLUMN max_quantity INTEGER")

    if not statements:
        return

    with engine.begin() as conn:
        for stmt in statements:
            conn.execute(text(stmt))

    logger.info("Applied cart max_quantity column patches: %s", statements)


def ensure_yookassa_payment_tables() -> None:
    """Create checkout session and YooKassa payment tables if missing."""
    inspector = inspect(engine)
    existing = set(inspector.get_table_names())

    with engine.begin() as conn:
        if "new_parts_checkout_sessions" not in existing:
            if engine.dialect.name == "postgresql":
                conn.execute(
                    text(
                        """
                        CREATE TABLE new_parts_checkout_sessions (
                            id VARCHAR(36) PRIMARY KEY,
                            user_id INTEGER NOT NULL REFERENCES users(id),
                            status VARCHAR(32) NOT NULL DEFAULT 'awaiting_payment',
                            amount DOUBLE PRECISION NOT NULL DEFAULT 0,
                            currency VARCHAR(3) NOT NULL DEFAULT 'RUB',
                            order_payload TEXT NOT NULL DEFAULT '{}',
                            cart_snapshot TEXT NOT NULL DEFAULT '[]',
                            garage_order_id INTEGER REFERENCES garage_new_orders(id),
                            expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
                            created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
                            updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
                        )
                        """
                    )
                )
            else:
                conn.execute(
                    text(
                        """
                        CREATE TABLE new_parts_checkout_sessions (
                            id VARCHAR(36) PRIMARY KEY,
                            user_id INTEGER NOT NULL REFERENCES users(id),
                            status VARCHAR(32) NOT NULL DEFAULT 'awaiting_payment',
                            amount REAL NOT NULL DEFAULT 0,
                            currency VARCHAR(3) NOT NULL DEFAULT 'RUB',
                            order_payload TEXT NOT NULL DEFAULT '{}',
                            cart_snapshot TEXT NOT NULL DEFAULT '[]',
                            garage_order_id INTEGER REFERENCES garage_new_orders(id),
                            expires_at TIMESTAMP NOT NULL,
                            created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
                            updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
                        )
                        """
                    )
                )
            conn.execute(
                text(
                    "CREATE INDEX IF NOT EXISTS ix_np_checkout_sessions_user_id "
                    "ON new_parts_checkout_sessions (user_id)"
                )
            )
            conn.execute(
                text(
                    "CREATE INDEX IF NOT EXISTS ix_np_checkout_sessions_status "
                    "ON new_parts_checkout_sessions (status)"
                )
            )

        if "yookassa_payments" not in existing:
            if engine.dialect.name == "postgresql":
                conn.execute(
                    text(
                        """
                        CREATE TABLE yookassa_payments (
                            id VARCHAR(36) PRIMARY KEY,
                            idempotence_key VARCHAR(36) NOT NULL UNIQUE,
                            session_id VARCHAR(36) NOT NULL
                                REFERENCES new_parts_checkout_sessions(id) ON DELETE CASCADE,
                            user_id INTEGER NOT NULL REFERENCES users(id),
                            yookassa_payment_id VARCHAR(64) UNIQUE,
                            payment_method_type VARCHAR(32) NOT NULL,
                            status VARCHAR(32) NOT NULL DEFAULT 'pending',
                            amount_value DOUBLE PRECISION NOT NULL DEFAULT 0,
                            amount_currency VARCHAR(3) NOT NULL DEFAULT 'RUB',
                            paid_at TIMESTAMP WITH TIME ZONE,
                            description VARCHAR(255),
                            confirmation_type VARCHAR(32),
                            confirmation_url TEXT,
                            qr_payload TEXT,
                            receipt_snapshot TEXT,
                            payment_metadata TEXT,
                            raw_create_response TEXT,
                            raw_webhook_payload TEXT,
                            captured BOOLEAN,
                            refundable BOOLEAN,
                            created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
                            updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
                        )
                        """
                    )
                )
            else:
                conn.execute(
                    text(
                        """
                        CREATE TABLE yookassa_payments (
                            id VARCHAR(36) PRIMARY KEY,
                            idempotence_key VARCHAR(36) NOT NULL UNIQUE,
                            session_id VARCHAR(36) NOT NULL
                                REFERENCES new_parts_checkout_sessions(id) ON DELETE CASCADE,
                            user_id INTEGER NOT NULL REFERENCES users(id),
                            yookassa_payment_id VARCHAR(64) UNIQUE,
                            payment_method_type VARCHAR(32) NOT NULL,
                            status VARCHAR(32) NOT NULL DEFAULT 'pending',
                            amount_value REAL NOT NULL DEFAULT 0,
                            amount_currency VARCHAR(3) NOT NULL DEFAULT 'RUB',
                            paid_at TIMESTAMP,
                            description VARCHAR(255),
                            confirmation_type VARCHAR(32),
                            confirmation_url TEXT,
                            qr_payload TEXT,
                            receipt_snapshot TEXT,
                            payment_metadata TEXT,
                            raw_create_response TEXT,
                            raw_webhook_payload TEXT,
                            captured BOOLEAN,
                            refundable BOOLEAN,
                            created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
                            updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
                        )
                        """
                    )
                )
            conn.execute(
                text(
                    "CREATE INDEX IF NOT EXISTS ix_yookassa_payments_session_id "
                    "ON yookassa_payments (session_id)"
                )
            )
            conn.execute(
                text(
                    "CREATE INDEX IF NOT EXISTS ix_yookassa_payments_yk_id "
                    "ON yookassa_payments (yookassa_payment_id)"
                )
            )

    logger.info("Applied YooKassa payment tables patch")


def ensure_yookassa_refund_columns() -> None:
    """Колонки возврата в yookassa_payments."""
    inspector = inspect(engine)
    if "yookassa_payments" not in inspector.get_table_names():
        return

    columns = {col["name"] for col in inspector.get_columns("yookassa_payments")}
    statements: list[str] = []
    if "refund_id" not in columns:
        statements.append("ALTER TABLE yookassa_payments ADD COLUMN refund_id VARCHAR(64)")
    if "refund_status" not in columns:
        statements.append("ALTER TABLE yookassa_payments ADD COLUMN refund_status VARCHAR(32)")

    if not statements:
        return
    with engine.begin() as conn:
        for stmt in statements:
            conn.execute(text(stmt))
    logger.info("Applied yookassa_payments refund column patches: %s", statements)


def ensure_garage_new_order_yookassa_columns() -> None:
    """Add YooKassa linkage columns to garage_new_orders."""
    inspector = inspect(engine)
    if "garage_new_orders" not in inspector.get_table_names():
        return

    columns = {col["name"] for col in inspector.get_columns("garage_new_orders")}
    statements: list[str] = []
    if "checkout_session_id" not in columns:
        statements.append(
            "ALTER TABLE garage_new_orders ADD COLUMN checkout_session_id VARCHAR(36)"
        )
    if "yookassa_payment_id" not in columns:
        statements.append(
            "ALTER TABLE garage_new_orders ADD COLUMN yookassa_payment_id VARCHAR(64)"
        )

    if not statements:
        return
    with engine.begin() as conn:
        for stmt in statements:
            conn.execute(text(stmt))
    logger.info("Applied garage_new_orders YooKassa column patches: %s", statements)


def ensure_seo_landing_pages_table() -> None:
    """Create seo_landing_pages table for brand/category/geo SEO landings."""
    inspector = inspect(engine)
    if "seo_landing_pages" in inspector.get_table_names():
        return

    if engine.dialect.name == "postgresql":
        ddl = """
        CREATE TABLE seo_landing_pages (
            id SERIAL PRIMARY KEY,
            kind VARCHAR(32) NOT NULL,
            slug VARCHAR(120) NOT NULL,
            title_ru VARCHAR(255) NOT NULL,
            search_query VARCHAR(255),
            brand_name VARCHAR(120),
            part_type_id INTEGER REFERENCES part_types(id),
            city VARCHAR(120),
            meta_title VARCHAR(255),
            meta_description VARCHAR(512),
            intro_html TEXT,
            is_active BOOLEAN NOT NULL DEFAULT TRUE,
            priority INTEGER NOT NULL DEFAULT 0,
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            CONSTRAINT uq_seo_landing_pages_kind_slug UNIQUE (kind, slug)
        )
        """
    else:
        ddl = """
        CREATE TABLE seo_landing_pages (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            kind VARCHAR(32) NOT NULL,
            slug VARCHAR(120) NOT NULL,
            title_ru VARCHAR(255) NOT NULL,
            search_query VARCHAR(255),
            brand_name VARCHAR(120),
            part_type_id INTEGER REFERENCES part_types(id),
            city VARCHAR(120),
            meta_title VARCHAR(255),
            meta_description VARCHAR(512),
            intro_html TEXT,
            is_active BOOLEAN NOT NULL DEFAULT 1,
            priority INTEGER NOT NULL DEFAULT 0,
            created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            UNIQUE (kind, slug)
        )
        """

    with engine.begin() as conn:
        conn.execute(text(ddl))
        conn.execute(text("CREATE INDEX IF NOT EXISTS ix_seo_landing_pages_kind ON seo_landing_pages (kind)"))
        conn.execute(text("CREATE INDEX IF NOT EXISTS ix_seo_landing_pages_slug ON seo_landing_pages (slug)"))

    logger.info("Applied seo_landing_pages table patch")


def ensure_openrouter_tables() -> None:
    """Create OpenRouter integration, org allowlist, and generation log tables."""
    inspector = inspect(engine)
    table_names = set(inspector.get_table_names())

    if "site_openrouter_integration" not in table_names:
        if engine.dialect.name == "postgresql":
            ddl = """
            CREATE TABLE site_openrouter_integration (
                id INTEGER PRIMARY KEY,
                api_key_encrypted TEXT,
                model_id VARCHAR(128) NOT NULL DEFAULT 'meta-llama/llama-3.3-70b-instruct:free',
                is_enabled BOOLEAN NOT NULL DEFAULT FALSE,
                daily_limit INTEGER NOT NULL DEFAULT 50,
                requests_today INTEGER NOT NULL DEFAULT 0,
                requests_today_date DATE,
                per_org_daily_limit INTEGER NOT NULL DEFAULT 10,
                created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
            )
            """
        else:
            ddl = """
            CREATE TABLE site_openrouter_integration (
                id INTEGER PRIMARY KEY,
                api_key_encrypted TEXT,
                model_id VARCHAR(128) NOT NULL DEFAULT 'meta-llama/llama-3.3-70b-instruct:free',
                is_enabled BOOLEAN NOT NULL DEFAULT 0,
                daily_limit INTEGER NOT NULL DEFAULT 50,
                requests_today INTEGER NOT NULL DEFAULT 0,
                requests_today_date DATE,
                per_org_daily_limit INTEGER NOT NULL DEFAULT 10,
                created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
            )
            """
        with engine.begin() as conn:
            conn.execute(text(ddl))
            conn.execute(
                text(
                    "INSERT INTO site_openrouter_integration (id, is_enabled, daily_limit, per_org_daily_limit) "
                    "VALUES (1, FALSE, 50, 10)"
                    if engine.dialect.name == "postgresql"
                    else "INSERT INTO site_openrouter_integration (id, is_enabled, daily_limit, per_org_daily_limit) "
                    "VALUES (1, 0, 50, 10)"
                )
            )
        logger.info("Applied site_openrouter_integration table patch")

    if "organization_ai_description_access" not in table_names:
        if engine.dialect.name == "postgresql":
            ddl = """
            CREATE TABLE organization_ai_description_access (
                organization_id VARCHAR(10) PRIMARY KEY REFERENCES organizations(id) ON DELETE CASCADE,
                is_enabled BOOLEAN NOT NULL DEFAULT TRUE,
                enabled_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                enabled_by_user_id INTEGER REFERENCES users(id),
                notes VARCHAR(255)
            )
            """
        else:
            ddl = """
            CREATE TABLE organization_ai_description_access (
                organization_id VARCHAR(10) PRIMARY KEY REFERENCES organizations(id) ON DELETE CASCADE,
                is_enabled BOOLEAN NOT NULL DEFAULT 1,
                enabled_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
                enabled_by_user_id INTEGER REFERENCES users(id),
                notes VARCHAR(255)
            )
            """
        with engine.begin() as conn:
            conn.execute(text(ddl))
        logger.info("Applied organization_ai_description_access table patch")

    if "ai_description_generation_log" not in table_names:
        if engine.dialect.name == "postgresql":
            ddl = """
            CREATE TABLE ai_description_generation_log (
                id SERIAL PRIMARY KEY,
                organization_id VARCHAR(10) NOT NULL REFERENCES organizations(id),
                user_id INTEGER NOT NULL REFERENCES users(id),
                product_id INTEGER REFERENCES products(id),
                brand VARCHAR(120),
                article VARCHAR(120),
                model_id VARCHAR(128),
                tokens_used INTEGER,
                status VARCHAR(32) NOT NULL DEFAULT 'success',
                error_message TEXT,
                created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
            )
            """
        else:
            ddl = """
            CREATE TABLE ai_description_generation_log (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                organization_id VARCHAR(10) NOT NULL REFERENCES organizations(id),
                user_id INTEGER NOT NULL REFERENCES users(id),
                product_id INTEGER REFERENCES products(id),
                brand VARCHAR(120),
                article VARCHAR(120),
                model_id VARCHAR(128),
                tokens_used INTEGER,
                status VARCHAR(32) NOT NULL DEFAULT 'success',
                error_message TEXT,
                created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
            )
            """
        with engine.begin() as conn:
            conn.execute(text(ddl))
            conn.execute(
                text(
                    "CREATE INDEX IF NOT EXISTS ix_ai_desc_log_org_created "
                    "ON ai_description_generation_log (organization_id, created_at)"
                )
            )
        logger.info("Applied ai_description_generation_log table patch")


def ensure_laximo_cat_tables() -> None:
    """Create Laximo.CAT integration singleton table."""
    inspector = inspect(engine)
    table_names = set(inspector.get_table_names())

    if "site_laximo_cat_integration" not in table_names:
        if engine.dialect.name == "postgresql":
            ddl = """
            CREATE TABLE site_laximo_cat_integration (
                id INTEGER PRIMARY KEY,
                login_encrypted TEXT,
                password_encrypted TEXT,
                base_url VARCHAR(512) NOT NULL DEFAULT 'https://ws.laximo.ru/restApi/v1',
                is_enabled BOOLEAN NOT NULL DEFAULT FALSE,
                last_test_ok BOOLEAN NOT NULL DEFAULT FALSE,
                last_tested_at TIMESTAMPTZ,
                last_test_error TEXT,
                last_test_catalogs_count INTEGER,
                daily_request_limit INTEGER NOT NULL DEFAULT 500,
                requests_today INTEGER NOT NULL DEFAULT 0,
                requests_day DATE,
                quota_exhausted_at TIMESTAMPTZ,
                last_upstream_error_at TIMESTAMPTZ,
                last_upstream_error TEXT,
                created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
            )
            """
            seed = (
                "INSERT INTO site_laximo_cat_integration "
                "(id, is_enabled, last_test_ok, daily_request_limit, requests_today) "
                "VALUES (1, FALSE, FALSE, 500, 0) "
                "ON CONFLICT (id) DO NOTHING"
            )
        else:
            ddl = """
            CREATE TABLE site_laximo_cat_integration (
                id INTEGER PRIMARY KEY,
                login_encrypted TEXT,
                password_encrypted TEXT,
                base_url VARCHAR(512) NOT NULL DEFAULT 'https://ws.laximo.ru/restApi/v1',
                is_enabled BOOLEAN NOT NULL DEFAULT 0,
                last_test_ok BOOLEAN NOT NULL DEFAULT 0,
                last_tested_at DATETIME,
                last_test_error TEXT,
                last_test_catalogs_count INTEGER,
                daily_request_limit INTEGER NOT NULL DEFAULT 500,
                requests_today INTEGER NOT NULL DEFAULT 0,
                requests_day DATE,
                quota_exhausted_at DATETIME,
                last_upstream_error_at DATETIME,
                last_upstream_error TEXT,
                created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
            )
            """
            seed = (
                "INSERT INTO site_laximo_cat_integration "
                "(id, is_enabled, last_test_ok, daily_request_limit, requests_today) "
                "VALUES (1, 0, 0, 500, 0)"
            )
        with engine.begin() as conn:
            conn.execute(text(ddl))
            conn.execute(text(seed))
        logger.info("Applied site_laximo_cat_integration table patch")

    ensure_laximo_doc_columns()


def ensure_laximo_doc_columns() -> None:
    """Add Laximo.DOC credential/gate columns to site_laximo_cat_integration."""
    inspector = inspect(engine)
    table_names = set(inspector.get_table_names())
    if "site_laximo_cat_integration" not in table_names:
        return

    columns = {col["name"] for col in inspector.get_columns("site_laximo_cat_integration")}
    is_pg = engine.dialect.name == "postgresql"
    bool_false = "FALSE" if is_pg else "0"
    ts = "TIMESTAMPTZ" if is_pg else "DATETIME"
    statements = []

    patches = [
        ("doc_login_encrypted", "TEXT"),
        ("doc_password_encrypted", "TEXT"),
        (
            "doc_base_url",
            "VARCHAR(512) NOT NULL DEFAULT 'https://ws.laximo.ru/restApi/v1'",
        ),
        ("doc_is_enabled", f"BOOLEAN NOT NULL DEFAULT {bool_false}"),
        ("doc_last_test_ok", f"BOOLEAN NOT NULL DEFAULT {bool_false}"),
        ("doc_last_tested_at", ts),
        ("doc_last_test_error", "TEXT"),
        ("doc_requests_today", "INTEGER NOT NULL DEFAULT 0"),
        ("doc_requests_day", "DATE"),
        ("doc_quota_exhausted_at", ts),
        ("doc_last_upstream_error_at", ts),
        ("doc_last_upstream_error", "TEXT"),
    ]
    for name, col_type in patches:
        if name not in columns:
            statements.append(
                f"ALTER TABLE site_laximo_cat_integration ADD COLUMN {name} {col_type}"
            )

    if not statements:
        return

    with engine.begin() as conn:
        for stmt in statements:
            conn.execute(text(stmt))
    logger.info("Applied Laximo.DOC columns patch")


def ensure_site_analytics_attribution_columns() -> None:
    """Add traffic attribution columns to site_analytics_sessions."""
    inspector = inspect(engine)
    table_names = set(inspector.get_table_names())
    if "site_analytics_sessions" not in table_names:
        return

    columns = {col["name"] for col in inspector.get_columns("site_analytics_sessions")}
    statements = []
    is_pg = engine.dialect.name == "postgresql"

    patches = [
        ("landing_path", "VARCHAR(2048)" if is_pg else "VARCHAR(2048)"),
        ("landing_path_template", "VARCHAR(512)" if is_pg else "VARCHAR(512)"),
        ("traffic_source", "VARCHAR(32)" if is_pg else "VARCHAR(32)"),
        ("referrer_host", "VARCHAR(255)" if is_pg else "VARCHAR(255)"),
        ("utm_source", "VARCHAR(128)" if is_pg else "VARCHAR(128)"),
        ("utm_medium", "VARCHAR(128)" if is_pg else "VARCHAR(128)"),
        ("utm_campaign", "VARCHAR(128)" if is_pg else "VARCHAR(128)"),
    ]
    for name, col_type in patches:
        if name not in columns:
            statements.append(f"ALTER TABLE site_analytics_sessions ADD COLUMN {name} {col_type}")

    if statements:
        with engine.begin() as conn:
            for stmt in statements:
                conn.execute(text(stmt))
        logger.info("Applied site_analytics_sessions attribution patches: %s", statements)

    indexes = [
        ("ix_site_analytics_sessions_landing_path_template", "landing_path_template"),
        ("ix_site_analytics_sessions_traffic_source", "traffic_source"),
    ]
    for index_name, column_name in indexes:
        if column_name in columns or any(column_name in s for s in statements):
            if not _index_exists(inspector, "site_analytics_sessions", index_name):
                with engine.begin() as conn:
                    conn.execute(
                        text(
                            f"CREATE INDEX IF NOT EXISTS {index_name} "
                            f"ON site_analytics_sessions ({column_name})"
                        )
                    )


def ensure_site_analytics_conversion_events_table() -> None:
    """Create site_analytics_conversion_events if missing."""
    inspector = inspect(engine)
    table_names = set(inspector.get_table_names())
    if "site_analytics_conversion_events" in table_names:
        return

    is_pg = engine.dialect.name == "postgresql"
    if is_pg:
        ddl = """
        CREATE TABLE site_analytics_conversion_events (
            id SERIAL PRIMARY KEY,
            session_id INTEGER NOT NULL REFERENCES site_analytics_sessions(id),
            event_type VARCHAR(32) NOT NULL,
            path VARCHAR(2048),
            path_template VARCHAR(512),
            product_id INTEGER,
            metadata_json TEXT,
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
        """
    else:
        ddl = """
        CREATE TABLE site_analytics_conversion_events (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            session_id INTEGER NOT NULL REFERENCES site_analytics_sessions(id),
            event_type VARCHAR(32) NOT NULL,
            path VARCHAR(2048),
            path_template VARCHAR(512),
            product_id INTEGER,
            metadata_json TEXT,
            created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
        )
        """
    with engine.begin() as conn:
        conn.execute(text(ddl))
        for index_name, columns in (
            ("ix_site_analytics_conv_session_id", "session_id"),
            ("ix_site_analytics_conv_event_type", "event_type"),
            ("ix_site_analytics_conv_path_template", "path_template"),
            ("ix_site_analytics_conv_product_id", "product_id"),
            ("ix_site_analytics_conv_created_at", "created_at"),
        ):
            conn.execute(
                text(
                    f"CREATE INDEX IF NOT EXISTS {index_name} "
                    f"ON site_analytics_conversion_events ({columns})"
                )
            )
    logger.info("Applied site_analytics_conversion_events table patch")


def ensure_analytics_query_review_tables() -> None:
    """Create analytics query review snapshot tables."""
    inspector = inspect(engine)
    table_names = set(inspector.get_table_names())
    is_pg = engine.dialect.name == "postgresql"

    if "analytics_query_review_snapshots" not in table_names:
        if is_pg:
            ddl = """
            CREATE TABLE analytics_query_review_snapshots (
                id SERIAL PRIMARY KEY,
                created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                period_start DATE NOT NULL,
                period_end DATE NOT NULL,
                source VARCHAR(32) NOT NULL DEFAULT 'yandex_webmaster',
                status VARCHAR(32) NOT NULL DEFAULT 'ok',
                error_message TEXT
            )
            """
        else:
            ddl = """
            CREATE TABLE analytics_query_review_snapshots (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
                period_start DATE NOT NULL,
                period_end DATE NOT NULL,
                source VARCHAR(32) NOT NULL DEFAULT 'yandex_webmaster',
                status VARCHAR(32) NOT NULL DEFAULT 'ok',
                error_message TEXT
            )
            """
        with engine.begin() as conn:
            conn.execute(text(ddl))
            conn.execute(
                text(
                    "CREATE INDEX IF NOT EXISTS ix_aqr_snapshots_created_at "
                    "ON analytics_query_review_snapshots (created_at)"
                )
            )

    if "analytics_query_review_items" not in table_names:
        if is_pg:
            ddl = """
            CREATE TABLE analytics_query_review_items (
                id SERIAL PRIMARY KEY,
                snapshot_id INTEGER NOT NULL REFERENCES analytics_query_review_snapshots(id) ON DELETE CASCADE,
                query_text VARCHAR(512) NOT NULL,
                cluster VARCHAR(16) NOT NULL DEFAULT 'unknown',
                impressions INTEGER NOT NULL DEFAULT 0,
                clicks INTEGER NOT NULL DEFAULT 0,
                ctr VARCHAR(16) NOT NULL DEFAULT '0',
                position VARCHAR(16) NOT NULL DEFAULT '0',
                matched_path VARCHAR(512),
                recommendation VARCHAR(32) NOT NULL DEFAULT 'review',
                recommendation_label VARCHAR(128) NOT NULL DEFAULT '',
                sort_order INTEGER NOT NULL DEFAULT 0
            )
            """
        else:
            ddl = """
            CREATE TABLE analytics_query_review_items (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                snapshot_id INTEGER NOT NULL REFERENCES analytics_query_review_snapshots(id) ON DELETE CASCADE,
                query_text VARCHAR(512) NOT NULL,
                cluster VARCHAR(16) NOT NULL DEFAULT 'unknown',
                impressions INTEGER NOT NULL DEFAULT 0,
                clicks INTEGER NOT NULL DEFAULT 0,
                ctr VARCHAR(16) NOT NULL DEFAULT '0',
                position VARCHAR(16) NOT NULL DEFAULT '0',
                matched_path VARCHAR(512),
                recommendation VARCHAR(32) NOT NULL DEFAULT 'review',
                recommendation_label VARCHAR(128) NOT NULL DEFAULT '',
                sort_order INTEGER NOT NULL DEFAULT 0
            )
            """
        with engine.begin() as conn:
            conn.execute(text(ddl))
            conn.execute(
                text(
                    "CREATE INDEX IF NOT EXISTS ix_aqr_items_snapshot_id "
                    "ON analytics_query_review_items (snapshot_id)"
                )
            )


def ensure_public_catalog_indexes() -> None:
    """Indexes for public catalog filters (quantity > 0, org, part_type)."""
    inspector = inspect(engine)
    if "products" not in inspector.get_table_names():
        return

    indexes = {idx["name"] for idx in inspector.get_indexes("products")}
    statements = []
    if "ix_products_public_catalog" not in indexes:
        statements.append(
            "CREATE INDEX IF NOT EXISTS ix_products_public_catalog "
            "ON products (quantity, is_new, id DESC) "
            "WHERE quantity > 0"
        )
    if "ix_products_org_qty" not in indexes:
        statements.append(
            "CREATE INDEX IF NOT EXISTS ix_products_org_qty "
            "ON products (organization_id, quantity)"
        )
    if "ix_products_part_type_qty" not in indexes:
        statements.append(
            "CREATE INDEX IF NOT EXISTS ix_products_part_type_qty "
            "ON products (part_type_id, quantity)"
        )

    if not statements:
        return

    with engine.begin() as conn:
        for stmt in statements:
            conn.execute(text(stmt))
    logger.info("Applied public catalog indexes on products")


def ensure_product_drafts_table() -> None:
    """Create product_drafts table for personal add-part drafts."""
    inspector = inspect(engine)
    if "product_drafts" in inspector.get_table_names():
        return

    if engine.dialect.name == "postgresql":
        ddl = """
        CREATE TABLE product_drafts (
            id SERIAL PRIMARY KEY,
            organization_id VARCHAR NOT NULL REFERENCES organizations(id),
            created_by INTEGER NOT NULL REFERENCES users(id),
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            article VARCHAR(30),
            name VARCHAR(255),
            brand VARCHAR(100),
            description TEXT,
            is_new BOOLEAN DEFAULT TRUE,
            price NUMERIC(12, 2),
            quantity INTEGER,
            storage_location_id INTEGER REFERENCES storage_locations(id),
            part_type_id INTEGER REFERENCES part_types(id),
            photos TEXT,
            videos TEXT,
            vehicle_ids TEXT,
            storage_cells_json TEXT
        )
        """
        indexes = [
            "CREATE INDEX IF NOT EXISTS ix_product_drafts_org ON product_drafts (organization_id)",
            "CREATE INDEX IF NOT EXISTS ix_product_drafts_user ON product_drafts (created_by)",
        ]
    else:
        ddl = """
        CREATE TABLE product_drafts (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            organization_id VARCHAR NOT NULL REFERENCES organizations(id),
            created_by INTEGER NOT NULL REFERENCES users(id),
            created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            article VARCHAR(30),
            name VARCHAR(255),
            brand VARCHAR(100),
            description TEXT,
            is_new BOOLEAN DEFAULT 1,
            price NUMERIC(12, 2),
            quantity INTEGER,
            storage_location_id INTEGER REFERENCES storage_locations(id),
            part_type_id INTEGER REFERENCES part_types(id),
            photos TEXT,
            videos TEXT,
            vehicle_ids TEXT,
            storage_cells_json TEXT
        )
        """
        indexes = [
            "CREATE INDEX IF NOT EXISTS ix_product_drafts_org ON product_drafts (organization_id)",
            "CREATE INDEX IF NOT EXISTS ix_product_drafts_user ON product_drafts (created_by)",
        ]

    with engine.begin() as conn:
        conn.execute(text(ddl))
        for stmt in indexes:
            conn.execute(text(stmt))

    logger.info("Applied product_drafts table patch")


def ensure_order_return_tables() -> None:
    """Create order return request tables."""
    inspector = inspect(engine)
    if "order_return_requests" in inspector.get_table_names():
        return

    if engine.dialect.name == "postgresql":
        ddl_requests = """
        CREATE TABLE order_return_requests (
            id SERIAL PRIMARY KEY,
            organization_id VARCHAR(10) NOT NULL REFERENCES organizations(id),
            order_id INTEGER NOT NULL REFERENCES garage_used_orders(id),
            buyer_user_id INTEGER REFERENCES users(id),
            reason VARCHAR(50) NOT NULL,
            comment TEXT,
            status_code VARCHAR(50) NOT NULL DEFAULT 'requested',
            seller_note TEXT,
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            status_changed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
        """
        ddl_attachments = """
        CREATE TABLE order_return_attachments (
            id SERIAL PRIMARY KEY,
            return_request_id INTEGER NOT NULL REFERENCES order_return_requests(id) ON DELETE CASCADE,
            file_url VARCHAR(512) NOT NULL,
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
        """
        indexes = [
            "CREATE INDEX IF NOT EXISTS ix_order_return_requests_org ON order_return_requests (organization_id)",
            "CREATE INDEX IF NOT EXISTS ix_order_return_requests_order ON order_return_requests (order_id)",
            "CREATE INDEX IF NOT EXISTS ix_order_return_requests_status ON order_return_requests (status_code)",
            "CREATE INDEX IF NOT EXISTS ix_order_return_attachments_return ON order_return_attachments (return_request_id)",
            "CREATE UNIQUE INDEX IF NOT EXISTS uq_order_return_active ON order_return_requests (order_id) WHERE status_code NOT IN ('rejected', 'closed')",
        ]
    else:
        ddl_requests = """
        CREATE TABLE order_return_requests (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            organization_id VARCHAR(10) NOT NULL REFERENCES organizations(id),
            order_id INTEGER NOT NULL REFERENCES garage_used_orders(id),
            buyer_user_id INTEGER REFERENCES users(id),
            reason VARCHAR(50) NOT NULL,
            comment TEXT,
            status_code VARCHAR(50) NOT NULL DEFAULT 'requested',
            seller_note TEXT,
            created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            status_changed_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
        )
        """
        ddl_attachments = """
        CREATE TABLE order_return_attachments (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            return_request_id INTEGER NOT NULL REFERENCES order_return_requests(id) ON DELETE CASCADE,
            file_url VARCHAR(512) NOT NULL,
            created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
        )
        """
        indexes = [
            "CREATE INDEX IF NOT EXISTS ix_order_return_requests_org ON order_return_requests (organization_id)",
            "CREATE INDEX IF NOT EXISTS ix_order_return_requests_order ON order_return_requests (order_id)",
            "CREATE INDEX IF NOT EXISTS ix_order_return_requests_status ON order_return_requests (status_code)",
            "CREATE INDEX IF NOT EXISTS ix_order_return_attachments_return ON order_return_attachments (return_request_id)",
        ]

    with engine.begin() as conn:
        conn.execute(text(ddl_requests))
        conn.execute(text(ddl_attachments))
        for stmt in indexes:
            conn.execute(text(stmt))

    logger.info("Applied order_return tables patch")


def ensure_inventory_tables() -> None:
    """Create inventory session tables for WMS stock-taking."""
    inspector = inspect(engine)
    if "inventory_sessions" in inspector.get_table_names():
        return

    if engine.dialect.name == "postgresql":
        ddl_sessions = """
        CREATE TABLE inventory_sessions (
            id SERIAL PRIMARY KEY,
            organization_id VARCHAR(10) NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
            storage_location_id INTEGER NOT NULL REFERENCES storage_locations(id) ON DELETE CASCADE,
            status VARCHAR(32) NOT NULL DEFAULT 'draft',
            scope_type VARCHAR(32) NOT NULL DEFAULT 'location_all',
            scope_cell_ids_json TEXT,
            scope_product_ids_json TEXT,
            title VARCHAR(255),
            notes TEXT,
            created_by INTEGER NOT NULL REFERENCES users(id),
            completed_by INTEGER REFERENCES users(id),
            started_at TIMESTAMP,
            completed_at TIMESTAMP,
            created_at TIMESTAMP NOT NULL DEFAULT NOW(),
            updated_at TIMESTAMP NOT NULL DEFAULT NOW()
        )
        """
        ddl_count_lines = """
        CREATE TABLE inventory_count_lines (
            id SERIAL PRIMARY KEY,
            session_id INTEGER NOT NULL REFERENCES inventory_sessions(id) ON DELETE CASCADE,
            product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
            storage_location_id INTEGER NOT NULL REFERENCES storage_locations(id),
            storage_cell_id INTEGER REFERENCES storage_cells(id),
            expected_qty INTEGER NOT NULL DEFAULT 0,
            counted_qty INTEGER,
            line_status VARCHAR(32) NOT NULL DEFAULT 'pending',
            created_at TIMESTAMP NOT NULL DEFAULT NOW(),
            updated_at TIMESTAMP NOT NULL DEFAULT NOW()
        )
        """
        ddl_adjustment_lines = """
        CREATE TABLE inventory_adjustment_lines (
            id SERIAL PRIMARY KEY,
            session_id INTEGER NOT NULL REFERENCES inventory_sessions(id) ON DELETE CASCADE,
            product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
            storage_location_id INTEGER NOT NULL REFERENCES storage_locations(id),
            expected_qty INTEGER NOT NULL DEFAULT 0,
            counted_qty INTEGER NOT NULL DEFAULT 0,
            delta_qty INTEGER NOT NULL DEFAULT 0,
            adjustment_kind VARCHAR(32) NOT NULL,
            stock_in_id INTEGER REFERENCES stock_in(id),
            stock_out_id INTEGER REFERENCES stock_out(id),
            applied_at TIMESTAMP,
            created_at TIMESTAMP NOT NULL DEFAULT NOW()
        )
        """
    else:
        ddl_sessions = """
        CREATE TABLE inventory_sessions (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            organization_id VARCHAR(10) NOT NULL REFERENCES organizations(id),
            storage_location_id INTEGER NOT NULL REFERENCES storage_locations(id),
            status VARCHAR(32) NOT NULL DEFAULT 'draft',
            scope_type VARCHAR(32) NOT NULL DEFAULT 'location_all',
            scope_cell_ids_json TEXT,
            scope_product_ids_json TEXT,
            title VARCHAR(255),
            notes TEXT,
            created_by INTEGER NOT NULL REFERENCES users(id),
            completed_by INTEGER REFERENCES users(id),
            started_at DATETIME,
            completed_at DATETIME,
            created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
        )
        """
        ddl_count_lines = """
        CREATE TABLE inventory_count_lines (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            session_id INTEGER NOT NULL REFERENCES inventory_sessions(id),
            product_id INTEGER NOT NULL REFERENCES products(id),
            storage_location_id INTEGER NOT NULL REFERENCES storage_locations(id),
            storage_cell_id INTEGER REFERENCES storage_cells(id),
            expected_qty INTEGER NOT NULL DEFAULT 0,
            counted_qty INTEGER,
            line_status VARCHAR(32) NOT NULL DEFAULT 'pending',
            created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
        )
        """
        ddl_adjustment_lines = """
        CREATE TABLE inventory_adjustment_lines (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            session_id INTEGER NOT NULL REFERENCES inventory_sessions(id),
            product_id INTEGER NOT NULL REFERENCES products(id),
            storage_location_id INTEGER NOT NULL REFERENCES storage_locations(id),
            expected_qty INTEGER NOT NULL DEFAULT 0,
            counted_qty INTEGER NOT NULL DEFAULT 0,
            delta_qty INTEGER NOT NULL DEFAULT 0,
            adjustment_kind VARCHAR(32) NOT NULL,
            stock_in_id INTEGER REFERENCES stock_in(id),
            stock_out_id INTEGER REFERENCES stock_out(id),
            applied_at DATETIME,
            created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
        )
        """

    indexes = [
        "CREATE INDEX IF NOT EXISTS ix_inventory_sessions_org ON inventory_sessions (organization_id)",
        "CREATE INDEX IF NOT EXISTS ix_inventory_sessions_storage ON inventory_sessions (storage_location_id)",
        "CREATE INDEX IF NOT EXISTS ix_inventory_count_lines_session ON inventory_count_lines (session_id)",
        "CREATE INDEX IF NOT EXISTS ix_inventory_count_lines_product ON inventory_count_lines (product_id)",
        "CREATE INDEX IF NOT EXISTS ix_inventory_adjustment_lines_session ON inventory_adjustment_lines (session_id)",
    ]

    with engine.begin() as conn:
        conn.execute(text(ddl_sessions))
        conn.execute(text(ddl_count_lines))
        conn.execute(text(ddl_adjustment_lines))
        for stmt in indexes:
            conn.execute(text(stmt))

    logger.info("Applied inventory tables patch")


def ensure_user_engagement_tables() -> None:
    """Create favorites, view history, and search subscription tables."""
    inspector = inspect(engine)
    if "user_favorites" in inspector.get_table_names():
        return

    if engine.dialect.name == "postgresql":
        ddl_favorites = """
        CREATE TABLE user_favorites (
            id SERIAL PRIMARY KEY,
            user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
        """
        ddl_views = """
        CREATE TABLE user_product_views (
            id SERIAL PRIMARY KEY,
            user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
            viewed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
        """
        ddl_subscriptions = """
        CREATE TABLE search_subscriptions (
            id SERIAL PRIMARY KEY,
            user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            query_text TEXT NOT NULL,
            query_normalized VARCHAR(512) NOT NULL,
            is_active BOOLEAN NOT NULL DEFAULT TRUE,
            unsubscribe_token VARCHAR(64) NOT NULL UNIQUE,
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            last_notified_at TIMESTAMPTZ
        )
        """
        ddl_notifications = """
        CREATE TABLE search_subscription_notifications (
            id SERIAL PRIMARY KEY,
            subscription_id INTEGER NOT NULL REFERENCES search_subscriptions(id) ON DELETE CASCADE,
            product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
            notified_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
        """
    else:
        ddl_favorites = """
        CREATE TABLE user_favorites (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
            created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
        )
        """
        ddl_views = """
        CREATE TABLE user_product_views (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
            viewed_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
        )
        """
        ddl_subscriptions = """
        CREATE TABLE search_subscriptions (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            query_text TEXT NOT NULL,
            query_normalized VARCHAR(512) NOT NULL,
            is_active BOOLEAN NOT NULL DEFAULT 1,
            unsubscribe_token VARCHAR(64) NOT NULL UNIQUE,
            created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            last_notified_at DATETIME
        )
        """
        ddl_notifications = """
        CREATE TABLE search_subscription_notifications (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            subscription_id INTEGER NOT NULL REFERENCES search_subscriptions(id) ON DELETE CASCADE,
            product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
            notified_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
        )
        """

    indexes = [
        "CREATE INDEX IF NOT EXISTS ix_user_favorites_user ON user_favorites (user_id)",
        "CREATE INDEX IF NOT EXISTS ix_user_favorites_product ON user_favorites (product_id)",
        "CREATE UNIQUE INDEX IF NOT EXISTS uq_user_favorites_user_product ON user_favorites (user_id, product_id)",
        "CREATE INDEX IF NOT EXISTS ix_user_product_views_user ON user_product_views (user_id)",
        "CREATE INDEX IF NOT EXISTS ix_user_product_views_viewed ON user_product_views (user_id, viewed_at DESC)",
        "CREATE UNIQUE INDEX IF NOT EXISTS uq_user_product_views_user_product ON user_product_views (user_id, product_id)",
        "CREATE INDEX IF NOT EXISTS ix_search_subscriptions_user ON search_subscriptions (user_id)",
        "CREATE UNIQUE INDEX IF NOT EXISTS uq_search_subscriptions_user_query ON search_subscriptions (user_id, query_normalized)",
        "CREATE INDEX IF NOT EXISTS ix_search_subscriptions_token ON search_subscriptions (unsubscribe_token)",
        "CREATE INDEX IF NOT EXISTS ix_search_subscription_notifications_sub ON search_subscription_notifications (subscription_id)",
        "CREATE UNIQUE INDEX IF NOT EXISTS uq_search_subscription_notifications_sub_product ON search_subscription_notifications (subscription_id, product_id)",
    ]

    with engine.begin() as conn:
        conn.execute(text(ddl_favorites))
        conn.execute(text(ddl_views))
        conn.execute(text(ddl_subscriptions))
        conn.execute(text(ddl_notifications))
        for stmt in indexes:
            conn.execute(text(stmt))

    logger.info("Applied user_engagement tables patch")


def ensure_user_rossko_favorites_table() -> None:
    """Create Rossko favorites table for new-parts catalog items."""
    inspector = inspect(engine)
    if "user_rossko_favorites" in inspector.get_table_names():
        return

    if engine.dialect.name == "postgresql":
        ddl = """
        CREATE TABLE user_rossko_favorites (
            id SERIAL PRIMARY KEY,
            user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            rossko_guid VARCHAR(64),
            brand VARCHAR(100) NOT NULL,
            partnumber VARCHAR(64) NOT NULL,
            brand_normalized VARCHAR(100) NOT NULL,
            partnumber_normalized VARCHAR(64) NOT NULL,
            title TEXT,
            snapshot_json TEXT,
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
        """
    else:
        ddl = """
        CREATE TABLE user_rossko_favorites (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            rossko_guid VARCHAR(64),
            brand VARCHAR(100) NOT NULL,
            partnumber VARCHAR(64) NOT NULL,
            brand_normalized VARCHAR(100) NOT NULL,
            partnumber_normalized VARCHAR(64) NOT NULL,
            title TEXT,
            snapshot_json TEXT,
            created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
        )
        """

    indexes = [
        "CREATE INDEX IF NOT EXISTS ix_user_rossko_favorites_user ON user_rossko_favorites (user_id)",
        "CREATE UNIQUE INDEX IF NOT EXISTS uq_user_rossko_favorites_user_part ON user_rossko_favorites (user_id, brand_normalized, partnumber_normalized)",
    ]

    with engine.begin() as conn:
        conn.execute(text(ddl))
        for stmt in indexes:
            conn.execute(text(stmt))

    logger.info("Applied user_rossko_favorites table patch")


def ensure_garage_order_pickup_columns() -> None:
    """Pickup verification columns for used/new garage orders."""
    inspector = inspect(engine)
    table_names = set(inspector.get_table_names())
    ts_type = "TIMESTAMPTZ" if engine.dialect.name == "postgresql" else "DATETIME"
    int_default = "INTEGER NOT NULL DEFAULT 0"

    columns_to_add = [
        ("pickup_code_hash", "VARCHAR(64)"),
        ("pickup_code_cipher", "TEXT"),
        ("pickup_code_created_at", ts_type),
        ("pickup_code_expires_at", ts_type),
        ("pickup_verified_at", ts_type),
        ("pickup_verify_attempts", int_default),
    ]

    for table in ("garage_used_orders", "garage_new_orders"):
        if table not in table_names:
            continue
        existing = {col["name"] for col in inspector.get_columns(table)}
        statements: list[str] = []
        for name, col_type in columns_to_add:
            if name in existing:
                continue
            statements.append(f"ALTER TABLE {table} ADD COLUMN {name} {col_type}")
        if not statements:
            continue
        with engine.begin() as conn:
            for stmt in statements:
                conn.execute(text(stmt))
        logger.info("Applied %s pickup columns patch", table)


def ensure_product_source_pending_id_column() -> None:
    """Link approved product back to pending id for legacy label QR redirects."""
    inspector = inspect(engine)
    if "products" not in inspector.get_table_names():
        return
    columns = {col["name"] for col in inspector.get_columns("products")}
    if "source_pending_id" in columns:
        return
    with engine.begin() as conn:
        conn.execute(text("ALTER TABLE products ADD COLUMN source_pending_id INTEGER"))
        conn.execute(text("CREATE INDEX IF NOT EXISTS ix_products_source_pending_id ON products (source_pending_id)"))
    logger.info("Applied products.source_pending_id column patch")


def ensure_label_qr_links_table() -> None:
    """Durable pending↔product↔internal_code map for warehouse label QR."""
    inspector = inspect(engine)
    if "label_qr_links" in inspector.get_table_names():
        return
    with engine.begin() as conn:
        conn.execute(
            text(
                """
                CREATE TABLE label_qr_links (
                    id SERIAL PRIMARY KEY,
                    organization_id VARCHAR(10) NOT NULL,
                    internal_code VARCHAR(64) NOT NULL,
                    pending_product_id INTEGER,
                    product_id INTEGER,
                    rejected_product_id INTEGER,
                    created_at TIMESTAMPTZ DEFAULT NOW(),
                    updated_at TIMESTAMPTZ DEFAULT NOW()
                )
                """
            )
        )
        conn.execute(
            text(
                "CREATE UNIQUE INDEX IF NOT EXISTS uq_label_qr_links_pending_product_id "
                "ON label_qr_links (pending_product_id) WHERE pending_product_id IS NOT NULL"
            )
        )
        conn.execute(text("CREATE INDEX IF NOT EXISTS ix_label_qr_links_internal_code ON label_qr_links (internal_code)"))
        conn.execute(text("CREATE INDEX IF NOT EXISTS ix_label_qr_links_product_id ON label_qr_links (product_id)"))
        conn.execute(
            text("CREATE INDEX IF NOT EXISTS ix_label_qr_links_organization_id ON label_qr_links (organization_id)")
        )
    logger.info("Applied label_qr_links table patch")


def ensure_label_qr_links_backfill() -> None:
    """One-shot / idempotent recovery of label QR links for already printed stickers."""
    from app.db.database import SessionLocal
    from app.services.label_qr_link_service import backfill_label_qr_links

    db = SessionLocal()
    try:
        stats = backfill_label_qr_links(db)
        logger.info("label_qr_links backfill finished: %s", stats)
    except Exception:
        logger.exception("label_qr_links backfill failed")
        db.rollback()
    finally:
        db.close()


DEFAULT_PAYMENT_METHODS = (
    ("cash", "Наличные", "Оплата наличными при получении"),
    ("qr", "QR-код", "Оплата по QR-коду"),
    ("card", "Картой", "Оплата банковской картой"),
)


def ensure_payment_methods_tables() -> None:
    """Payment methods catalog + org M2M + order/stock_out payment columns."""
    inspector = inspect(engine)
    tables = set(inspector.get_table_names())
    dialect = engine.dialect.name
    is_pg = dialect == "postgresql"

    with engine.begin() as conn:
        if "payment_methods" not in tables:
            if is_pg:
                conn.execute(
                    text(
                        """
                        CREATE TABLE payment_methods (
                            id SERIAL PRIMARY KEY,
                            code VARCHAR(50) NOT NULL UNIQUE,
                            name VARCHAR(255) NOT NULL,
                            description TEXT
                        )
                        """
                    )
                )
            else:
                conn.execute(
                    text(
                        """
                        CREATE TABLE payment_methods (
                            id INTEGER PRIMARY KEY AUTOINCREMENT,
                            code VARCHAR(50) NOT NULL UNIQUE,
                            name VARCHAR(255) NOT NULL,
                            description TEXT
                        )
                        """
                    )
                )
            conn.execute(text("CREATE INDEX IF NOT EXISTS ix_payment_methods_code ON payment_methods (code)"))
            logger.info("Created payment_methods table")

        if "organization_payment_methods" not in tables:
            if is_pg:
                conn.execute(
                    text(
                        """
                        CREATE TABLE organization_payment_methods (
                            id SERIAL PRIMARY KEY,
                            payment_method_id INTEGER REFERENCES payment_methods(id),
                            organization_id VARCHAR(10) REFERENCES organizations(id)
                        )
                        """
                    )
                )
            else:
                conn.execute(
                    text(
                        """
                        CREATE TABLE organization_payment_methods (
                            id INTEGER PRIMARY KEY AUTOINCREMENT,
                            payment_method_id INTEGER REFERENCES payment_methods(id),
                            organization_id VARCHAR(10) REFERENCES organizations(id)
                        )
                        """
                    )
                )
            logger.info("Created organization_payment_methods table")

        for code, name, description in DEFAULT_PAYMENT_METHODS:
            existing = conn.execute(
                text("SELECT id FROM payment_methods WHERE code = :code"),
                {"code": code},
            ).fetchone()
            if existing:
                continue
            conn.execute(
                text(
                    "INSERT INTO payment_methods (code, name, description) "
                    "VALUES (:code, :name, :description)"
                ),
                {"code": code, "name": name, "description": description},
            )
        logger.info("Ensured default payment methods seed")

    inspector = inspect(engine)
    if "garage_used_orders" in inspector.get_table_names():
        cols = {col["name"] for col in inspector.get_columns("garage_used_orders")}
        statements: list[str] = []
        if "payment_method_id" not in cols:
            statements.append("ALTER TABLE garage_used_orders ADD COLUMN payment_method_id INTEGER")
        if "payment_method_name" not in cols:
            statements.append("ALTER TABLE garage_used_orders ADD COLUMN payment_method_name VARCHAR(255)")
        if "paid_at" not in cols:
            if is_pg:
                statements.append("ALTER TABLE garage_used_orders ADD COLUMN paid_at TIMESTAMPTZ")
            else:
                statements.append("ALTER TABLE garage_used_orders ADD COLUMN paid_at DATETIME")
        if statements:
            with engine.begin() as conn:
                for stmt in statements:
                    conn.execute(text(stmt))
            logger.info("Applied garage_used_orders payment columns patch")

    if "stock_out" in inspector.get_table_names():
        cols = {col["name"] for col in inspector.get_columns("stock_out")}
        if "payment_method" not in cols:
            with engine.begin() as conn:
                conn.execute(text("ALTER TABLE stock_out ADD COLUMN payment_method VARCHAR(255)"))
            logger.info("Applied stock_out.payment_method column patch")


def ensure_organization_drom_api_columns() -> None:
    """Add Drom price-list API credentials and sync status columns."""
    inspector = inspect(engine)
    if "organization_drom_integration" not in inspector.get_table_names():
        return

    columns = {col["name"] for col in inspector.get_columns("organization_drom_integration")}
    is_pg = engine.dialect.name == "postgresql"
    statements: list[str] = []

    def _add(col: str, ddl_type: str) -> None:
        if col in columns:
            return
        if is_pg:
            statements.append(
                f"ALTER TABLE organization_drom_integration ADD COLUMN IF NOT EXISTS {col} {ddl_type}"
            )
        else:
            statements.append(f"ALTER TABLE organization_drom_integration ADD COLUMN {col} {ddl_type}")

    _add("packet_id", "VARCHAR(64)")
    _add("api_key_encrypted", "TEXT")
    if is_pg:
        _add("auto_sync_enabled", "BOOLEAN NOT NULL DEFAULT TRUE")
        _add("last_sync_at", "TIMESTAMPTZ")
    else:
        _add("auto_sync_enabled", "BOOLEAN NOT NULL DEFAULT 1")
        _add("last_sync_at", "DATETIME")
    _add("last_sync_status", "INTEGER")
    _add("last_sync_error", "VARCHAR(1000)")

    if not statements:
        return

    with engine.begin() as conn:
        for stmt in statements:
            try:
                conn.execute(text(stmt))
            except Exception as exc:
                # Parallel gunicorn workers may race on first boot.
                msg = str(exc).lower()
                if "already exists" in msg or "duplicate column" in msg:
                    logger.info("Drom column patch already applied concurrently: %s", stmt)
                    continue
                raise
    logger.info("Applied organization_drom_integration API column patches: %s", statements)


def ensure_seo_new_parts_sync_settings_table() -> None:
    """Create seo_new_parts_sync_settings singleton (id=1) for runtime SEO rate controls."""
    inspector = inspect(engine)
    if "seo_new_parts_sync_settings" in inspector.get_table_names():
        _seed_seo_sync_settings_row()
        return

    if engine.dialect.name == "postgresql":
        ddl = """
        CREATE TABLE seo_new_parts_sync_settings (
            id INTEGER PRIMARY KEY,
            daily_limit INTEGER,
            batch_interval_minutes INTEGER,
            batch_size INTEGER,
            rossko_delay_sec DOUBLE PRECISION,
            seed_precheck_daily INTEGER,
            seed_precheck_interval_minutes INTEGER,
            updated_at TIMESTAMPTZ DEFAULT NOW(),
            updated_by_user_id INTEGER REFERENCES users(id)
        )
        """
    else:
        ddl = """
        CREATE TABLE seo_new_parts_sync_settings (
            id INTEGER PRIMARY KEY,
            daily_limit INTEGER,
            batch_interval_minutes INTEGER,
            batch_size INTEGER,
            rossko_delay_sec REAL,
            seed_precheck_daily INTEGER,
            seed_precheck_interval_minutes INTEGER,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_by_user_id INTEGER REFERENCES users(id)
        )
        """
    with engine.begin() as conn:
        conn.execute(text(ddl))
    logger.info("Created seo_new_parts_sync_settings table")
    _seed_seo_sync_settings_row()


def _seed_seo_sync_settings_row() -> None:
    with engine.begin() as conn:
        conn.execute(
            text(
                """
                INSERT INTO seo_new_parts_sync_settings (id)
                SELECT 1
                WHERE NOT EXISTS (SELECT 1 FROM seo_new_parts_sync_settings WHERE id = 1)
                """
            )
        )


def ensure_site_payments_table() -> None:
    """Create site_payments table for admin site service billing."""
    inspector = inspect(engine)
    if "site_payments" in inspector.get_table_names():
        return

    if engine.dialect.name == "postgresql":
        ddl = """
        CREATE TABLE site_payments (
            id SERIAL PRIMARY KEY,
            title VARCHAR(255) NOT NULL,
            start_date DATE NOT NULL,
            end_date DATE NOT NULL,
            duration_days INTEGER NOT NULL,
            monthly_amount NUMERIC(12, 2) NOT NULL,
            total_amount NUMERIC(12, 2) NOT NULL,
            amount_paid NUMERIC(12, 2) NOT NULL DEFAULT 0,
            comment TEXT,
            status VARCHAR(32) NOT NULL DEFAULT 'active',
            created_by_id INTEGER REFERENCES users(id),
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
        """
    else:
        ddl = """
        CREATE TABLE site_payments (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            title VARCHAR(255) NOT NULL,
            start_date DATE NOT NULL,
            end_date DATE NOT NULL,
            duration_days INTEGER NOT NULL,
            monthly_amount NUMERIC(12, 2) NOT NULL,
            total_amount NUMERIC(12, 2) NOT NULL,
            amount_paid NUMERIC(12, 2) NOT NULL DEFAULT 0,
            comment TEXT,
            status VARCHAR(32) NOT NULL DEFAULT 'active',
            created_by_id INTEGER REFERENCES users(id),
            created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
        )
        """

    with engine.begin() as conn:
        conn.execute(text(ddl))

    logger.info("Applied site_payments table patch")


def ensure_site_payment_ledger_table() -> None:
    """Create site_payment_ledger for partial payment history."""
    inspector = inspect(engine)
    if "site_payment_ledger" in inspector.get_table_names():
        return
    if "site_payments" not in inspector.get_table_names():
        return

    if engine.dialect.name == "postgresql":
        ddl = """
        CREATE TABLE site_payment_ledger (
            id SERIAL PRIMARY KEY,
            payment_id INTEGER NOT NULL REFERENCES site_payments(id) ON DELETE CASCADE,
            amount NUMERIC(12, 2) NOT NULL,
            note TEXT,
            created_by_id INTEGER REFERENCES users(id),
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
        """
    else:
        ddl = """
        CREATE TABLE site_payment_ledger (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            payment_id INTEGER NOT NULL REFERENCES site_payments(id) ON DELETE CASCADE,
            amount NUMERIC(12, 2) NOT NULL,
            note TEXT,
            created_by_id INTEGER REFERENCES users(id),
            created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
        )
        """

    with engine.begin() as conn:
        conn.execute(text(ddl))

    logger.info("Applied site_payment_ledger table patch")


def ensure_inspection_bookings_table() -> None:
    """Create inspection_bookings for autoservice tech-inspection requests."""
    inspector = inspect(engine)
    if "inspection_bookings" in inspector.get_table_names():
        return

    if engine.dialect.name == "postgresql":
        ddl = """
        CREATE TABLE inspection_bookings (
            id SERIAL PRIMARY KEY,
            organization_id VARCHAR(10) NOT NULL REFERENCES organizations(id),
            name VARCHAR(120) NOT NULL,
            phone VARCHAR(32) NOT NULL,
            preferred_date DATE NOT NULL,
            status VARCHAR(32) NOT NULL DEFAULT 'new',
            source VARCHAR(32) NOT NULL,
            created_by_user_id INTEGER REFERENCES users(id),
            notes TEXT,
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
        """
    else:
        ddl = """
        CREATE TABLE inspection_bookings (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            organization_id VARCHAR(10) NOT NULL REFERENCES organizations(id),
            name VARCHAR(120) NOT NULL,
            phone VARCHAR(32) NOT NULL,
            preferred_date DATE NOT NULL,
            status VARCHAR(32) NOT NULL DEFAULT 'new',
            source VARCHAR(32) NOT NULL,
            created_by_user_id INTEGER REFERENCES users(id),
            notes TEXT,
            created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
        )
        """

    with engine.begin() as conn:
        conn.execute(text(ddl))

    logger.info("Applied inspection_bookings table patch")


def ensure_autoservice_clients_table() -> None:
    """Create autoservice_clients for service consent / guest clients."""
    inspector = inspect(engine)
    if "autoservice_clients" in inspector.get_table_names():
        return

    if engine.dialect.name == "postgresql":
        ddl = """
        CREATE TABLE autoservice_clients (
            id SERIAL PRIMARY KEY,
            organization_id VARCHAR(10) NOT NULL REFERENCES organizations(id),
            user_id INTEGER REFERENCES users(id),
            name VARCHAR(120) NOT NULL,
            phone VARCHAR(32) NOT NULL,
            status VARCHAR(32) NOT NULL DEFAULT 'active',
            source VARCHAR(32) NOT NULL,
            consented_at TIMESTAMPTZ NOT NULL,
            created_by_user_id INTEGER REFERENCES users(id),
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            CONSTRAINT uq_autoservice_clients_org_phone UNIQUE (organization_id, phone)
        )
        """
        index_ddl = """
        CREATE UNIQUE INDEX uq_autoservice_clients_org_user
        ON autoservice_clients (organization_id, user_id)
        WHERE user_id IS NOT NULL
        """
    else:
        ddl = """
        CREATE TABLE autoservice_clients (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            organization_id VARCHAR(10) NOT NULL REFERENCES organizations(id),
            user_id INTEGER REFERENCES users(id),
            name VARCHAR(120) NOT NULL,
            phone VARCHAR(32) NOT NULL,
            status VARCHAR(32) NOT NULL DEFAULT 'active',
            source VARCHAR(32) NOT NULL,
            consented_at DATETIME NOT NULL,
            created_by_user_id INTEGER REFERENCES users(id),
            created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            CONSTRAINT uq_autoservice_clients_org_phone UNIQUE (organization_id, phone)
        )
        """
        index_ddl = None

    with engine.begin() as conn:
        conn.execute(text(ddl))
        if index_ddl:
            conn.execute(text(index_ddl))

    logger.info("Applied autoservice_clients table patch")


def ensure_garage_vehicles_table() -> None:
    """Create garage_vehicles for autoservice client cars."""
    inspector = inspect(engine)
    if "garage_vehicles" in inspector.get_table_names():
        return
    if "autoservice_clients" not in inspector.get_table_names():
        return

    if engine.dialect.name == "postgresql":
        ddl = """
        CREATE TABLE garage_vehicles (
            id SERIAL PRIMARY KEY,
            client_id INTEGER NOT NULL REFERENCES autoservice_clients(id) ON DELETE CASCADE,
            organization_id VARCHAR(10) NOT NULL REFERENCES organizations(id),
            vin VARCHAR(17),
            make VARCHAR(80) NOT NULL,
            model VARCHAR(80) NOT NULL,
            year INTEGER,
            color VARCHAR(40),
            plate VARCHAR(20),
            notes TEXT,
            source VARCHAR(32) NOT NULL DEFAULT 'manual',
            laximo_catalog VARCHAR(64),
            laximo_vehicle_id VARCHAR(64),
            laximo_attributes JSONB,
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            CONSTRAINT uq_garage_vehicles_client_vin UNIQUE (client_id, vin)
        )
        """
        index_ddl = """
        CREATE UNIQUE INDEX uq_garage_vehicles_client_vin_not_null
        ON garage_vehicles (client_id, vin)
        WHERE vin IS NOT NULL
        """
    else:
        ddl = """
        CREATE TABLE garage_vehicles (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            client_id INTEGER NOT NULL REFERENCES autoservice_clients(id) ON DELETE CASCADE,
            organization_id VARCHAR(10) NOT NULL REFERENCES organizations(id),
            vin VARCHAR(17),
            make VARCHAR(80) NOT NULL,
            model VARCHAR(80) NOT NULL,
            year INTEGER,
            color VARCHAR(40),
            plate VARCHAR(20),
            notes TEXT,
            source VARCHAR(32) NOT NULL DEFAULT 'manual',
            laximo_catalog VARCHAR(64),
            laximo_vehicle_id VARCHAR(64),
            laximo_attributes JSON,
            created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            CONSTRAINT uq_garage_vehicles_client_vin UNIQUE (client_id, vin)
        )
        """
        index_ddl = None

    with engine.begin() as conn:
        conn.execute(text(ddl))
        if index_ddl:
            try:
                conn.execute(text(index_ddl))
            except Exception:
                pass

    logger.info("Applied garage_vehicles table patch")


def ensure_garage_vehicle_laximo_columns() -> None:
    """Add Laximo catalog/vehicle_id/attributes snapshot columns to garage_vehicles."""
    inspector = inspect(engine)
    if "garage_vehicles" not in inspector.get_table_names():
        return

    columns = {col["name"] for col in inspector.get_columns("garage_vehicles")}
    statements = []
    is_pg = engine.dialect.name == "postgresql"

    if "laximo_catalog" not in columns:
        statements.append(
            "ALTER TABLE garage_vehicles ADD COLUMN laximo_catalog VARCHAR(64)"
        )
    if "laximo_vehicle_id" not in columns:
        statements.append(
            "ALTER TABLE garage_vehicles ADD COLUMN laximo_vehicle_id VARCHAR(64)"
        )
    if "laximo_attributes" not in columns:
        col_type = "JSONB" if is_pg else "JSON"
        statements.append(
            f"ALTER TABLE garage_vehicles ADD COLUMN laximo_attributes {col_type}"
        )

    if not statements:
        return

    with engine.begin() as conn:
        for stmt in statements:
            conn.execute(text(stmt))

    logger.info(
        "Applied garage_vehicles laximo column patches: %s",
        statements,
    )


def ensure_autoservice_settings_table() -> None:
    """Create autoservice_settings (one row per org, lifts_count)."""
    inspector = inspect(engine)
    if "autoservice_settings" in inspector.get_table_names():
        return
    if "organizations" not in inspector.get_table_names():
        return

    if engine.dialect.name == "postgresql":
        ddl = """
        CREATE TABLE autoservice_settings (
            id SERIAL PRIMARY KEY,
            organization_id VARCHAR(10) NOT NULL UNIQUE REFERENCES organizations(id),
            lifts_count INTEGER NOT NULL DEFAULT 0,
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
        """
    else:
        ddl = """
        CREATE TABLE autoservice_settings (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            organization_id VARCHAR(10) NOT NULL UNIQUE REFERENCES organizations(id),
            lifts_count INTEGER NOT NULL DEFAULT 0,
            created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
        )
        """

    with engine.begin() as conn:
        conn.execute(text(ddl))

    logger.info("Applied autoservice_settings table patch")


def ensure_autoservice_settings_public_columns() -> None:
    """Add public_name/public_description to autoservice_settings for the welcome page."""
    inspector = inspect(engine)
    if "autoservice_settings" not in inspector.get_table_names():
        return

    columns = {col["name"] for col in inspector.get_columns("autoservice_settings")}
    statements = []
    if "public_name" not in columns:
        statements.append(
            "ALTER TABLE autoservice_settings ADD COLUMN public_name VARCHAR(160)"
        )
    if "public_description" not in columns:
        statements.append(
            "ALTER TABLE autoservice_settings ADD COLUMN public_description TEXT"
        )

    if not statements:
        return

    with engine.begin() as conn:
        for stmt in statements:
            conn.execute(text(stmt))

    logger.info("Applied autoservice_settings public column patches: %s", statements)


def ensure_repair_bookings_table() -> None:
    """Create repair_bookings for client repair slot requests."""
    inspector = inspect(engine)
    tables = set(inspector.get_table_names())
    if "repair_bookings" in tables:
        return
    if "autoservice_clients" not in tables:
        return

    if engine.dialect.name == "postgresql":
        ddl = """
        CREATE TABLE repair_bookings (
            id SERIAL PRIMARY KEY,
            organization_id VARCHAR(10) NOT NULL REFERENCES organizations(id),
            client_id INTEGER REFERENCES autoservice_clients(id),
            name VARCHAR(120) NOT NULL,
            phone VARCHAR(32) NOT NULL,
            preferred_date DATE NOT NULL,
            comment TEXT,
            status VARCHAR(32) NOT NULL DEFAULT 'new',
            source VARCHAR(32) NOT NULL DEFAULT 'client',
            created_by_user_id INTEGER REFERENCES users(id),
            staff_notes TEXT,
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
        """
    else:
        ddl = """
        CREATE TABLE repair_bookings (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            organization_id VARCHAR(10) NOT NULL REFERENCES organizations(id),
            client_id INTEGER REFERENCES autoservice_clients(id),
            name VARCHAR(120) NOT NULL,
            phone VARCHAR(32) NOT NULL,
            preferred_date DATE NOT NULL,
            comment TEXT,
            status VARCHAR(32) NOT NULL DEFAULT 'new',
            source VARCHAR(32) NOT NULL DEFAULT 'client',
            created_by_user_id INTEGER REFERENCES users(id),
            staff_notes TEXT,
            created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
        )
        """

    with engine.begin() as conn:
        conn.execute(text(ddl))
        conn.execute(
            text(
                "CREATE INDEX ix_repair_bookings_preferred_date "
                "ON repair_bookings (preferred_date)"
            )
        )

    logger.info("Applied repair_bookings table patch")


def ensure_repair_bookings_garage_vehicle_column() -> None:
    """Add optional garage_vehicle_id to repair_bookings."""
    inspector = inspect(engine)
    if "repair_bookings" not in inspector.get_table_names():
        return
    if "garage_vehicles" not in inspector.get_table_names():
        return

    columns = {col["name"] for col in inspector.get_columns("repair_bookings")}
    if "garage_vehicle_id" in columns:
        return

    with engine.begin() as conn:
        conn.execute(
            text(
                "ALTER TABLE repair_bookings "
                "ADD COLUMN garage_vehicle_id INTEGER REFERENCES garage_vehicles(id)"
            )
        )
        conn.execute(
            text(
                "CREATE INDEX ix_repair_bookings_garage_vehicle_id "
                "ON repair_bookings (garage_vehicle_id)"
            )
        )

    logger.info("Applied repair_bookings garage_vehicle_id column patch")


def ensure_repair_orders_tables() -> None:
    """Create repair_orders and repair_order_assignees for autoservice repair journal."""
    inspector = inspect(engine)
    tables = set(inspector.get_table_names())
    if "repair_orders" in tables and "repair_order_assignees" in tables:
        return
    if "autoservice_clients" not in tables or "garage_vehicles" not in tables:
        return

    if engine.dialect.name == "postgresql":
        orders_ddl = """
        CREATE TABLE IF NOT EXISTS repair_orders (
            id SERIAL PRIMARY KEY,
            organization_id VARCHAR(10) NOT NULL REFERENCES organizations(id),
            order_number VARCHAR(32) NOT NULL UNIQUE,
            client_id INTEGER NOT NULL REFERENCES autoservice_clients(id),
            vehicle_id INTEGER NOT NULL REFERENCES garage_vehicles(id),
            client_comment TEXT,
            scheduled_at TIMESTAMPTZ NOT NULL,
            accepted_by_user_id INTEGER NOT NULL REFERENCES users(id),
            status VARCHAR(32) NOT NULL DEFAULT 'open',
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
        """
        assignees_ddl = """
        CREATE TABLE IF NOT EXISTS repair_order_assignees (
            order_id INTEGER NOT NULL REFERENCES repair_orders(id) ON DELETE CASCADE,
            user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            PRIMARY KEY (order_id, user_id)
        )
        """
    else:
        orders_ddl = """
        CREATE TABLE IF NOT EXISTS repair_orders (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            organization_id VARCHAR(10) NOT NULL REFERENCES organizations(id),
            order_number VARCHAR(32) NOT NULL UNIQUE,
            client_id INTEGER NOT NULL REFERENCES autoservice_clients(id),
            vehicle_id INTEGER NOT NULL REFERENCES garage_vehicles(id),
            client_comment TEXT,
            scheduled_at DATETIME NOT NULL,
            accepted_by_user_id INTEGER NOT NULL REFERENCES users(id),
            status VARCHAR(32) NOT NULL DEFAULT 'open',
            created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
        )
        """
        assignees_ddl = """
        CREATE TABLE IF NOT EXISTS repair_order_assignees (
            order_id INTEGER NOT NULL REFERENCES repair_orders(id) ON DELETE CASCADE,
            user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            PRIMARY KEY (order_id, user_id)
        )
        """

    index_ddl = [
        "CREATE INDEX IF NOT EXISTS ix_repair_orders_organization_id ON repair_orders (organization_id)",
        "CREATE INDEX IF NOT EXISTS ix_repair_orders_client_id ON repair_orders (client_id)",
        "CREATE INDEX IF NOT EXISTS ix_repair_orders_vehicle_id ON repair_orders (vehicle_id)",
        "CREATE INDEX IF NOT EXISTS ix_repair_orders_status ON repair_orders (status)",
        "CREATE INDEX IF NOT EXISTS ix_repair_orders_scheduled_at ON repair_orders (scheduled_at)",
    ]

    with engine.begin() as conn:
        if "repair_orders" not in tables:
            conn.execute(text(orders_ddl))
            for ddl in index_ddl:
                try:
                    conn.execute(text(ddl))
                except Exception:
                    pass
        if "repair_order_assignees" not in tables:
            conn.execute(text(assignees_ddl))

    logger.info("Applied repair_orders tables patch")


def ensure_repair_order_lines_tables() -> None:
    """Add staff_comment + repair_order_works + repair_order_client_parts."""
    inspector = inspect(engine)
    tables = set(inspector.get_table_names())
    if "repair_orders" not in tables:
        return

    columns = {col["name"] for col in inspector.get_columns("repair_orders")}
    with engine.begin() as conn:
        if "staff_comment" not in columns:
            conn.execute(text("ALTER TABLE repair_orders ADD COLUMN staff_comment TEXT"))

        if "repair_order_works" not in tables:
            if engine.dialect.name == "postgresql":
                conn.execute(
                    text(
                        """
                        CREATE TABLE repair_order_works (
                            id SERIAL PRIMARY KEY,
                            order_id INTEGER NOT NULL REFERENCES repair_orders(id) ON DELETE CASCADE,
                            position INTEGER NOT NULL DEFAULT 1,
                            title VARCHAR(255) NOT NULL,
                            qty INTEGER NOT NULL DEFAULT 1,
                            unit_price NUMERIC(12, 2) NOT NULL DEFAULT 0,
                            executor_user_id INTEGER REFERENCES users(id)
                        )
                        """
                    )
                )
            else:
                conn.execute(
                    text(
                        """
                        CREATE TABLE repair_order_works (
                            id INTEGER PRIMARY KEY AUTOINCREMENT,
                            order_id INTEGER NOT NULL REFERENCES repair_orders(id) ON DELETE CASCADE,
                            position INTEGER NOT NULL DEFAULT 1,
                            title VARCHAR(255) NOT NULL,
                            qty INTEGER NOT NULL DEFAULT 1,
                            unit_price NUMERIC(12, 2) NOT NULL DEFAULT 0,
                            executor_user_id INTEGER REFERENCES users(id)
                        )
                        """
                    )
                )
            try:
                conn.execute(
                    text(
                        "CREATE INDEX IF NOT EXISTS ix_repair_order_works_order_id "
                        "ON repair_order_works (order_id)"
                    )
                )
            except Exception:
                pass

        if "repair_order_client_parts" not in tables:
            if engine.dialect.name == "postgresql":
                conn.execute(
                    text(
                        """
                        CREATE TABLE repair_order_client_parts (
                            id SERIAL PRIMARY KEY,
                            order_id INTEGER NOT NULL REFERENCES repair_orders(id) ON DELETE CASCADE,
                            position INTEGER NOT NULL DEFAULT 1,
                            title VARCHAR(255) NOT NULL,
                            qty INTEGER NOT NULL DEFAULT 1
                        )
                        """
                    )
                )
            else:
                conn.execute(
                    text(
                        """
                        CREATE TABLE repair_order_client_parts (
                            id INTEGER PRIMARY KEY AUTOINCREMENT,
                            order_id INTEGER NOT NULL REFERENCES repair_orders(id) ON DELETE CASCADE,
                            position INTEGER NOT NULL DEFAULT 1,
                            title VARCHAR(255) NOT NULL,
                            qty INTEGER NOT NULL DEFAULT 1
                        )
                        """
                    )
                )
            try:
                conn.execute(
                    text(
                        "CREATE INDEX IF NOT EXISTS ix_repair_order_client_parts_order_id "
                        "ON repair_order_client_parts (order_id)"
                    )
                )
            except Exception:
                pass

    logger.info("Applied repair_order lines tables patch")


def ensure_repair_order_shop_parts_table() -> None:
    """Create repair_order_shop_parts for executor parts with markup."""
    inspector = inspect(engine)
    tables = set(inspector.get_table_names())
    if "repair_order_shop_parts" in tables:
        return
    if "repair_orders" not in tables:
        return

    if engine.dialect.name == "postgresql":
        ddl = """
        CREATE TABLE repair_order_shop_parts (
            id SERIAL PRIMARY KEY,
            order_id INTEGER NOT NULL REFERENCES repair_orders(id) ON DELETE CASCADE,
            position INTEGER NOT NULL DEFAULT 1,
            title VARCHAR(255) NOT NULL,
            qty INTEGER NOT NULL DEFAULT 1,
            unit_price NUMERIC(12, 2) NOT NULL DEFAULT 0,
            markup_percent NUMERIC(6, 2) NOT NULL DEFAULT 5,
            source VARCHAR(32) NOT NULL DEFAULT 'manual',
            product_id INTEGER REFERENCES products(id) ON DELETE SET NULL,
            rossko_brand VARCHAR(120),
            rossko_partnumber VARCHAR(120)
        )
        """
    else:
        ddl = """
        CREATE TABLE repair_order_shop_parts (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            order_id INTEGER NOT NULL REFERENCES repair_orders(id) ON DELETE CASCADE,
            position INTEGER NOT NULL DEFAULT 1,
            title VARCHAR(255) NOT NULL,
            qty INTEGER NOT NULL DEFAULT 1,
            unit_price NUMERIC(12, 2) NOT NULL DEFAULT 0,
            markup_percent NUMERIC(6, 2) NOT NULL DEFAULT 5,
            source VARCHAR(32) NOT NULL DEFAULT 'manual',
            product_id INTEGER REFERENCES products(id) ON DELETE SET NULL,
            rossko_brand VARCHAR(120),
            rossko_partnumber VARCHAR(120)
        )
        """

    with engine.begin() as conn:
        conn.execute(text(ddl))
        try:
            conn.execute(
                text(
                    "CREATE INDEX IF NOT EXISTS ix_repair_order_shop_parts_order_id "
                    "ON repair_order_shop_parts (order_id)"
                )
            )
        except Exception:
            pass

    logger.info("Applied repair_order_shop_parts table patch")


def ensure_repair_order_stage10() -> None:
    """Add lift_number and migrate repair order statuses for stage 10."""
    inspector = inspect(engine)
    if "repair_orders" not in inspector.get_table_names():
        return

    columns = {col["name"] for col in inspector.get_columns("repair_orders")}
    with engine.begin() as conn:
        if "lift_number" not in columns:
            conn.execute(text("ALTER TABLE repair_orders ADD COLUMN lift_number INTEGER"))
        conn.execute(
            text("UPDATE repair_orders SET status = 'accepted' WHERE status = 'open'")
        )
        conn.execute(
            text("UPDATE repair_orders SET status = 'issued' WHERE status = 'completed'")
        )

    logger.info("Applied repair_order stage10 patch")

