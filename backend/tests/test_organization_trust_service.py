import unittest
from unittest.mock import MagicMock, patch

from app.services.organization_trust_service import get_organization_trust_stats


class OrganizationTrustServiceTests(unittest.TestCase):
    def _make_org(self, *, phone="+79990000000", description="Описание продавца"):
        org = MagicMock()
        org.id = "ORG001"
        org.phone = phone
        org.description = description
        return org

    @patch("app.services.organization_trust_service._average_response_minutes", return_value=45)
    @patch("app.services.organization_trust_service._count_standalone_warehouse_sales", return_value=0)
    @patch("app.services.organization_trust_service._count_completed_new_orders", return_value=0)
    @patch("app.services.organization_trust_service._count_completed_used_orders", return_value=2)
    @patch("app.services.organization_trust_service._count_catalog_products", return_value=5)
    def test_verified_seller_when_profile_sales_and_catalog(
        self,
        _catalog,
        _used,
        _new,
        _warehouse,
        _response,
    ):
        db = MagicMock()
        db.query.return_value.filter.return_value.first.return_value = self._make_org()

        stats = get_organization_trust_stats(db, "ORG001")
        self.assertIsNotNone(stats)
        self.assertEqual(stats.completed_sales_count, 2)
        self.assertTrue(stats.profile_complete)
        self.assertTrue(stats.has_moderated_products)
        self.assertTrue(stats.is_verified_seller)
        self.assertEqual(stats.avg_response_minutes, 45)

    @patch("app.services.organization_trust_service._average_response_minutes", return_value=None)
    @patch("app.services.organization_trust_service._count_standalone_warehouse_sales", return_value=0)
    @patch("app.services.organization_trust_service._count_completed_new_orders", return_value=0)
    @patch("app.services.organization_trust_service._count_completed_used_orders", return_value=0)
    @patch("app.services.organization_trust_service._count_catalog_products", return_value=3)
    def test_not_verified_without_sales(self, _catalog, _used, _new, _warehouse, _response):
        db = MagicMock()
        db.query.return_value.filter.return_value.first.return_value = self._make_org()

        stats = get_organization_trust_stats(db, "ORG001")
        self.assertFalse(stats.is_verified_seller)

    def test_missing_org_returns_none(self):
        db = MagicMock()
        db.query.return_value.filter.return_value.first.return_value = None
        self.assertIsNone(get_organization_trust_stats(db, "MISSING"))


if __name__ == "__main__":
    unittest.main()
