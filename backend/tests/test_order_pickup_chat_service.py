import unittest
from unittest.mock import MagicMock, patch

from app.services.order_pickup_chat_service import (
    build_order_ready_pickup_chat_message,
    maybe_send_order_ready_pickup_chat_message,
    PICKUP_READY_STATUSES,
)
from app.services.pickup_verification_service import NEW_PICKUP_READY_STATUS, PICKUP_READY_STATUS


class OrderPickupChatServiceTests(unittest.TestCase):
    def test_build_message_used_with_code(self):
        text = build_order_ready_pickup_chat_message(
            order_id=42,
            order_kind="used",
            pickup_code="123456",
        )
        self.assertIn("№42", text)
        self.assertIn("б/у", text)
        self.assertIn("123456", text)

    def test_build_message_new_without_code(self):
        text = build_order_ready_pickup_chat_message(
            order_id=7,
            order_kind="new",
            pickup_code=None,
        )
        self.assertIn("новых запчастей", text)
        self.assertIn("№7", text)
        self.assertNotIn("Код", text)

    def test_skips_non_ready_status(self):
        db = MagicMock()
        maybe_send_order_ready_pickup_chat_message(
            db,
            buyer_user_id=1,
            seller_user_id=2,
            order_id=10,
            order_kind="used",
            pickup_code="111111",
            previous_status_code="assembled",
            new_status_code="confirmed",
        )
        db.query.assert_not_called()

    def test_skips_same_status(self):
        db = MagicMock()
        maybe_send_order_ready_pickup_chat_message(
            db,
            buyer_user_id=1,
            seller_user_id=2,
            order_id=10,
            order_kind="used",
            pickup_code="111111",
            previous_status_code=PICKUP_READY_STATUS,
            new_status_code=PICKUP_READY_STATUS,
        )
        db.query.assert_not_called()

    @patch("app.services.order_pickup_chat_service.send_chat_message_as_seller")
    @patch("app.services.order_pickup_chat_service.get_or_create_direct_garage_chat")
    def test_sends_on_ready_status(self, mock_get_chat, mock_send):
        db = MagicMock()
        chat = MagicMock()
        chat.id = 99
        mock_get_chat.return_value = chat

        maybe_send_order_ready_pickup_chat_message(
            db,
            buyer_user_id=5,
            seller_user_id=2,
            order_id=10,
            order_kind="new",
            pickup_code="654321",
            previous_status_code="new_shipped",
            new_status_code=NEW_PICKUP_READY_STATUS,
        )

        mock_get_chat.assert_called_once_with(db, buyer_id=5, seller_id=2)
        mock_send.assert_called_once()
        self.assertIn("654321", mock_send.call_args.kwargs["text"])

    def test_pickup_ready_statuses(self):
        self.assertEqual(PICKUP_READY_STATUSES, {PICKUP_READY_STATUS, NEW_PICKUP_READY_STATUS})


if __name__ == "__main__":
    unittest.main()
