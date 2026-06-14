import unittest

from app.schemas.public_organization import PublicOrganizationBrandSummary, PublicOrganizationCatalogSummary


class PublicOrganizationCatalogSummaryTests(unittest.TestCase):
    def test_catalog_summary_schema(self):
        summary = PublicOrganizationCatalogSummary(
            total_count=4,
            brands=[
                PublicOrganizationBrandSummary(name="BOSCH", slug="bosch", count=3),
                PublicOrganizationBrandSummary(name="MANN", slug="mann", count=1),
            ],
        )
        self.assertEqual(summary.total_count, 4)
        self.assertEqual(len(summary.brands), 2)
        self.assertEqual(summary.brands[0].name, "BOSCH")
