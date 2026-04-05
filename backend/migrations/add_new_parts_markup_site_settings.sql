-- Наценка на цены поставщика в разделе «Новые запчасти» (проценты, по умолчанию 15).
-- SQLite 3.35+: повторный запуск не падает.
ALTER TABLE site_settings ADD COLUMN IF NOT EXISTS new_parts_markup_percent REAL NOT NULL DEFAULT 15;
