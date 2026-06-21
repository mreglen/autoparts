import unittest

from app.utils.search_query import (
    parse_brand_article_from_query,
    parse_search_query,
    tokenize_search_query,
)


class ParseBrandArticleFromQueryTests(unittest.TestCase):
    def test_brand_and_article_with_spaces_in_article(self):
        self.assertEqual(
            parse_brand_article_from_query("BOSCH 0 451 103 073"),
            ("BOSCH", "0 451 103 073"),
        )

    def test_brand_with_hyphen(self):
        self.assertEqual(
            parse_brand_article_from_query("MANN-FILTER IF1009"),
            ("MANN-FILTER", "IF1009"),
        )

    def test_brand_with_slash(self):
        self.assertEqual(
            parse_brand_article_from_query("Hyundai/Kia 21020-26425"),
            ("Hyundai/Kia", "21020-26425"),
        )

    def test_single_token_returns_none(self):
        self.assertIsNone(parse_brand_article_from_query("BOSCH"))
        self.assertIsNone(parse_brand_article_from_query("0451103073"))

    def test_empty_returns_none(self):
        self.assertIsNone(parse_brand_article_from_query(""))
        self.assertIsNone(parse_brand_article_from_query("   "))


class ParseSearchQueryTests(unittest.TestCase):
    def test_tokenize_splits_commas(self):
        self.assertEqual(tokenize_search_query("BOSCH, 0451103073"), ["BOSCH", "0451103073"])

    def test_article_before_brand_pair(self):
        parsed = parse_search_query("0451103073 BOSCH")
        self.assertIn(("0451103073", "BOSCH"), parsed.brand_article_pairs)
        self.assertIn(("BOSCH", "0451103073"), parsed.brand_article_pairs)

    def test_name_and_brand_tokens(self):
        parsed = parse_search_query("фильтр масляный MANN")
        self.assertIn("MANN", parsed.brand_tokens)
        self.assertTrue(parsed.name_tokens)

    def test_name_and_article_tokens(self):
        parsed = parse_search_query("фильтр 0451103073")
        self.assertTrue(parsed.name_tokens)
        self.assertTrue(parsed.article_tokens)

    def test_single_article_token(self):
        parsed = parse_search_query("0451103073")
        self.assertEqual(parsed.article_tokens, ("0451103073",))
        self.assertEqual(parsed.normalized_full, "0451103073")


if __name__ == "__main__":
    unittest.main()
