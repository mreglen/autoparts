import unittest

from app.utils.slug_utils import is_valid_slug, slugify, slugify_brand, transliterate_ru


class SlugUtilsTests(unittest.TestCase):
    def test_transliterate_ru_cyrillic(self):
        self.assertEqual(transliterate_ru("Тормозные"), "Tormoznye")

    def test_transliterate_ru_yo(self):
        self.assertEqual(transliterate_ru("ёлка"), "yolka")

    def test_slugify_cyrillic_phrase(self):
        self.assertEqual(slugify("Тормозные колодки"), "tormoznye-kolodki")

    def test_slugify_latin_brand(self):
        self.assertEqual(slugify("BOSCH"), "bosch")

    def test_slugify_brand_with_hyphen(self):
        self.assertEqual(slugify_brand("MANN-FILTER"), "mann-filter")

    def test_slugify_spaces_and_underscores(self):
        self.assertEqual(slugify("масляный_фильтр"), "maslyanyy-filtr")

    def test_slugify_special_chars(self):
        self.assertEqual(slugify("BOSCH (оригинал)"), "bosch-original")

    def test_slugify_empty(self):
        self.assertEqual(slugify(""), "")
        self.assertEqual(slugify("   "), "")

    def test_slugify_collapses_hyphens(self):
        self.assertEqual(slugify("a--b   c"), "a-b-c")

    def test_is_valid_slug(self):
        self.assertTrue(is_valid_slug("tormoznye-kolodki"))
        self.assertTrue(is_valid_slug("bosch"))
        self.assertTrue(is_valid_slug("mann-filter"))
        self.assertFalse(is_valid_slug(""))
        self.assertFalse(is_valid_slug("Tormoznye"))
        self.assertFalse(is_valid_slug("a--b"))


if __name__ == "__main__":
    unittest.main()
