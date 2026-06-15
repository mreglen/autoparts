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

