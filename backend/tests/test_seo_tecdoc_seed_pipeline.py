import asyncio
import unittest
from unittest.mock import AsyncMock, MagicMock, patch

from app.services.seo_quota_service import get_seed_conversion_by_source
from app.services.seo_tecdoc_brand_service import map_tecdoc_brand_to_rossko


class TecdocBrandMapTests(unittest.TestCase):
    def test_maps_mann_filter_to_mann(self):
        self.assertEqual(map_tecdoc_brand_to_rossko("MANN-FILTER"), "MANN")

    def test_maps_febi_bilstein_to_febi(self):
        self.assertEqual(map_tecdoc_brand_to_rossko("FEBI BILSTEIN"), "FEBI")

    def test_unknown_brand_uppercased(self):
        self.assertEqual(map_tecdoc_brand_to_rossko("bosch"), "BOSCH")

    def test_empty_brand_unchanged(self):
        self.assertEqual(map_tecdoc_brand_to_rossko(""), "")


class SeedConversionMetricsTests(unittest.TestCase):
    def test_conversion_pct_ready_over_checked(self):
        db = MagicMock()
        query = MagicMock()
        db.query.return_value = query
        query.group_by.return_value = query
        query.all.return_value = [
            ("tecdoc", "ready", 45),
            ("tecdoc", "not_found", 55),
            ("tecdoc", "pending", 100),
            ("semantic", "ready", 10),
            ("semantic", "not_found", 0),
        ]

        result = get_seed_conversion_by_source(db)

        self.assertEqual(result["tecdoc"]["checked"], 100)
        self.assertEqual(result["tecdoc"]["conversion_pct"], 45.0)
        self.assertEqual(result["tecdoc"]["pending"], 100)
        self.assertEqual(result["semantic"]["conversion_pct"], 100.0)


class TecdocSeedPipelineTests(unittest.TestCase):
    def _run(self, coro):
        return asyncio.run(coro)

    @patch("app.services.new_parts_seo_sync_service.count_seo_cards_created_today", return_value=0)
    @patch("app.services.seo_rossko_seed_service.precheck_budget_remaining", return_value=10)
    @patch("app.services.seo_rossko_seed_service.increment_precheck_calls")
    @patch("app.services.seo_rossko_seed_service._fetch_rossko_search", new_callable=AsyncMock)
    @patch("app.services.seo_rossko_seed_service._rossko_has_in_stock", return_value=True)
    @patch("app.services.seo_rossko_seed_service.mark_seed_ready")
    @patch("app.services.seo_rossko_seed_service.count_seed_queue_by_status", return_value=0)
    @patch("app.services.seo_rossko_seed_service.settings")
    def test_precheck_uses_mapped_brand_for_tecdoc(
        self,
        mock_settings,
        _ready_count,
        mock_mark_ready,
        _has_stock,
        mock_fetch,
        _increment,
        _budget,
        _created_today,
    ):
        mock_settings.NEW_PARTS_SEO_SEED_READY_TARGET = 1500
        mock_settings.NEW_PARTS_SEO_SYNC_DAILY_LIMIT = 1000
        mock_settings.NEW_PARTS_SEO_SYNC_ROSSKO_DELAY_SEC = 0

        row = MagicMock()
        row.lookup_key = "mann|w71275"
        row.brand = "MANN-FILTER"
        row.article = "W712/75"
        row.source = "tecdoc"

        db = MagicMock()
        mock_fetch.return_value = {"PartsList": {"Part": []}}

        from app.services.seo_rossko_seed_service import run_seed_precheck_batch

        with patch(
            "app.services.seo_rossko_seed_service._select_pending_seed_rows_fair",
            return_value=[row],
        ):
            stats = self._run(run_seed_precheck_batch(db, max_checks=1))

        mock_fetch.assert_awaited_once()
        search_text = mock_fetch.await_args[0][1]
        self.assertEqual(search_text, "MANN W712/75")
        self.assertEqual(stats["checked"], 1)
        mock_mark_ready.assert_called_once()

    @patch("app.services.tecdoc_pair_harvest_service.harvest_tecdoc_cross_pairs", return_value={"inserted": 0})
    @patch("app.services.tecdoc_pair_harvest_service.harvest_tecdoc_direct_pairs", return_value={"inserted": 0})
    @patch("app.services.seo_rossko_seed_service.map_tecdoc_brand_to_rossko", return_value="MANN")
    @patch("app.services.seo_rossko_seed_service._try_add_pair", return_value=True)
    @patch("app.services.seo_rossko_seed_service.is_working_catalog_product", return_value=True)
    @patch("app.services.seo_rossko_seed_service._iter_catalog_products")
    @patch("app.services.seo_rossko_seed_service.settings")
    def test_populate_tecdoc_applies_brand_map(
        self,
        mock_settings,
        mock_iter,
        _is_working,
        mock_try_add,
        mock_map,
        _direct_harvest,
        _cross_harvest,
    ):
        mock_settings.NEW_PARTS_SEO_SEED_TECDOC_LIMIT = 10

        product = MagicMock()
        product.article = "W712/75"
        mock_iter.return_value = [product]

        cross_query = MagicMock()
        db = MagicMock()
        db.query.side_effect = [cross_query]
        cross_query.join.return_value = cross_query
        cross_query.filter.return_value = cross_query
        cross_query.limit.return_value = cross_query
        cross_query.all.return_value = [("W712/75", "MANN-FILTER")]

        from app.services.seo_rossko_seed_service import _populate_tecdoc

        stats = {"total": 0, "tecdoc": 0}
        seen: set[str] = set()
        _populate_tecdoc(db, seen=seen, stats=stats, limit=100)

        mock_map.assert_called_with("MANN-FILTER")
        mock_try_add.assert_called()
        call_kwargs = mock_try_add.call_args.kwargs
        self.assertEqual(call_kwargs["brand"], "MANN")
        self.assertEqual(call_kwargs["source"], "tecdoc")

    @patch("app.services.new_parts_seo_sync_service.count_seo_cards_created_today", return_value=0)
    @patch("app.services.seo_rossko_seed_service.precheck_budget_remaining", return_value=10)
    @patch("app.services.seo_rossko_seed_service.increment_precheck_calls")
    @patch("app.services.seo_rossko_seed_service._fetch_rossko_search", new_callable=AsyncMock)
    @patch("app.services.seo_rossko_seed_service._rossko_has_in_stock")
    @patch("app.services.seo_rossko_seed_service.mark_seed_ready")
    @patch("app.services.seo_rossko_seed_service.mark_seed_not_found")
    @patch("app.services.seo_rossko_seed_service.count_seed_queue_by_status", return_value=0)
    @patch("app.services.seo_rossko_seed_service.settings")
    def test_precheck_tecdoc_falls_back_to_article_only(
        self,
        mock_settings,
        _ready_count,
        mock_not_found,
        mock_mark_ready,
        mock_has_stock,
        mock_fetch,
        _increment,
        _budget,
        _created_today,
    ):
        mock_settings.NEW_PARTS_SEO_SEED_READY_TARGET = 1500
        mock_settings.NEW_PARTS_SEO_SYNC_DAILY_LIMIT = 1000
        mock_settings.NEW_PARTS_SEO_SYNC_ROSSKO_DELAY_SEC = 0
        mock_has_stock.side_effect = [False, True]

        row = MagicMock()
        row.lookup_key = "mann|w71275"
        row.brand = "MANN-FILTER"
        row.article = "W712/75"
        row.source = "tecdoc"

        db = MagicMock()
        with patch(
            "app.services.seo_rossko_seed_service._select_pending_seed_rows_fair",
            return_value=[row],
        ):
            from app.services.seo_rossko_seed_service import run_seed_precheck_batch

            stats = self._run(run_seed_precheck_batch(db, max_checks=1))

        self.assertEqual(mock_fetch.await_count, 2)
        self.assertEqual(mock_fetch.await_args_list[0].args[1], "MANN W712/75")
        self.assertEqual(mock_fetch.await_args_list[1].args[1], "W712/75")
        mock_mark_ready.assert_called_once()
        mock_not_found.assert_not_called()
        self.assertEqual(stats["ready"], 1)


class CreatedBySourceCounterTests(unittest.TestCase):
    def test_increment_created_by_source_accumulates(self):
        from app.services.seo_quota_service import (
            _load_created_by_source,
            increment_created_by_source,
        )

        db = MagicMock()
        row = MagicMock()
        row.created_by_source_json = None

        with patch("app.services.seo_quota_service._get_or_create_daily_counter", return_value=row):
            increment_created_by_source(db, "tecdoc")
            increment_created_by_source(db, "product")
            increment_created_by_source(db, "tecdoc")

        counts = _load_created_by_source(row)
        self.assertEqual(counts.get("tecdoc"), 2)
        self.assertEqual(counts.get("product"), 1)


if __name__ == "__main__":
    unittest.main()
