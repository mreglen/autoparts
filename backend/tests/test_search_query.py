import unittest

from app.utils.search_query import parse_brand_article_from_query


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


if __name__ == "__main__":
    unittest.main()
