import unittest

from app.utils.page_keywords import (
    build_brand_used_keywords,
    build_category_used_keywords,
    build_geo_used_keywords,
    build_new_part_card_keywords,
    build_page_keywords,
    build_product_used_keywords,
    MAX_KEYWORDS,
    MAX_PHRASE_LEN,
)


class PageKeywordsTests(unittest.TestCase):
    def test_product_used_contains_brand_and_article(self):
        keywords = build_product_used_keywords(brand="BOSCH", article="0986424590", city="Екатеринбург")
        self.assertIn("bosch 0986424590", keywords.lower())
        self.assertIn("купить", keywords.lower())
        self.assertIn("екатеринбург", keywords.lower())

    def test_new_part_card_keywords(self):
        keywords = build_new_part_card_keywords(brand="MANN", article="W712/75")
        self.assertIn("mann w712/75", keywords.lower())
        self.assertIn("купить с доставкой", keywords.lower())

    def test_brand_used_keywords(self):
        keywords = build_brand_used_keywords(brand_name="BOSCH")
        self.assertIn("б/у запчасти bosch", keywords.lower())
        self.assertIn("bosch автозапчасти", keywords.lower())

    def test_category_used_keywords(self):
        keywords = build_category_used_keywords(
            title_ru="Тормозные колодки",
            search_query="тормозные колодки",
        )
        self.assertIn("б/у тормозные колодки", keywords.lower())
        self.assertIn("купить", keywords.lower())

    def test_geo_used_keywords(self):
        keywords = build_geo_used_keywords(city="Екатеринбург")
        self.assertIn("б/у запчасти екатеринбург", keywords.lower())
        self.assertIn("разборка екатеринбург", keywords.lower())

    def test_deduplication_case_insensitive(self):
        keywords = build_page_keywords(
            "brand_used",
            brand_name="Bosch",
        )
        phrases = [p.strip() for p in keywords.split(",")]
        lowered = [p.casefold() for p in phrases]
        self.assertEqual(len(lowered), len(set(lowered)))

    def test_max_phrase_count(self):
        keywords = build_product_used_keywords(brand="BOSCH", article="A1")
        phrases = [p.strip() for p in keywords.split(",") if p.strip()]
        self.assertLessEqual(len(phrases), MAX_KEYWORDS)

    def test_max_phrase_length(self):
        keywords = build_product_used_keywords(brand="BOSCH", article="A" * 50)
        for phrase in keywords.split(","):
            self.assertLessEqual(len(phrase.strip()), MAX_PHRASE_LEN)

    def test_unknown_page_type_returns_empty(self):
        self.assertEqual(build_page_keywords("unknown_type", brand="X"), "")


if __name__ == "__main__":
    unittest.main()
