import unittest

from app.services.seo_semantics_service import (
    classify_query_cluster,
    resolve_single_brand_landing_path,
)


class SeoSemanticsServiceTests(unittest.TestCase):
    def test_resolve_single_brand_new(self):
        path = resolve_single_brand_landing_path("new", ["BOSCH"])
        self.assertEqual(path, "/autoparts/new/brand/bosch")

    def test_resolve_single_brand_skips_text_query(self):
        path = resolve_single_brand_landing_path("used", ["BOSCH"], has_text_query=True)
        self.assertIsNone(path)

    def test_classify_cluster_geo(self):
        self.assertEqual(classify_query_cluster("б/у запчасти екатеринбург"), "D")

    def test_classify_cluster_brand(self):
        self.assertEqual(classify_query_cluster("новые запчасти bosch"), "B")

    def test_classify_cluster_category(self):
        self.assertEqual(classify_query_cluster("тормозные колодки купить"), "C")
