import unittest
from pathlib import Path
from unittest.mock import patch

from app.services.seo_semantic_seed_service import (
    _extract_pairs_from_semantic_map,
    load_semantic_seed_pairs,
)


SAMPLE_CLUSTER_A = """
## Кластер A — brand+article

| # | Запрос | URL |
|---|--------|-----|
| 1 | купить bosch 0986424590 | /autoparts/new/part/{id}-bosch-0986424590 |
| 2 | mann w712/75 фильтр | /autoparts/new/part/{id}-mann-w71275 |
| 3 | артикул 34116761280 bmw | /autoparts/new/part/{id}-bmw-34116761280 |

## Кластер B — другое
| 1 | ignored | /autoparts/new/part/{id}-ignored-000 |
"""


class SemanticSeedParserTests(unittest.TestCase):
    def test_extract_pairs_from_cluster_a_only(self):
        pairs = _extract_pairs_from_semantic_map(SAMPLE_CLUSTER_A)
        brands_articles = {(brand, article) for brand, article in pairs}
        self.assertIn(("BOSCH", "0986424590"), brands_articles)
        self.assertIn(("BMW", "34116761280"), brands_articles)
        self.assertNotIn(("IGNORED", "000"), brands_articles)

    def test_load_semantic_seed_pairs_at_least_fifty(self):
        pairs = load_semantic_seed_pairs()
        self.assertGreaterEqual(len(pairs), 50)

    def test_dedupes_across_sources(self):
        pairs = load_semantic_seed_pairs()
        keys = [f"{brand}:{article}" for brand, article in pairs]
        self.assertEqual(len(keys), len(set(keys)))

    @patch("app.services.seo_semantic_seed_service._SEMANTIC_MAP_PATH", Path("/nonexistent/map.md"))
    @patch("app.services.seo_semantic_seed_service._JSON_PAIRS_PATH", Path("/nonexistent/pairs.json"))
    def test_fallback_only_still_nonempty(self):
        pairs = load_semantic_seed_pairs()
        self.assertGreaterEqual(len(pairs), 20)


if __name__ == "__main__":
    unittest.main()
