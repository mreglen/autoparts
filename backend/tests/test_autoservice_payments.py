import unittest
from datetime import date, datetime
from decimal import Decimal
from unittest.mock import MagicMock, patch

import app.models  # noqa: F401
import app.models.autoservice_client  # noqa: F401
import app.models.autoservice_payment  # noqa: F401
import app.models.repair_order  # noqa: F401
from fastapi import HTTPException

from app.services.autoservice_payment_service import (
    batch_paid_amounts,
    create_repair_order_payment,
    delete_autoservice_payment,
    ensure_order_fully_paid,
    list_finance_receipts,
    order_payment_summary,
    update_autoservice_payment_date,
)


class AutoservicePaymentServiceTests(unittest.TestCase):
    def _order(self, order_id: int = 1):
        client = MagicMock(name="Client")
        client.name = "Ivan Petrov"
        order = MagicMock(name="RepairOrder")
        order.id = order_id
        order.order_number = "1001"
        order.client = client
        return order

    def test_order_payment_summary_unpaid(self):
        db = MagicMock()
        with patch(
            "app.services.autoservice_payment_service.sum_order_payments",
            return_value=Decimal("0.00"),
        ):
            paid, remaining, is_paid = order_payment_summary(db, self._order(), Decimal("1500.00"))
        self.assertEqual(paid, Decimal("0.00"))
        self.assertEqual(remaining, Decimal("1500.00"))
        self.assertFalse(is_paid)

    def test_order_payment_summary_paid(self):
        db = MagicMock()
        with patch(
            "app.services.autoservice_payment_service.sum_order_payments",
            return_value=Decimal("1500.00"),
        ):
            paid, remaining, is_paid = order_payment_summary(db, self._order(), Decimal("1500.00"))
        self.assertEqual(paid, Decimal("1500.00"))
        self.assertEqual(remaining, Decimal("0.00"))
        self.assertTrue(is_paid)

    def test_ensure_order_fully_paid_blocks(self):
        db = MagicMock()
        with patch(
            "app.services.autoservice_payment_service.order_payment_summary",
            return_value=(Decimal("500.00"), Decimal("500.00"), False),
        ):
            with self.assertRaises(HTTPException) as ctx:
                ensure_order_fully_paid(db, self._order(), Decimal("1000.00"))
        self.assertEqual(ctx.exception.status_code, 400)

    def test_create_repair_order_payment_rejects_overpay(self):
        db = MagicMock()
        order = self._order()
        with patch(
            "app.services.autoservice_payment_service.order_payment_summary",
            return_value=(Decimal("0.00"), Decimal("100.00"), False),
        ):
            with self.assertRaises(HTTPException) as ctx:
                create_repair_order_payment(
                    db,
                    order=order,
                    org_id="ORG1",
                    user_id=7,
                    method="cash",
                    amount=Decimal("150.00"),
                    grand_total=Decimal("100.00"),
                )
        self.assertEqual(ctx.exception.status_code, 400)

    def test_create_repair_order_payment_success(self):
        db = MagicMock()
        order = self._order()
        payment_obj = MagicMock(
            sequential_number=3,
            amount=Decimal("40.00"),
            method="card",
        )
        with patch(
            "app.services.autoservice_payment_service.order_payment_summary",
            return_value=(Decimal("0.00"), Decimal("100.00"), False),
        ), patch(
            "app.services.autoservice_payment_service.allocate_autoservice_payment_number",
            return_value=3,
        ), patch(
            "app.services.autoservice_payment_service.AutoservicePayment",
            return_value=payment_obj,
        ):
            payment = create_repair_order_payment(
                db,
                order=order,
                org_id="ORG1",
                user_id=7,
                method="card",
                amount=Decimal("40.00"),
                grand_total=Decimal("100.00"),
            )
        db.add.assert_called_once_with(payment_obj)
        db.flush.assert_called_once()
        self.assertEqual(payment.sequential_number, 3)
        self.assertEqual(payment.amount, Decimal("40.00"))
        self.assertEqual(payment.method, "card")

    def test_batch_paid_amounts(self):
        db = MagicMock()
        db.query.return_value.filter.return_value.group_by.return_value.all.return_value = [
            (1, Decimal("100.00")),
            (2, Decimal("250.50")),
        ]
        result = batch_paid_amounts(db, [1, 2, 3])
        self.assertEqual(result[1], Decimal("100.00"))
        self.assertEqual(result[2], Decimal("250.50"))
        self.assertNotIn(3, result)

    def test_list_finance_receipts_aggregates_methods(self):
        db = MagicMock()
        order = self._order()
        payment_card = MagicMock(
            id=11,
            sequential_number=1,
            repair_order_id=1,
            amount=Decimal("100.00"),
            method="card",
            created_at=datetime(2026, 8, 10, 12, 0, 0),
            order=order,
        )
        payment_cash = MagicMock(
            id=12,
            sequential_number=2,
            repair_order_id=1,
            amount=Decimal("50.00"),
            method="cash",
            created_at=datetime(2026, 8, 11, 12, 0, 0),
            order=order,
        )
        query = db.query.return_value
        query.options.return_value = query
        query.join.return_value = query
        query.filter.return_value = query
        query.order_by.return_value = query
        query.all.return_value = [payment_card, payment_cash]

        with patch("app.services.autoservice_payment_service.joinedload", return_value=MagicMock()):
            result = list_finance_receipts(
                db,
                org_id="ORG1",
                date_from=date(2026, 8, 1),
                date_to=date(2026, 8, 31),
            )
        self.assertEqual(result.count, 2)
        self.assertEqual(result.totals.card, Decimal("100.00"))
        self.assertEqual(result.totals.cash, Decimal("50.00"))
        self.assertEqual(result.total_amount, Decimal("150.00"))
        self.assertEqual(result.items[0].client_name, "Ivan Petrov")
        self.assertEqual(result.items[0].id, 11)

    def test_finance_receipt_uses_client_name(self):
        from app.services.autoservice_payment_service import _finance_receipt_row

        order = self._order()
        payment = MagicMock(
            id=1,
            sequential_number=1,
            repair_order_id=1,
            amount=Decimal("10.00"),
            method="cash",
            created_at=datetime(2026, 8, 10, 12, 0, 0),
            order=order,
        )
        row = _finance_receipt_row(payment)
        self.assertEqual(row.client_name, "Ivan Petrov")

    def test_update_autoservice_payment_date(self):
        db = MagicMock()
        order = self._order()
        payment = MagicMock(
            id=15,
            sequential_number=4,
            repair_order_id=1,
            amount=Decimal("80.00"),
            method="bank",
            created_at=datetime(2026, 8, 5, 12, 0, 0),
            order=order,
        )
        db.query.return_value.options.return_value.filter.return_value.first.return_value = payment

        with patch("app.services.autoservice_payment_service.joinedload", return_value=MagicMock()):
            result = update_autoservice_payment_date(
                db,
                org_id="ORG1",
                payment_id=15,
                paid_at=date(2026, 8, 19),
            )

        self.assertEqual(result.id, 15)
        self.assertEqual(payment.created_at, datetime(2026, 8, 19, 12, 0))
        db.flush.assert_called_once()

    def test_delete_autoservice_payment_reopens_completed_order(self):
        db = MagicMock()
        order = self._order()
        order.status = "completed"
        payment = MagicMock(id=15, order=order)
        db.query.return_value.options.return_value.filter.return_value.first.return_value = payment

        with patch("app.services.autoservice_payment_service.joinedload", return_value=MagicMock()), patch(
            "app.services.autoservice_payment_service.record_repair_order_status_timestamp",
        ) as record_ts, patch(
            "app.services.autoservice_payment_service.clear_order_accruals",
        ) as clear_accruals:
            delete_autoservice_payment(db, org_id="ORG1", payment_id=15)

        db.delete.assert_called_once_with(payment)
        self.assertEqual(order.status, "done")
        record_ts.assert_called_once_with(order, "done")
        clear_accruals.assert_called_once_with(db, order.id)

    def test_delete_autoservice_payment_keeps_open_order_status(self):
        db = MagicMock()
        order = self._order()
        order.status = "pending"
        payment = MagicMock(id=16, order=order)
        db.query.return_value.options.return_value.filter.return_value.first.return_value = payment

        with patch("app.services.autoservice_payment_service.joinedload", return_value=MagicMock()), patch(
            "app.services.autoservice_payment_service.clear_order_accruals",
        ) as clear_accruals:
            delete_autoservice_payment(db, org_id="ORG1", payment_id=16)

        db.delete.assert_called_once_with(payment)
        self.assertEqual(order.status, "pending")
        clear_accruals.assert_not_called()


if __name__ == "__main__":
    unittest.main()
