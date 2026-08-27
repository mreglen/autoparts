"""Этап 9: списки заказов новых запчастей — enrichment, buyer-safe API, seller Rossko fields."""
from __future__ import annotations

import unittest
from datetime import datetime, timezone
from types import SimpleNamespace
from unittest.mock import MagicMock, patch

from app.services.new_parts_order_enrichment import (
    build_buyer_new_parts_order_response,
    build_seller_new_parts_order_response,
    fetch_rossko_snapshots_for_orders,
    persist_rossko_supplier_statuses,
)
from app.services.rossko_get_orders_service import RosskoOrderLine, RosskoOrderSnapshot


def _noop_seo(_db, _item):
    return None


def _sample_order(*, rossko_order_id: str | None = "12345"):
    item = SimpleNamespace(
        id=1,
        name="Фильтр масляный",
        brand="MANN",
        partnumber="W712/75",
        quantity=2,
        price=450.0,
        supplier_unit_price=420.0,
        status_code="new_waiting_confirmation",
    )
    return SimpleNamespace(
        id=10,
        organization_id="ORG001",
        user_id=5,
        buyer_name="Иван Иванов",
        buyer_phone="+79001234567",
        buyer_email="buyer@example.com",
        delivery_type="transport",
        delivery_address="г. Москва",
        transport_company="СДЭК",
        pickup_address=None,
        delivery_region_id=None,
        delivery_region_name=None,
        total_amount=900.0,
        is_paid=True,
        status_code="new_waiting_confirmation",
        seller="Магазин",
        deliver_in_parts=False,
        rossko_order_id=rossko_order_id,
        created_at=datetime(2026, 1, 15, 12, 0, tzinfo=timezone.utc),
        items=[item],
    )


def _sample_snapshot():
    return RosskoOrderSnapshot(
        order_id="12345",
        status="2",
        lines=[
            RosskoOrderLine(
                name="Фильтр масляный",
                brand="MANN",
                partnumber="W712/75",
                quantity=2,
                price=450.0,
                status_code="2",
            )
        ],
    )


class NewPartsOrderEnrichmentTests(unittest.TestCase):
    def setUp(self):
        self.db = MagicMock()

    def test_buyer_response_has_no_rossko_fields(self):
        order = _sample_order()
        snapshot = _sample_snapshot()
        response = build_buyer_new_parts_order_response(
            self.db,
            order,
            rossko_by_id={"12345": snapshot},
            organization_name="Тестовый магазин",
            resolve_seo_card_id=_noop_seo,
        )
        payload = response.model_dump()
        serialized = str(payload).lower()
        self.assertNotIn("rossko", serialized)
        for item in payload["items"]:
            self.assertNotIn("rossko_status", item)

    def test_buyer_item_status_mapped_from_supplier_snapshot(self):
        order = _sample_order()
        snapshot = _sample_snapshot()
        response = build_buyer_new_parts_order_response(
            self.db,
            order,
            rossko_by_id={"12345": snapshot},
            resolve_seo_card_id=_noop_seo,
        )
        self.assertEqual(response.items[0].status_code, "new_shipped")
        self.assertEqual(response.status_code, "new_shipped")

    def test_seller_response_includes_rossko_metadata(self):
        order = _sample_order()
        snapshot = _sample_snapshot()
        response = build_seller_new_parts_order_response(
            self.db,
            order,
            rossko_by_id={"12345": snapshot},
            resolve_seo_card_id=_noop_seo,
        )
        self.assertEqual(response.rossko_order_id, "12345")
        self.assertIsNotNone(response.rossko_status)
        self.assertIsNone(response.rossko_sync_error)
        self.assertIsNotNone(response.items[0].rossko_status)

    def test_seller_response_includes_sync_error_on_api_failure(self):
        order = _sample_order()
        response = build_seller_new_parts_order_response(
            self.db,
            order,
            rossko_by_id={},
            rossko_sync_error="SOAP timeout",
            resolve_seo_card_id=_noop_seo,
        )
        self.assertEqual(response.rossko_sync_error, "SOAP timeout")
        self.assertEqual(response.items[0].status_code, "new_waiting_confirmation")

    def test_seller_item_status_mapped_from_supplier_snapshot(self):
        order = _sample_order()
        snapshot = _sample_snapshot()
        response = build_seller_new_parts_order_response(
            self.db,
            order,
            rossko_by_id={"12345": snapshot},
            resolve_seo_card_id=_noop_seo,
        )
        self.assertEqual(response.items[0].status_code, "new_shipped")
        self.assertEqual(response.status_code, "new_shipped")

    def test_seller_does_not_override_ready_for_pickup(self):
        order = _sample_order()
        order.status_code = "new_ready_for_pickup"
        order.items[0].status_code = "new_ready_for_pickup"
        snapshot = _sample_snapshot()
        response = build_seller_new_parts_order_response(
            self.db,
            order,
            rossko_by_id={"12345": snapshot},
            resolve_seo_card_id=_noop_seo,
        )
        self.assertEqual(response.status_code, "new_ready_for_pickup")
        self.assertEqual(response.items[0].status_code, "new_ready_for_pickup")

    def test_seller_rossko_warehouse_maps_to_awaiting_not_received(self):
        order = _sample_order()
        snapshot = RosskoOrderSnapshot(
            order_id="12345",
            status="6",
            lines=[
                RosskoOrderLine(
                    name="Фильтр масляный",
                    brand="MANN",
                    partnumber="W712/75",
                    quantity=2,
                    price=450.0,
                    status_code="6",
                )
            ],
        )
        seller = build_seller_new_parts_order_response(
            self.db,
            order,
            rossko_by_id={"12345": snapshot},
            resolve_seo_card_id=_noop_seo,
        )
        self.assertEqual(seller.items[0].status_code, "new_awaiting_arrival")
        self.assertEqual(seller.status_code, "new_awaiting_arrival")

        buyer = build_buyer_new_parts_order_response(
            self.db,
            order,
            rossko_by_id={"12345": snapshot},
            resolve_seo_card_id=_noop_seo,
        )
        self.assertEqual(buyer.items[0].status_code, "new_received")

    def test_persist_rossko_statuses_updates_db_fields(self):
        order = _sample_order()
        snapshot = _sample_snapshot()
        changed = persist_rossko_supplier_statuses(
            [order],
            {"12345": snapshot},
            None,
        )
        self.assertTrue(changed)
        self.assertEqual(order.status_code, "new_shipped")
        self.assertEqual(order.items[0].status_code, "new_shipped")
        self.assertEqual(order.items[0].supplier_unit_price, 450.0)

    def test_persist_does_not_backfill_supplier_price_without_snapshot(self):
        order = _sample_order()
        order.items[0].supplier_unit_price = None
        snapshot = _sample_snapshot()
        persist_rossko_supplier_statuses([order], {"12345": snapshot}, None)
        self.assertIsNone(order.items[0].supplier_unit_price)

    def test_persist_skips_on_sync_error(self):
        order = _sample_order()
        snapshot = _sample_snapshot()
        changed = persist_rossko_supplier_statuses(
            [order],
            {"12345": snapshot},
            "SOAP timeout",
        )
        self.assertFalse(changed)
        self.assertEqual(order.status_code, "new_waiting_confirmation")
        self.assertEqual(order.items[0].status_code, "new_waiting_confirmation")

    def test_pending_rossko_sync_skips_ready_for_pickup(self):
        from app.services.new_parts_order_enrichment import orders_pending_rossko_sync

        waiting = _sample_order()
        ready = _sample_order()
        ready.status_code = "new_ready_for_pickup"
        pending = orders_pending_rossko_sync([waiting, ready])
        self.assertEqual(pending, [waiting])

    def test_buyer_response_falls_back_to_db_on_api_failure(self):
        order = _sample_order()
        response = build_buyer_new_parts_order_response(
            self.db,
            order,
            rossko_by_id={},
            rossko_sync_error="SOAP timeout",
            resolve_seo_card_id=_noop_seo,
        )
        payload = response.model_dump()
        self.assertNotIn("rossko", str(payload).lower())
        self.assertEqual(response.status_code, "new_waiting_confirmation")
        self.assertEqual(response.items[0].status_code, "new_waiting_confirmation")

    @patch("app.services.new_parts_order_enrichment.fetch_orders_by_ids_safe")
    def test_fetch_rossko_snapshots_propagates_safe_error(self, mock_fetch):
        order = _sample_order()
        mock_fetch.return_value = ({}, "network error")
        snapshots, err = fetch_rossko_snapshots_for_orders([order])
        self.assertEqual(snapshots, {})
        self.assertEqual(err, "network error")
        mock_fetch.assert_called_once_with([12345])


class NewPartsCheckoutConfigImportTests(unittest.TestCase):
    @patch("app.routers.orders_new_parts.get_rossko_settings")
    def test_config_endpoint_calls_get_rossko_settings(self, mock_get_settings):
        from app.routers.orders_new_parts import get_new_parts_checkout_config

        mock_row = SimpleNamespace(
            delivery_id="000000001",
            address_id="176458",
            payment_id=1,
            requisite_id=None,
            contact_name="Test",
            contact_phone="+7900",
            default_comment=None,
            delivery_parts=False,
            delivery_name="Курьер",
            address_label="Склад",
            payment_name="Картой",
            requisite_name=None,
            is_pickup=False,
            requires_address=True,
            requires_requisite=False,
            updated_at=datetime(2026, 1, 1, tzinfo=timezone.utc),
        )
        mock_get_settings.return_value = mock_row
        db = MagicMock()
        user = MagicMock()

        result = get_new_parts_checkout_config(db=db, current_user=user)

        mock_get_settings.assert_called_once_with(db)
        self.assertTrue(result.configured is False or result.configured is True)


if __name__ == "__main__":
    unittest.main()
