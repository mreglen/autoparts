import unittest
from unittest.mock import MagicMock, patch

from app.models.organization import Organization
from app.utils.org_access import resolve_autoservice_organization_id
from app.utils.org_markup import (
    autoservice_markup_percent,
    buyer_markup_percent,
    global_markup_percent,
    effective_markup_percent,
)


class ResolveAutoserviceOrganizationTests(unittest.TestCase):
    def test_returns_first_org_with_autoservice_flag(self):
        db = MagicMock()
        db.query.return_value.filter.return_value.order_by.return_value.first.return_value = (
            "ORG-AUTO",
        )

        result = resolve_autoservice_organization_id(db)

        self.assertEqual(result, "ORG-AUTO")
        db.query.assert_called_once_with(Organization.id)

    def test_returns_none_when_no_autoservice_org(self):
        db = MagicMock()
        db.query.return_value.filter.return_value.order_by.return_value.first.return_value = None

        result = resolve_autoservice_organization_id(db)

        self.assertIsNone(result)


class PublicSiteConfigMarkupTests(unittest.TestCase):
    def test_public_config_returns_buyer_and_autoservice_markups(self):
        from app.routers.auth import get_public_site_config

        db = MagicMock()
        settings_row = MagicMock()
        settings_row.show_new_autoparts = True
        settings_row.show_site_reviews = True
        settings_row.show_yandex_badge = True
        settings_row.show_warehouse_inventory = False
        settings_row.show_autoservice = True
        settings_row.used_parts_purchase_mode = "both"
        settings_row.round_product_prices = False
        settings_row.buyer_new_parts_markup_percent = 30.0
        settings_row.new_parts_markup_percent = 15.0
        settings_row.autoservice_new_parts_markup_percent = 7.0

        with patch(
            "app.routers.auth.get_or_create_site_settings",
            return_value=settings_row,
        ), patch(
            "app.routers.auth.resolve_autoservice_organization_id",
            return_value="ORG-AUTO",
        ), patch(
            "app.routers.auth.laximo_cat_ready",
            return_value=False,
        ):
            db.query.return_value.filter.return_value.first.return_value = None
            cfg = get_public_site_config(organization_id="seller-org", db=db)

        self.assertEqual(cfg["new_parts_markup_percent"], 30.0)
        self.assertEqual(cfg["autoservice_markup_percent"], 7.0)
        self.assertEqual(cfg["autoservice_organization_id"], "ORG-AUTO")


class OrgMarkupHelperTests(unittest.TestCase):
    def test_markup_helpers_use_defaults_when_missing(self):
        row = MagicMock()
        row.buyer_new_parts_markup_percent = None
        row.new_parts_markup_percent = None
        row.autoservice_new_parts_markup_percent = None

        self.assertEqual(buyer_markup_percent(None), 30.0)
        self.assertEqual(global_markup_percent(None), 15.0)
        self.assertEqual(autoservice_markup_percent(None), 7.0)
        self.assertEqual(buyer_markup_percent(row), 30.0)
        self.assertEqual(global_markup_percent(row), 15.0)
        self.assertEqual(autoservice_markup_percent(row), 7.0)

    def test_markup_helpers_read_site_settings_values(self):
        row = MagicMock()
        row.buyer_new_parts_markup_percent = 28.5
        row.new_parts_markup_percent = 12.0
        row.autoservice_new_parts_markup_percent = 6.0

        self.assertEqual(buyer_markup_percent(row), 28.5)
        self.assertEqual(global_markup_percent(row), 12.0)
        self.assertEqual(autoservice_markup_percent(row), 6.0)

    def test_effective_markup_for_autoservice_org_is_always_autoservice(self):
        org = MagicMock()
        org.is_autoservice = True
        # manual override should not affect autoservice connected pricing
        org.new_parts_markup_manual = True
        org.new_parts_markup_percent = 99.0

        settings_row = MagicMock()
        settings_row.autoservice_new_parts_markup_percent = 7.0

        self.assertEqual(effective_markup_percent(org, settings_row), 7.0)


if __name__ == "__main__":
    unittest.main()
