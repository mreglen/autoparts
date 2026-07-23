import unittest

from app.services.photo_localization import (
    _is_avito_like_url,
    _normalize_org_ids,
)


class PhotoLocalizationHelpersTests(unittest.TestCase):
    def test_is_avito_like_url(self):
        self.assertTrue(_is_avito_like_url("https://40.img.avito.st/image/1/1.abc"))
        self.assertTrue(_is_avito_like_url("https://www.avito.ru/item/1"))
        self.assertFalse(_is_avito_like_url("https://svoygarage.ru/pictures/x.webp"))
        self.assertFalse(_is_avito_like_url("/pictures/x.webp"))

    def test_normalize_org_ids_merges_unique(self):
        self.assertEqual(
            _normalize_org_ids(org_id="a", org_ids=["b", "a", " ", "c"]),
            ["b", "a", "c"],
        )
        self.assertIsNone(_normalize_org_ids())
        self.assertEqual(_normalize_org_ids(org_id=" only "), ["only"])


if __name__ == "__main__":
    unittest.main()
