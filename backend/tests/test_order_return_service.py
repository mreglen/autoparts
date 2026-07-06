import unittest
from datetime import datetime, timedelta, timezone
from unittest.mock import MagicMock, patch

from fastapi import HTTPException

from app.schemas.order_returns import OrderReturnCreate, OrderReturnStatusUpdate
from app.services import order_return_service as svc


class OrderReturnServiceTests(unittest.TestCase):
    def _buyer(self):
        user = MagicMock()
        user.id = 10
        user.email = "buyer@test.ru"
        user.phone = "+79990001122"
        return user

    def _order(self, *, status="delivered", updated_days_ago=1, with_product=True):
        order = MagicMock()
        order.id = 100
        order.organization_id = "org1"
        order.user_id = 10
        order.status_code = status
        order.updated_at = datetime.now(timezone.utc) - timedelta(days=updated_days_ago)
        order.created_at = order.updated_at
        item = MagicMock()
        item.product_id = 5 if with_product else None
        order.items = [item] if with_product else []
        return order

    @patch.object(svc, "_get_active_return", return_value=None)
    @patch.object(svc, "_load_order_for_buyer")
    def test_create_return_rejects_pending_order(self, mock_load, _active):
        mock_load.side_effect = HTTPException(status_code=400, detail="Возврат доступен только для завершённых заказов")
        with self.assertRaises(HTTPException):
            svc.create_return_request(
                MagicMock(),
                self._buyer(),
                OrderReturnCreate(order_id=100, reason="defect"),
            )

    @patch.object(svc, "_get_active_return", return_value=None)
    @patch.object(svc, "_load_order_for_buyer")
    def test_create_return_rejects_expired_window(self, mock_load, _active):
        mock_load.return_value = self._order(updated_days_ago=svc.RETURN_WINDOW_DAYS + 1)
        with self.assertRaises(HTTPException) as ctx:
            svc.create_return_request(
                MagicMock(),
                self._buyer(),
                OrderReturnCreate(order_id=100, reason="defect"),
            )
        self.assertIn("Срок возврата", ctx.exception.detail)

    @patch.object(svc, "get_return_for_seller")
    def test_update_status_valid_transition(self, mock_get):
        row = MagicMock()
        row.id = 1
        row.organization_id = "org1"
        row.order_id = 100
        row.buyer_user_id = 10
        row.status_code = "requested"
        mock_get.return_value = row

        db = MagicMock()
        seller = MagicMock()
        seller.is_admin = True
        seller.organization_id = "org1"

        result = svc.update_return_status(
            db,
            seller,
            1,
            OrderReturnStatusUpdate(status_code="reviewing"),
        )
        self.assertEqual(result.status_code, "reviewing")

    @patch.object(svc, "get_return_for_seller")
    def test_update_status_rejects_invalid_transition(self, mock_get):
        row = MagicMock()
        row.status_code = "requested"
        mock_get.return_value = row

        with self.assertRaises(HTTPException) as ctx:
            svc.update_return_status(
                MagicMock(),
                MagicMock(is_admin=True),
                1,
                OrderReturnStatusUpdate(status_code="closed"),
            )
        self.assertEqual(ctx.exception.status_code, 400)


if __name__ == "__main__":
    unittest.main()
