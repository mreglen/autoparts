import unittest

from app.services.laximo.vin import looks_like_vin
from app.utils.query_moderation import (
    contains_profanity,
    is_allowed_popular_query,
    query_contains_vin,
)


class QueryModerationTests(unittest.TestCase):
    def test_query_contains_vin_full_string(self):
        self.assertTrue(query_contains_vin("XW8ZZZ7PZDG002696"))
        self.assertTrue(query_contains_vin("WBA3A5C58CF123456"))

    def test_query_contains_vin_token(self):
        self.assertTrue(query_contains_vin("масляный фильтр WBA3A5C58CF123456"))

    def test_query_contains_vin_rejects_articles(self):
        self.assertFalse(query_contains_vin("KRAFT KT 100529"))
        self.assertFalse(query_contains_vin("W712/75"))

    def test_contains_profanity(self):
        self.assertTrue(contains_profanity("хуй"))
        self.assertTrue(contains_profanity("блять фильтр"))
        self.assertTrue(contains_profanity("fuck"))
        self.assertFalse(contains_profanity("масляный фильтр"))
        self.assertFalse(contains_profanity("тормозные колодки"))

    def test_is_allowed_popular_query(self):
        self.assertTrue(is_allowed_popular_query("KRAFT KT 100529"))
        self.assertFalse(is_allowed_popular_query("XW8ZZZ7PZDG002696"))
        self.assertFalse(is_allowed_popular_query("хуй"))
        self.assertFalse(is_allowed_popular_query(""))

    def test_looks_like_vin_still_used_for_full_vin(self):
        self.assertTrue(looks_like_vin("XW8ZZZ7PZDG002696"))


if __name__ == "__main__":
    unittest.main()
