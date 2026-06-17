import unittest

from app.schemas.storage_cell import ProductStorageCellsByProductsRequest
from pydantic import ValidationError


class TestProductStorageCellsByProductsRequest(unittest.TestCase):
    def test_accepts_up_to_200_ids(self):
        payload = ProductStorageCellsByProductsRequest(product_ids=list(range(1, 201)))
        self.assertEqual(len(payload.product_ids), 200)

    def test_rejects_empty_list(self):
        with self.assertRaises(ValidationError):
            ProductStorageCellsByProductsRequest(product_ids=[])

    def test_rejects_more_than_200_ids(self):
        with self.assertRaises(ValidationError):
            ProductStorageCellsByProductsRequest(product_ids=list(range(1, 202)))


if __name__ == "__main__":
    unittest.main()
