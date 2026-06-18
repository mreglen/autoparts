import unittest

from app.services.product_reference_fitment_service import (
    format_fitment_text,
    merge_fitment_vehicles,
    _parse_payload_vehicles,
)


class MergeFitmentTests(unittest.TestCase):
    def test_seller_entries_take_priority_over_duplicates(self):
        seller = [{"brand": "Toyota", "model": "Camry", "generation": "XV70"}]
        reference = [{"brand": "toyota", "model": "camry", "generation": "XV70"}]
        merged = merge_fitment_vehicles(seller, reference)
        self.assertEqual(len(merged), 1)
        self.assertEqual(merged[0]["source"], "seller")

    def test_merges_unique_reference_entries(self):
        seller = [{"brand": "Toyota", "model": "Camry"}]
        reference = [{"brand": "Lexus", "model": "ES"}]
        merged = merge_fitment_vehicles(seller, reference)
        self.assertEqual(len(merged), 2)
        self.assertEqual(merged[0]["source"], "seller")
        self.assertEqual(merged[1]["source"], "reference")

    def test_format_fitment_text(self):
        vehicles = [
            {"brand": "Toyota", "model": "Camry", "generation": "XV70"},
            {"brand": "Lexus", "model": "ES"},
        ]
        text = format_fitment_text(vehicles)
        self.assertIn("Toyota Camry XV70", text)
        self.assertIn("Lexus ES", text)


class ParsePayloadVehiclesTests(unittest.TestCase):
    def test_extracts_nested_vehicle_lists(self):
        payload = {
            "parts": {
                "vehicles": [
                    {"brand": "BMW", "model": "X5", "generation": "F15"},
                    {"manufacturer": "Audi", "model": "A4"},
                ]
            }
        }
        vehicles = _parse_payload_vehicles(payload)
        self.assertEqual(len(vehicles), 2)
        self.assertEqual(vehicles[0].brand, "BMW")
        self.assertEqual(vehicles[1].brand, "Audi")


if __name__ == "__main__":
    unittest.main()
