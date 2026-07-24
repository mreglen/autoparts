import unittest
from unittest.mock import MagicMock, patch

from app.services.seo_query_export import (
    PRIMARY_CITY,
    ProductSeed,
    WEIGHTED_CITIES,
    build_seo_queries_list,
    clean_query_display,
    generate_from_products,
    generate_queries_for_product,
    normalize_query_key,
)


class NormalizeTests(unittest.TestCase):
    def test_normalize_and_clean(self):
        self.assertEqual(normalize_query_key("  Купить   Фару  "), "купить фару")
        self.assertEqual(clean_query_display("  Купить   Фару  "), "Купить Фару")


class GenerateProductQueriesTests(unittest.TestCase):
    def test_templates_include_name_brand_article(self):
        seed = ProductSeed(name="Фара левая", brand="Bosch", article="1 987 302")
        queries = generate_queries_for_product(seed, start_index=0)
        joined = "\n".join(queries)
        self.assertTrue(any("купить Фара левая в" in q for q in queries))
        self.assertIn("Bosch 1 987 302 купить", joined)
        self.assertTrue(any(PRIMARY_CITY in q for q in queries))

    def test_dedupe_within_product(self):
        seed = ProductSeed(name="Бампер", brand=None, article=None)
        queries = generate_queries_for_product(seed)
        keys = [normalize_query_key(q) for q in queries]
        self.assertEqual(len(keys), len(set(keys)))

    def test_ekaterinburg_predominates_in_weighted_cities(self):
        ekb = sum(1 for c in WEIGHTED_CITIES if c == PRIMARY_CITY)
        self.assertGreaterEqual(ekb / len(WEIGHTED_CITIES), 0.55)

    def test_generate_from_products_respects_need_and_exclude(self):
        seeds = [
            ProductSeed(name=f"Деталь {i}", brand="ACME", article=f"A{i}")
            for i in range(40)
        ]
        out = generate_from_products(seeds, need=500)
        self.assertEqual(len(out), 500)
        keys = [normalize_query_key(q) for q in out]
        self.assertEqual(len(keys), len(set(keys)))

        excluded = {normalize_query_key(out[0])}
        out2 = generate_from_products(seeds, need=10, exclude=excluded)
        self.assertTrue(all(normalize_query_key(q) not in excluded for q in out2))

    def test_ekaterinburg_share_in_generated_geo_queries(self):
        seeds = [
            ProductSeed(name=f"Запчасть {i}", brand="Brand", article=str(1000 + i))
            for i in range(50)
        ]
        out = generate_from_products(seeds, need=400)
        geo = [q for q in out if any(c in q for c in WEIGHTED_CITIES)]
        self.assertGreater(len(geo), 50)
        ekb = sum(1 for q in geo if PRIMARY_CITY in q)
        self.assertGreaterEqual(ekb / len(geo), 0.45)


class BuildListTests(unittest.TestCase):
    def test_cap_and_real_first(self):
        real = ["фара toyota", "бампер"]
        seeds = [ProductSeed(name="Капот", brand="VW", article="5C0")]

        with patch(
            "app.services.seo_query_export.collect_real_queries",
            return_value=real,
        ), patch(
            "app.services.seo_query_export.product_seeds_from_cards",
            return_value=seeds * 30,
        ):
            result = build_seo_queries_list(MagicMock(), limit=500)

        self.assertEqual(result[0], "фара toyota")
        self.assertEqual(result[1], "бампер")
        self.assertLessEqual(len(result), 500)
        self.assertEqual(len(result), len({normalize_query_key(q) for q in result}))


if __name__ == "__main__":
    unittest.main()
