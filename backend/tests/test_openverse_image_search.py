import json
import unittest
from datetime import datetime, timedelta, timezone
from unittest.mock import patch

from app.models.new_parts_seo_card import NewPartsSeoCard
from app.services.openverse_image_search_service import (
    CHECKED_AT_KEY,
    _checked_recently,
    build_image_search_queries,
    is_safe_download_url,
    parse_image_results,
    resolve_new_part_card_image,
)


SAMPLE_JSON = {
    "result_count": 2,
    "results": [
        {
            "title": "Oil filter",
            "url": "https://upload.wikimedia.org/filter.jpg",
            "thumbnail": "https://api.openverse.org/thumb.jpg",
            "creator": "Jane Doe",
            "license": "by",
            "attribution": "Oil filter by Jane Doe / CC BY",
            "license_url": "https://creativecommons.org/licenses/by/4.0/",
        },
        {
            "title": "Engine",
            "url": "not-a-url",
            "thumbnail": "https://live.staticflickr.com/engine.jpg",
        },
    ],
}


class OpenverseImageSearchServiceTests(unittest.TestCase):
    def test_parse_prefers_full_url(self):
        rows = parse_image_results(SAMPLE_JSON)
        self.assertEqual(rows[0]["url"], "https://upload.wikimedia.org/filter.jpg")
        self.assertEqual(rows[0]["attribution"], "Oil filter by Jane Doe / CC BY")
        self.assertEqual(rows[1]["url"], "https://live.staticflickr.com/engine.jpg")

    def test_parse_empty_returns_empty(self):
        self.assertEqual(parse_image_results({}), [])
        self.assertEqual(parse_image_results(None), [])

    def test_query_uses_brand_article_then_name(self):
        self.assertEqual(
            build_image_search_queries(" MAHLE ", "OX388D", "Масляный фильтр"),
            ["MAHLE OX388D", "MAHLE Масляный фильтр"],
        )

    def test_skips_private_download_hosts(self):
        self.assertFalse(is_safe_download_url("http://127.0.0.1/x.jpg"))
        self.assertFalse(is_safe_download_url("http://localhost/x.jpg"))
        self.assertFalse(is_safe_download_url("ftp://example.com/x.jpg"))

    def test_resolve_returns_existing_image_without_openverse(self):
        card = NewPartsSeoCard(
            id=1,
            source="rossko",
            stable_key="k",
            brand="MAHLE",
            article="OX388D",
            image_url="/uploads/already.jpg",
        )
        with patch(
            "app.services.openverse_image_search_service.first_openverse_image"
        ) as search:
            out = resolve_new_part_card_image(db=None, card=card)
        self.assertEqual(out, "/uploads/already.jpg")
        search.assert_not_called()

    def test_checked_recently_blocks_retry(self):
        checked = (datetime.now(timezone.utc) - timedelta(days=1)).isoformat()
        card = NewPartsSeoCard(
            id=3,
            source="rossko",
            stable_key="k3",
            brand="MAHLE",
            article="OX388D",
            raw_payload=json.dumps({CHECKED_AT_KEY: checked}),
        )
        self.assertTrue(_checked_recently(card))

    def test_resolve_skips_openverse_when_recently_checked(self):
        checked = (datetime.now(timezone.utc) - timedelta(days=1)).isoformat()
        card = NewPartsSeoCard(
            id=4,
            source="rossko",
            stable_key="k4",
            brand="MAHLE",
            article="OX388D",
            image_url=None,
            raw_payload=json.dumps({CHECKED_AT_KEY: checked}),
        )
        with patch(
            "app.services.openverse_image_search_service.first_openverse_image"
        ) as search:
            self.assertIsNone(resolve_new_part_card_image(db=None, card=card))
            search.assert_not_called()

    def test_invalid_json_results_are_ignored(self):
        self.assertEqual(parse_image_results({"results": ["nope", 1, None]}), [])


if __name__ == "__main__":
    unittest.main()
