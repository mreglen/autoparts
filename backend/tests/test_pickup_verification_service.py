"""Unit tests for pickup verification service."""
from __future__ import annotations

import unittest
from types import SimpleNamespace
from unittest.mock import patch

from fastapi import HTTPException

from app.services.pickup_verification_service import (
    PICKUP_READY_STATUS,
    block_direct_pickup_delivery,
    build_qr_payload,
    ensure_pickup_code,
    get_buyer_pickup_payload,
    hash_pickup_code,
    parse_qr_payload,
    verify_pickup_code,
)


class PickupVerificationTests(unittest.TestCase):
    def setUp(self):
        self.settings_patch = patch(
            "app.services.pickup_verification_service.settings.SECRET_KEY",
            "test-secret-key-for-pickup",
        )
        self.settings_patch.start()

    def tearDown(self):
        self.settings_patch.stop()

    def test_hash_and_qr_roundtrip(self):
        code = "482916"
        self.assertEqual(len(hash_pickup_code(code)), 64)
        payload = build_qr_payload(order_id=7, code=code, order_kind="used")
        parsed = parse_qr_payload(payload)
        self.assertEqual(parsed["o"], 7)
        self.assertEqual(parsed["c"], code)

    def test_ensure_and_verify(self):
        order = SimpleNamespace(
            id=42,
            delivery_type="pickup",
            status_code=PICKUP_READY_STATUS,
            pickup_code_hash=None,
            pickup_code_cipher=None,
            pickup_code_created_at=None,
            pickup_code_expires_at=None,
            pickup_verified_at=None,
            pickup_verify_attempts=0,
        )
        code = ensure_pickup_code(order, order_kind="used")
        self.assertEqual(len(code), 6)
        order.status_code = PICKUP_READY_STATUS
        delivered = verify_pickup_code(order, code=code, order_kind="used")
        self.assertEqual(delivered, "delivered")
        self.assertIsNotNone(order.pickup_verified_at)

    def test_block_direct_delivery_for_pickup(self):
        order = SimpleNamespace(delivery_type="pickup")
        with self.assertRaises(HTTPException):
            block_direct_pickup_delivery(order, new_status="delivered", order_kind="used")

    def test_buyer_payload_only_when_ready(self):
        order = SimpleNamespace(
            id=1,
            status_code="assembled",
            pickup_code_cipher=None,
            pickup_verified_at=None,
            pickup_code_expires_at=None,
        )
        payload = get_buyer_pickup_payload(order, order_kind="used")
        self.assertIsNone(payload["pickup_code"])


if __name__ == "__main__":
    unittest.main()
