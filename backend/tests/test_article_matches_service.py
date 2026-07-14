import unittest
from unittest.mock import MagicMock

from app.services.article_matches_service import find_article_matches
from app.utils.partnumber import normalize_partnumber


class ArticleMatchesServiceTests(unittest.TestCase):
    def test_normalize_ignores_separators(self):
        self.assertEqual(normalize_partnumber("AB-12 34"), "AB1234")
        self.assertEqual(normalize_partnumber("ab_12/34"), "AB1234")

    def test_short_query_returns_empty(self):
        db = MagicMock()
        result = find_article_matches(
            db,
            organization_id="org1",
            q="A",
            sort="date",
            offset=0,
            limit=20,
        )
        self.assertEqual(result.total, 0)
        self.assertEqual(result.items, [])
        db.query.assert_not_called()


if __name__ == "__main__":
    unittest.main()
