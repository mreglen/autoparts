-- Search performance indexes for products(article/name)
-- Manual apply script for PostgreSQL.
--
-- Apply:
--   psql "$DATABASE_URL" -f backend/sql/search_perf_indexes.sql
--
-- Rollback:
--   DROP INDEX IF EXISTS idx_products_article_trgm;
--   DROP INDEX IF EXISTS idx_products_name_trgm;
--   DROP INDEX IF EXISTS idx_products_article_normalized;
--   DROP INDEX IF EXISTS idx_products_quantity_positive;
--
-- Note:
-- This script intentionally uses non-CONCURRENT index creation so it can run
-- in clients that wrap execution in a transaction block (e.g. pgAdmin default).
-- For production zero-downtime indexing, run a separate CONCURRENTLY script
-- outside a transaction.

CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- Trigram index for article ILIKE/contains lookups.
CREATE INDEX IF NOT EXISTS idx_products_article_trgm
ON products USING gin (article gin_trgm_ops);

-- Trigram index for name ILIKE/contains lookups.
CREATE INDEX IF NOT EXISTS idx_products_name_trgm
ON products USING gin (name gin_trgm_ops);

-- Functional index matching get_sql_normalize(article) from search_products.py.
CREATE INDEX IF NOT EXISTS idx_products_article_normalized
ON products (
  replace(
    replace(
      replace(
        replace(
          replace(
            replace(
              replace(upper(article), '-', ''),
            ' ', ''),
          '.', ''),
        '/', ''),
      '(', ''),
    ')', ''),
  '_', '')
);

-- Partial index for "only in stock" scans.
CREATE INDEX IF NOT EXISTS idx_products_quantity_positive
ON products (id)
WHERE quantity > 0;
