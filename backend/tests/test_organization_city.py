import unittest

from app.utils.organization_city import (
    DEFAULT_CITY,
    extract_city_from_address,
    format_city_in_prepositional,
)


class OrganizationCityTests(unittest.TestCase):
    def test_extracts_city_from_g_prefix(self):
        address = "620907, Свердловская область, г. Екатеринбург, ул. Фруктовая, 17"
        self.assertEqual(extract_city_from_address(address), "Екатеринбург")

    def test_extracts_city_after_postal_code(self):
        address = "620000, Екатеринбург, ул. Ленина, 1"
        self.assertEqual(extract_city_from_address(address), "Екатеринбург")

    def test_fallback_when_address_missing(self):
        self.assertEqual(extract_city_from_address(None), DEFAULT_CITY)
        self.assertEqual(extract_city_from_address(""), DEFAULT_CITY)

    def test_format_city_in_prepositional(self):
        self.assertEqual(format_city_in_prepositional("Екатеринбург"), "Екатеринбурге")
        self.assertEqual(format_city_in_prepositional("Москва"), "Москве")


if __name__ == "__main__":
    unittest.main()
