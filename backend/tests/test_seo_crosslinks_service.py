import unittest
from unittest.mock import MagicMock

from app.models.seo_landing_page import SeoLandingPage
from app.services.seo_crosslinks_service import get_featured_landings, get_landing_crosslinks


class SeoCrosslinksServiceTests(unittest.TestCase):
    def _landing(self, **kwargs):
        defaults = dict(
            kind="brand_new",
            slug="bosch",
            title_ru="BOSCH",
            brand_name="BOSCH",
            is_active=True,
            priority=10,
        )
        defaults.update(kwargs)
        row = MagicMock(spec=SeoLandingPage)
        for key, value in defaults.items():
            setattr(row, key, value)
        return row

    def test_featured_landings_structure(self):
        db = MagicMock()
        db.query.return_value.filter.return_value.order_by.return_value.limit.return_value.all.side_effect = [
            [self._landing(kind="brand_new", slug="bosch")],
            [self._landing(kind="brand_used", slug="bosch", title_ru="BOSCH used")],
            [self._landing(kind="category_new", slug="filters", title_ru="Фильтры")],
            [self._landing(kind="category_used", slug="filters", title_ru="Фильтры used")],
            [self._landing(kind="geo", slug="ekaterinburg", title_ru="Екатеринбург", city="Екатеринбург")],
        ]
        result = get_featured_landings(db, limit=4)
        self.assertIn("brands_new", result)
        self.assertEqual(result["brands_new"][0]["path"], "/autoparts/new/brand/bosch")
        self.assertEqual(result["geo"][0]["path"], "/autoparts/used/geo/ekaterinburg")

    def test_brand_new_crosslinks(self):
        db = MagicMock()
        counterpart = self._landing(kind="brand_used", slug="bosch")
        category = self._landing(kind="category_new", slug="filters", title_ru="Фильтры")

        def query_side_effect(*_args, **_kwargs):
            chain = MagicMock()
            chain.filter.return_value = chain
            chain.order_by.return_value = chain
            chain.limit.return_value = chain
            chain.first.return_value = counterpart
            chain.all.return_value = [category]
            return chain

        db.query.side_effect = query_side_effect
        result = get_landing_crosslinks(db, "brand_new", "bosch", limit=4)
        self.assertEqual(result["kind"], "brand_new")
        self.assertEqual(result["counterpart"]["path"], "/autoparts/used/brand/bosch")
        self.assertEqual(len(result["categories"]), 1)
