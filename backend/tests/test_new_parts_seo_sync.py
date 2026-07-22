import asyncio
import unittest
from datetime import datetime, timedelta, timezone
from unittest.mock import AsyncMock, MagicMock, patch

from app.services.new_parts_seo_sync_service import (
    STATUS_CREATED,
    STATUS_NOT_FOUND,
    STATUS_SKIPPED_EXISTS,
    SyncCandidate,
    _should_skip_before_rossko,
    collect_distinct_product_candidates,
    extract_cross_candidates_from_rossko,
    extract_sibling_candidates_from_rossko,
    sync_new_parts_seo_from_products,
)
from app.services.rossko_part_selection import pick_best_rossko_part, pick_ranked_rossko_parts
from app.services.seo_quota_service import get_expected_created_by_now, is_behind_quota
from app.services.seo_sync_types import SOURCE_CROSS, SOURCE_PRODUCT, SOURCE_SIBLING


def _part(brand: str, partnumber: str, *, count: int = 5, price: float = 100.0) -> dict:
    return {
        "brand": brand,
        "partnumber": partnumber,
        "name": f"{brand} {partnumber}",
        "stocks": {"stock": {"count": count, "price": price, "id": "s1"}},
    }


def _rossko_response(*parts: dict) -> dict:
    return {"PartsList": {"Part": list(parts)}}


class CollectDistinctCandidatesTests(unittest.TestCase):
    @patch("app.services.new_parts_seo_sync_service.is_working_catalog_product", return_value=True)
    @patch("app.services.new_parts_seo_sync_service._iter_catalog_products")
    def test_dedups_same_brand_article(self, mock_iter, _is_working):
        products = []
        for _ in range(3):
            product = MagicMock()
            product.brand = "MANN"
            product.article = "IF-1009"
            product.name = "Filter"
            products.append(product)
        mock_iter.return_value = products

        candidates = collect_distinct_product_candidates(MagicMock())

        self.assertEqual(len(candidates), 1)
        self.assertEqual(candidates[0].brand, "MANN")
        self.assertEqual(candidates[0].article, "IF-1009")
        self.assertEqual(candidates[0].lookup_key, "mann|IF1009")
        self.assertEqual(candidates[0].source, SOURCE_PRODUCT)


class ExtractCrossCandidatesTests(unittest.TestCase):
    def test_extracts_cross_analogs(self):
        data = _rossko_response(
            {
                **_part("MANN", "IF1009"),
                "crosses": {
                    "Part": [
                        _part("BOSCH", "0986AB1234"),
                        _part("ATE", "130460"),
                    ]
                },
            }
        )
        crosses = extract_cross_candidates_from_rossko(data)
        self.assertEqual(len(crosses), 2)
        self.assertEqual(crosses[0].brand, "BOSCH")
        self.assertEqual(crosses[0].source, SOURCE_CROSS)


class ExtractSiblingCandidatesTests(unittest.TestCase):
    def test_extracts_in_stock_siblings(self):
        data = _rossko_response(
            _part("MANN", "IF1009"),
            _part("BOSCH", "IF1009"),
            _part("ATE", "IF1009", count=0),
        )
        siblings = extract_sibling_candidates_from_rossko(
            data,
            query_brand="MANN",
            query_article="IF1009",
        )
        self.assertEqual(len(siblings), 1)
        self.assertEqual(siblings[0].brand, "BOSCH")
        self.assertEqual(siblings[0].source, SOURCE_SIBLING)


class PickBestRosskoPartTests(unittest.TestCase):
    def test_prefers_exact_article_match_over_analog(self):
        data = _rossko_response(
            _part("MANN", "IF1009A", price=100),
            _part("MANN", "IF1009", price=200),
        )

        best = pick_best_rossko_part(data, brand="MANN", article="IF1009")

        self.assertIsNotNone(best)
        self.assertEqual(best["partnumber"], "IF1009")

    def test_skips_parts_without_stock(self):
        data = _rossko_response(
            _part("MANN", "IF1009", count=0),
            _part("BOSCH", "IF1009", count=3),
        )

        best = pick_best_rossko_part(data, brand="MANN", article="IF1009")

        self.assertIsNotNone(best)
        self.assertEqual(best["brand"], "BOSCH")

    def test_ranked_returns_multiple_in_stock(self):
        data = _rossko_response(
            _part("MANN", "IF1009A"),
            _part("MANN", "IF1009"),
            _part("BOSCH", "IF1009"),
            _part("MANN", "IF1009B"),
            _part("MANN", "IF1009C"),
            _part("MANN", "IF1009D"),
        )
        ranked = pick_ranked_rossko_parts(data, brand="MANN", article="IF1009", limit=5)
        self.assertEqual(len(ranked), 5)

    def test_includes_cross_analogs_when_enabled(self):
        data = _rossko_response(
            {
                "brand": "Blue Print",
                "partnumber": "ADM53084",
                "name": "Комплект сцепления",
                "stocks": None,
                "crosses": {
                    "Part": [
                        _part("Sachs", "3000 990 214"),
                        _part("LUK", "624335909", count=0),
                    ]
                },
            }
        )
        ranked = pick_ranked_rossko_parts(
            data,
            brand="Blue Print",
            article="ADM53084",
            limit=5,
            include_crosses=True,
        )
        self.assertEqual(len(ranked), 1)
        self.assertEqual(ranked[0]["brand"], "Sachs")

        without_crosses = pick_ranked_rossko_parts(
            data,
            brand="Blue Print",
            article="ADM53084",
            limit=5,
            include_crosses=False,
        )
        self.assertEqual(without_crosses, [])

    def test_tecdoc_unrelated_in_stock_part_is_accepted(self):
        data = _rossko_response(_part("OTHERBRAND", "ZZ-999"))
        ranked = pick_ranked_rossko_parts(
            data,
            brand="MANN-FILTER",
            article="IF1009",
            limit=5,
            include_crosses=True,
        )
        self.assertEqual(len(ranked), 1)
        self.assertEqual(ranked[0]["brand"], "OTHERBRAND")

    def test_seed_limit_zero_returns_all_in_stock_parts(self):
        parts = [_part("FENOX", f"RC{i:05d}") for i in range(23)]
        data = _rossko_response(*parts)
        ranked = pick_ranked_rossko_parts(
            data,
            brand="FENOX",
            article="RC00047",
            limit=0,
            include_crosses=True,
            max_extract_parts=500,
        )
        self.assertEqual(len(ranked), 23)

    def test_seed_limit_100_allows_more_than_default_five(self):
        parts = [_part("FENOX", f"P{i:03d}") for i in range(30)]
        data = _rossko_response(*parts)
        ranked = pick_ranked_rossko_parts(
            data,
            brand="FENOX",
            article="RC00047",
            limit=100,
            include_crosses=True,
        )
        self.assertEqual(len(ranked), 30)


class RosskoHasInStockCrossesTests(unittest.TestCase):
    def test_tecdoc_cross_stock_counts_as_in_stock(self):
        from app.services.seo_rossko_seed_service import _rossko_has_in_stock

        data = _rossko_response(
            {
                "brand": "Blue Print",
                "partnumber": "ADM53084",
                "stocks": None,
                "crosses": {"Part": [_part("Sachs", "3000 990 214")]},
            }
        )
        self.assertFalse(_rossko_has_in_stock(data, include_crosses=False))
        self.assertTrue(_rossko_has_in_stock(data, include_crosses=True))


class ShouldSkipBeforeRosskoTests(unittest.TestCase):
    def test_skips_not_found_until_retry(self):
        now = datetime.now(timezone.utc)
        log_row = MagicMock()
        log_row.status = STATUS_NOT_FOUND
        log_row.next_retry_at = now + timedelta(days=3)

        self.assertTrue(_should_skip_before_rossko(log_row, now))

    def test_retries_not_found_after_next_retry_at(self):
        now = datetime.now(timezone.utc)
        log_row = MagicMock()
        log_row.status = STATUS_NOT_FOUND
        log_row.next_retry_at = now - timedelta(hours=1)

        self.assertFalse(_should_skip_before_rossko(log_row, now))

    def test_skips_created_status(self):
        log_row = MagicMock()
        log_row.status = STATUS_CREATED

        self.assertTrue(
            _should_skip_before_rossko(log_row, datetime.now(timezone.utc))
        )


class SyncNewPartsSeoFromProductsTests(unittest.TestCase):
    def _run(self, coro):
        return asyncio.run(coro)

    @patch("app.services.new_parts_seo_sync_service.asyncio.sleep", new_callable=AsyncMock)
    @patch("app.services.new_parts_seo_sync_service._persist_discoveries")
    @patch("app.services.new_parts_seo_sync_service._upsert_sync_log")
    @patch("app.services.new_parts_seo_sync_service.create_or_get_new_part_card")
    @patch("app.services.new_parts_seo_sync_service._fetch_rossko_search", new_callable=AsyncMock)
    @patch("app.services.new_parts_seo_sync_service.stable_key_exists", return_value=True)
    @patch("app.services.new_parts_seo_sync_service.find_active_card_for_lookup")
    @patch("app.services.new_parts_seo_sync_service._get_sync_log", return_value=None)
    @patch("app.services.new_parts_seo_sync_service._collect_run_candidates")
    @patch("app.services.new_parts_seo_sync_service.count_seo_cards_created_today", return_value=0)
    def test_skips_existing_card_without_create(
        self,
        _count_today,
        mock_collect,
        _get_log,
        mock_find_card,
        _stable_exists,
        mock_rossko,
        mock_create,
        _upsert,
        _persist,
        _sleep,
    ):
        mock_collect.return_value = [
            SyncCandidate(lookup_key="mann|IF1009", brand="MANN", article="IF1009"),
        ]
        existing = MagicMock()
        existing.id = 42
        existing.brand = "MANN"
        existing.article = "IF1009"
        mock_find_card.return_value = existing

        result = self._run(sync_new_parts_seo_from_products(MagicMock(), daily_limit=100))

        self.assertEqual(result.skipped, 1)
        self.assertEqual(result.created, 0)
        mock_rossko.assert_not_called()
        mock_create.assert_not_called()

    @patch("app.services.new_parts_seo_sync_service.asyncio.sleep", new_callable=AsyncMock)
    @patch("app.services.new_parts_seo_sync_service._persist_discoveries")
    @patch("app.services.new_parts_seo_sync_service._upsert_sync_log")
    @patch("app.services.new_parts_seo_sync_service.is_rossko_new_part_sitemap_eligible", return_value=True)
    @patch("app.services.new_parts_seo_sync_service.create_or_get_new_part_card")
    @patch("app.services.new_parts_seo_sync_service._fetch_rossko_search", new_callable=AsyncMock)
    @patch("app.services.new_parts_seo_sync_service.stable_key_exists")
    @patch("app.services.new_parts_seo_sync_service.find_active_card_for_lookup", return_value=None)
    @patch("app.services.new_parts_seo_sync_service._get_sync_log", return_value=None)
    @patch("app.services.new_parts_seo_sync_service._collect_run_candidates")
    @patch("app.services.new_parts_seo_sync_service.count_seo_cards_created_today")
    def test_daily_limit_allows_200th_create_blocks_201st(
        self,
        mock_count_today,
        mock_collect,
        _get_log,
        _find_card,
        mock_stable_exists,
        mock_rossko,
        mock_create,
        _eligible,
        _upsert,
        _persist,
        _sleep,
    ):
        mock_count_today.return_value = 199
        mock_collect.return_value = [
            SyncCandidate(lookup_key=f"brand{i}|ART{i}", brand=f"Brand{i}", article=f"ART{i}")
            for i in range(2)
        ]
        mock_stable_exists.return_value = False
        mock_rossko.return_value = _rossko_response(_part("Brand0", "ART0"))
        card = MagicMock()
        card.id = 1
        card.brand = "Brand0"
        card.article = "ART0"
        mock_create.return_value = card

        result = self._run(sync_new_parts_seo_from_products(MagicMock(), daily_limit=200))

        self.assertEqual(result.created, 1)
        self.assertTrue(result.stopped_by_daily_limit)
        mock_create.assert_called_once()

    @patch("app.services.new_parts_seo_sync_service.asyncio.sleep", new_callable=AsyncMock)
    @patch("app.services.new_parts_seo_sync_service._persist_discoveries")
    @patch("app.services.new_parts_seo_sync_service._upsert_sync_log")
    @patch("app.services.new_parts_seo_sync_service._fetch_rossko_search", new_callable=AsyncMock)
    @patch("app.services.new_parts_seo_sync_service.find_active_card_for_lookup", return_value=None)
    @patch("app.services.new_parts_seo_sync_service._get_sync_log", return_value=None)
    @patch("app.services.new_parts_seo_sync_service._collect_run_candidates")
    @patch("app.services.new_parts_seo_sync_service.count_seo_cards_created_today", return_value=0)
    def test_not_found_sets_retry_in_seven_days(
        self,
        _count_today,
        mock_collect,
        _get_log,
        _find_card,
        mock_rossko,
        mock_upsert,
        _persist,
        _sleep,
    ):
        mock_collect.return_value = [
            SyncCandidate(lookup_key="mann|IF1009", brand="MANN", article="IF1009"),
        ]
        mock_rossko.return_value = {"PartsList": {"Part": []}}

        with patch(
            "app.services.new_parts_seo_sync_service._utcnow",
            return_value=datetime(2026, 6, 5, 12, 0, tzinfo=timezone.utc),
        ):
            result = self._run(
                sync_new_parts_seo_from_products(
                    MagicMock(),
                    daily_limit=100,
                    not_found_retry_days=7,
                )
            )

        self.assertEqual(result.not_found, 1)
        mock_upsert.assert_called_once()
        kwargs = mock_upsert.call_args.kwargs
        self.assertEqual(kwargs["status"], STATUS_NOT_FOUND)
        self.assertEqual(
            kwargs["next_retry_at"],
            datetime(2026, 6, 12, 12, 0, tzinfo=timezone.utc),
        )

    @patch("app.services.new_parts_seo_sync_service.asyncio.sleep", new_callable=AsyncMock)
    @patch("app.services.new_parts_seo_sync_service._persist_discoveries")
    @patch("app.services.new_parts_seo_sync_service._upsert_sync_log")
    @patch("app.services.new_parts_seo_sync_service.is_rossko_new_part_sitemap_eligible", return_value=True)
    @patch("app.services.new_parts_seo_sync_service.create_or_get_new_part_card")
    @patch("app.services.new_parts_seo_sync_service._fetch_rossko_search", new_callable=AsyncMock)
    @patch("app.services.new_parts_seo_sync_service.stable_key_exists", return_value=False)
    @patch("app.services.new_parts_seo_sync_service.find_active_card_for_lookup", return_value=None)
    @patch("app.services.new_parts_seo_sync_service._get_sync_log", return_value=None)
    @patch("app.services.new_parts_seo_sync_service._collect_run_candidates")
    @patch("app.services.new_parts_seo_sync_service.count_seo_cards_created_today", return_value=0)
    def test_rossko_multi_part_response_creates_up_to_five_cards(
        self,
        _count_today,
        mock_collect,
        _get_log,
        _find_card,
        _stable_exists,
        mock_rossko,
        mock_create,
        _eligible,
        _upsert,
        _persist,
        _sleep,
    ):
        mock_collect.return_value = [
            SyncCandidate(lookup_key="mann|IF1009", brand="MANN", article="IF1009"),
        ]
        mock_rossko.return_value = _rossko_response(
            _part("MANN", "IF1009A"),
            _part("MANN", "IF1009"),
            _part("MANN", "IF1009B"),
            _part("BOSCH", "IF1009"),
            _part("MANN", "IF1009C"),
            _part("MANN", "IF1009D"),
        )

        def _make_card(_db, payload):
            card = MagicMock()
            card.id = hash(payload["article"]) % 1000
            card.brand = payload["brand"]
            card.article = payload["article"]
            return card

        mock_create.side_effect = _make_card

        result = self._run(sync_new_parts_seo_from_products(MagicMock(), daily_limit=100))

        self.assertEqual(result.created, 5)
        self.assertEqual(mock_create.call_count, 5)

    @patch("app.services.new_parts_seo_sync_service._collect_run_candidates")
    @patch("app.services.new_parts_seo_sync_service.count_seo_cards_created_today", return_value=100)
    def test_stops_immediately_when_daily_limit_already_reached(
        self, mock_count_today, mock_collect
    ):
        mock_collect.return_value = [
            SyncCandidate(lookup_key="mann|IF1009", brand="MANN", article="IF1009"),
        ]

        result = self._run(sync_new_parts_seo_from_products(MagicMock(), daily_limit=100))

        self.assertTrue(result.stopped_by_daily_limit)
        self.assertEqual(result.created, 0)
        self.assertEqual(result.processed, 0)


class SeoSyncBatchSettingsTests(unittest.TestCase):
    @patch("app.services.seo_sync_settings_service.settings")
    def test_auto_batch_size_from_daily_limit(self, mock_settings):
        mock_settings.NEW_PARTS_SEO_SYNC_BATCH_SIZE = 0
        mock_settings.NEW_PARTS_SEO_SYNC_BATCH_INTERVAL_MINUTES = 30
        mock_settings.NEW_PARTS_SEO_SYNC_DAILY_LIMIT = 1000
        mock_settings.NEW_PARTS_SEO_SYNC_ROSSKO_DELAY_SEC = 0.2
        mock_settings.NEW_PARTS_SEO_SEED_PRECHECK_DAILY = 1500
        mock_settings.NEW_PARTS_SEO_SEED_PRECHECK_INTERVAL_MINUTES = 30

        from app.services.new_parts_seo_sync_service import get_seo_sync_batch_size

        self.assertEqual(get_seo_sync_batch_size(), 21)

    @patch("app.services.seo_sync_settings_service.settings")
    def test_configured_batch_size_override(self, mock_settings):
        mock_settings.NEW_PARTS_SEO_SYNC_BATCH_SIZE = 50
        mock_settings.NEW_PARTS_SEO_SYNC_BATCH_INTERVAL_MINUTES = 30
        mock_settings.NEW_PARTS_SEO_SYNC_DAILY_LIMIT = 1000
        mock_settings.NEW_PARTS_SEO_SYNC_ROSSKO_DELAY_SEC = 0.2
        mock_settings.NEW_PARTS_SEO_SEED_PRECHECK_DAILY = 1500
        mock_settings.NEW_PARTS_SEO_SEED_PRECHECK_INTERVAL_MINUTES = 30

        from app.services.new_parts_seo_sync_service import get_seo_sync_batch_size

        self.assertEqual(get_seo_sync_batch_size(), 50)


class SeoSyncBatchRunTests(unittest.TestCase):
    def _run(self, coro):
        import asyncio

        return asyncio.run(coro)

    @patch("app.services.new_parts_seo_sync_service.count_seo_cards_created_today", return_value=0)
    @patch("app.services.new_parts_seo_sync_service._collect_run_candidates", return_value=[])
    def test_batch_respects_zero_remaining_daily(self, _collect, _count_today):
        from app.services.new_parts_seo_sync_service import sync_new_parts_seo_batch

        with patch(
            "app.services.new_parts_seo_sync_service.count_seo_cards_created_today",
            return_value=1000,
        ):
            result = self._run(
                sync_new_parts_seo_batch(MagicMock(), daily_limit=1000, max_new_cards=21)
            )

        self.assertTrue(result.stopped_by_daily_limit)
        self.assertEqual(result.created, 0)


class CountSeoCardsCreatedTodayTests(unittest.TestCase):
    def test_counts_cards_not_sync_log_rows(self):
        from app.services.new_parts_seo_sync_service import count_seo_cards_created_today

        db = MagicMock()
        card_query = MagicMock()
        log_query = MagicMock()
        db.query.side_effect = [card_query, log_query]
        card_query.filter.return_value = card_query
        card_query.count.return_value = 5

        self.assertEqual(count_seo_cards_created_today(db), 5)
        log_query.count.assert_not_called()

    def test_falls_back_to_sync_log_when_no_cards(self):
        from app.services.new_parts_seo_sync_service import count_seo_cards_created_today

        db = MagicMock()
        card_query = MagicMock()
        log_query = MagicMock()
        db.query.side_effect = [card_query, log_query]
        card_query.filter.return_value = card_query
        log_query.filter.return_value = log_query
        card_query.count.return_value = 0
        log_query.count.return_value = 2

        self.assertEqual(count_seo_cards_created_today(db), 2)


class QuotaCatchupTests(unittest.TestCase):
    def test_expected_created_scales_with_hour(self):
        with patch(
            "app.services.seo_quota_service._utcnow",
            return_value=datetime(2026, 6, 10, 12, 0, tzinfo=timezone.utc),
        ):
            self.assertEqual(get_expected_created_by_now(daily_limit=1000), 500)

    @patch("app.services.seo_quota_service._count_created_today", return_value=100)
    @patch("app.services.seo_quota_service.settings")
    def test_is_behind_when_created_below_expected_minus_slack(self, mock_settings, _count):
        mock_settings.NEW_PARTS_SEO_CATCHUP_SLACK = 50
        with patch(
            "app.services.seo_quota_service._utcnow",
            return_value=datetime(2026, 6, 10, 12, 0, tzinfo=timezone.utc),
        ):
            self.assertTrue(is_behind_quota(MagicMock(), daily_limit=1000))


if __name__ == "__main__":
    unittest.main()
