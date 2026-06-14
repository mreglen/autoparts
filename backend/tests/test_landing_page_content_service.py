import unittest

from app.schemas.seo_landing_page import SeoLandingResolveOut
from app.services.landing_page_content_service import (
    build_landing_content,
    landing_content_word_count,
)


class LandingPageContentServiceTests(unittest.TestCase):
    def _landing(self, **kwargs):
        defaults = dict(
            kind="brand_new",
            slug="bosch",
            title_ru="BOSCH",
            search_query=None,
            brand_name="BOSCH",
            part_type_id=None,
            city=None,
            meta_title="Новые запчасти BOSCH | Свой Гараж",
            meta_description="Купить новые BOSCH",
            intro_html=None,
            filters={"brand": "BOSCH"},
            canonical_path="/autoparts/new/brand/bosch",
        )
        defaults.update(kwargs)
        return SeoLandingResolveOut(**defaults)

    def test_auto_content_word_count_at_least_300(self):
        landing = self._landing()
        content = build_landing_content(
            landing,
            kind="brand_new",
            total_count=120,
            top_items=[],
            is_new=True,
        )
        self.assertGreaterEqual(landing_content_word_count(content), 300)
        self.assertGreaterEqual(len(content.faq_items), 3)

    def test_intro_html_overrides_about(self):
        landing = self._landing(intro_html="<p>Кастомный текст о BOSCH для SEO.</p>")
        content = build_landing_content(
            landing,
            kind="brand_new",
            total_count=50,
            top_items=[],
            is_new=True,
        )
        self.assertIn("Кастомный текст", content.about_html)
        self.assertTrue(content.order_delivery_html)
        self.assertGreaterEqual(len(content.faq_items), 3)

    def test_faq_json_ld_present(self):
        landing = self._landing(kind="category_used", slug="filters", title_ru="Фильтры")
        content = build_landing_content(
            landing,
            kind="category_used",
            total_count=10,
            top_items=[],
            is_new=False,
        )
        self.assertIn("FAQPage", content.faq_json_ld)
