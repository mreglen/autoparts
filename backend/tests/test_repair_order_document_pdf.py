import asyncio
import sys
import time
import types
import unittest
from datetime import date, datetime
from decimal import Decimal
from pathlib import Path
from unittest.mock import MagicMock, patch

if "fcntl" not in sys.modules:
    sys.modules["fcntl"] = types.ModuleType("fcntl")

from fastapi import HTTPException

from app.models.organization import Organization
from app.schemas.repair_order import (
    RepairOrderClientBrief,
    RepairOrderClientPartView,
    RepairOrderContractorBrief,
    RepairOrderEmployeeBrief,
    RepairOrderShopPartView,
    RepairOrderStaffView,
    RepairOrderUserBrief,
    RepairOrderVehicleBrief,
    RepairOrderWorkContractorView,
    RepairOrderWorkExecutorView,
    RepairOrderWorkView,
)
from app.services import repair_order_document
from app.services.repair_order_document import (
    _html_to_pdf_bytes,
    build_repair_order_context,
    content_disposition,
    render_document_pdf_bytes,
    render_repair_order_html,
)
from app.utils.print_document_format import (
    format_money,
    format_quantity,
    rubles_in_words,
    split_vat_inclusive,
)

_NBSP = "\u00a0"


def _org() -> Organization:
    return Organization(
        id="ORG1",
        name="Гараж ООО",
        legal_name="ООО «Гараж»",
        legal_address="Екатеринбург, Малышева 1",
        inn="6600000000",
        phone="+73450000000",
        director_name="Петров С.А.",
    )


def _view(**overrides) -> RepairOrderStaffView:
    base = dict(
        id=77,
        organization_id="ORG1",
        order_number="16",
        client_id=5,
        vehicle_id=9,
        client_comment="Стук в подвеске",
        staff_comment="Заменить стойки",
        scheduled_at=datetime(2026, 10, 20, 9, 0),
        scheduled_end_at=datetime(2026, 10, 22, 18, 0),
        mileage_km=150000,
        accepted_by_user_id=3,
        created_by_user_id=3,
        status="completed",
        created_at=datetime(2026, 10, 20, 9, 12),
        updated_at=datetime(2026, 10, 21, 20, 5),
        client=RepairOrderClientBrief(
            id=5,
            name="Иванов Иван Иванович",
            phone=f"+7 912 {_NBSP}000-00-00",
            person_type="individual",
        ),
        vehicle=RepairOrderVehicleBrief(
            id=9, make="Toyota", model="Camry", year=2015, vin="JTECH", plate="А123ВС"
        ),
        accepted_by=RepairOrderUserBrief(id=3, name="Сидоров Артем"),
        works=[
            RepairOrderWorkView(
                id=1,
                position=1,
                title="Замена стоек",
                qty=2,
                unit_price=Decimal("1500.00"),
                line_sum=Decimal("3000.00"),
                executors=[
                    RepairOrderWorkExecutorView(
                        employee_id=4,
                        employee=RepairOrderEmployeeBrief(id=4, name="Сидоров Артем"),
                        percent=Decimal("100.00"),
                        pay_amount=Decimal("3000.00"),
                    )
                ],
                contractors=[
                    RepairOrderWorkContractorView(
                        contractor_id=2,
                        contractor=RepairOrderContractorBrief(id=2, name="Урал Стартер"),
                        amount=Decimal("500.00"),
                    )
                ],
            )
        ],
        shop_parts=[
            RepairOrderShopPartView(
                id=11,
                position=1,
                title="Стойка",
                display_name="Стойка Stabilus",
                qty=Decimal("4.000"),
                unit="pcs",
                unit_price=Decimal("1000.00"),
                markup_percent=Decimal("10.00"),
                price_with_markup=Decimal("1100.00"),
                line_sum=Decimal("4400.00"),
                source="manual",
                partnumber="ABC-1",
            )
        ],
        client_parts=[
            RepairOrderClientPartView(id=21, position=1, title="Масло клиента", qty=1, unit="l")
        ],
        vat_rate=Decimal("20.00"),
        works_total=Decimal("3000.00"),
        shop_parts_total=Decimal("4400.00"),
        deliveries_total=Decimal("0.00"),
        grand_total=Decimal("7400.00"),
    )
    base.update(overrides)
    return RepairOrderStaffView(**base)


class PrintFormatHelpersTests(unittest.TestCase):
    def test_money_matches_web_locale(self):
        self.assertEqual(format_money("1234.56"), f"1{_NBSP}234,56")
        self.assertEqual(format_money(0), "0,00")
        self.assertEqual(format_money("1000000"), f"1{_NBSP}000{_NBSP}000,00")

    def test_quantity_matches_web_locale(self):
        self.assertEqual(format_quantity("4.000", "pcs"), "4")
        self.assertEqual(format_quantity("2.5", "l"), "2,5")
        self.assertEqual(format_quantity("0.125", "kg"), "0,125")

    def test_vat_split_matches_web_rounding(self):
        self.assertEqual(split_vat_inclusive("1200", 20), (Decimal("200.00"), Decimal("1000.00")))
        self.assertEqual(split_vat_inclusive("100", 20), (Decimal("16.67"), Decimal("83.33")))
        self.assertEqual(split_vat_inclusive("500", 0), (Decimal("0.00"), Decimal("500.00")))

    def test_words_cover_plural_cases(self):
        self.assertEqual(rubles_in_words("0"), "Ноль рублей 00 копеек")
        self.assertEqual(rubles_in_words("1"), "Один рубль 00 копеек")
        self.assertEqual(rubles_in_words("5"), "Пять рублей 00 копеек")
        self.assertEqual(rubles_in_words("11"), "Одиннадцать рублей 00 копеек")
        self.assertEqual(rubles_in_words("21"), "Двадцать один рубль 00 копеек")
        self.assertEqual(
            rubles_in_words("1234.56"),
            "Одна тысяча двести тридцать четыре рубля 56 копеек",
        )
        self.assertEqual(rubles_in_words("1000000"), "Один миллион рублей 00 копеек")


class RepairOrderDocumentContextTests(unittest.TestCase):
    def test_context_mirrors_web_autoform(self):
        context = build_repair_order_context(_view(), _org())
        self.assertEqual(context["order_number"], "16")
        self.assertEqual(context["received_date"], "20.10.2026")
        # «Дата выполнения» закрытого заказа — updated_at, как в веб-форме
        self.assertEqual(context["completed_date"], "21.10.2026")
        self.assertEqual(context["accepted_by"], "Сидоров Артем")
        self.assertEqual(context["contractor"]["name"], "ООО «Гараж»")
        self.assertEqual(context["contractor"]["inn"], "6600000000")
        self.assertEqual(context["customer"]["name"], "Иванов Иван Иванович")
        self.assertEqual(context["vehicle"]["mileage"], f"150{_NBSP}000 км")
        self.assertEqual(context["defect_comment"], "Стук в подвеске\nЗаменить стойки")
        self.assertEqual(context["works"][0]["executor"], "Сидоров Артем; Урал Стартер (подряд)")
        self.assertEqual(context["materials"][0]["qty"], f"4 {_NBSP}шт.".replace(f" {_NBSP}", " "))
        self.assertEqual(context["client_parts"][0]["qty"], "1 л")

    def test_legal_client_uses_legal_name(self):
        view = _view(
            client=RepairOrderClientBrief(
                id=5,
                name="Романов П.К.",
                phone="+79000000000",
                person_type="legal",
                legal_name="АО «Склад»",
            )
        )
        self.assertEqual(build_repair_order_context(view, _org())["customer"]["name"], "АО «Склад»")

    def test_missing_requisites_block_document(self):
        with self.assertRaises(HTTPException) as ctx:
            render_repair_order_html(_view(order_number=None), _org())
        self.assertEqual(ctx.exception.status_code, 400)
        self.assertIn("Заполните: Номер заказ-наряда", ctx.exception.detail)

    def test_html_has_lines_totals_and_signatures(self):
        html = render_repair_order_html(_view(), _org())
        self.assertIn("Заказ-наряд №16", html)
        self.assertIn("Замена стоек", html)
        self.assertIn(f"3{_NBSP}000,00", html)
        self.assertIn("Итого по заказ-наряду:", html)
        self.assertIn("Семь тысяч четыреста рублей 00 копеек", html)
        self.assertIn("в том числе НДС", html)
        self.assertIn("Урал Стартер (подряд)", html)
        self.assertIn("Масло клиента", html)
        self.assertIn("Подпись заказчика", html)
        self.assertIn("Сидоров Артем", html)

    def test_empty_lists_still_print_blank_row(self):
        html = render_repair_order_html(_view(works=[], shop_parts=[]), _org())
        self.assertIn("Наименование работ", html)
        self.assertIn("Наименование материала", html)
        self.assertIn("<td class=\"num\">1</td>\n          <td></td>", html)

    def test_filename_is_rfc5987_encoded(self):
        header = content_disposition("Заказ-наряд №16.pdf", "order-77.pdf")
        self.assertIn('filename="order-77.pdf"', header)
        self.assertIn("filename*=UTF-8''%D0%97", header)


class DocumentPdfRendererTests(unittest.TestCase):
    def test_render_spawns_document_script_and_returns_bytes(self):
        def fake_run(cmd, *args, **kwargs):
            self.assertEqual(Path(cmd[1]).name, "render_document_pdf.py")
            self.assertTrue(Path(cmd[1]).exists())
            self.assertEqual(Path(cmd[2]).name, "document.html")
            Path(cmd[3]).write_bytes(b"%PDF-1.4 fake")
            return MagicMock(returncode=0, stdout="", stderr="")

        with patch("app.services.repair_order_document.subprocess.run", side_effect=fake_run):
            content = _html_to_pdf_bytes("<html><body>тест</body></html>")
        self.assertEqual(content, b"%PDF-1.4 fake")

    def test_renderer_failure_becomes_runtime_error(self):
        with patch(
            "app.services.repair_order_document.subprocess.run",
            return_value=MagicMock(returncode=1, stdout="", stderr="no chromium"),
        ):
            with self.assertRaises(RuntimeError) as ctx:
                _html_to_pdf_bytes("<html></html>")
        self.assertIn("no chromium", str(ctx.exception))

    def test_async_render_is_throttled_by_semaphore(self):
        running = []
        peak = []

        def fake_run(cmd, *args, **kwargs):
            running.append(1)
            peak.append(len(running))
            Path(cmd[3]).write_bytes(b"%PDF")
            # Поддельный рендер держит слот, пока не запустятся все остальные.
            time.sleep(0.02)
            running.pop()
            return MagicMock(returncode=0, stdout="", stderr="")

        async def render_six():
            await asyncio.gather(*(render_document_pdf_bytes("<html></html>") for _ in range(6)))

        with patch("app.services.repair_order_document.subprocess.run", side_effect=fake_run):
            with patch(
                "app.services.repair_order_document.MAX_CONCURRENT_DOCUMENT_PDF_RENDERS", 2
            ):
                repair_order_document._pdf_semaphore = None
                try:
                    asyncio.run(render_six())
                finally:
                    repair_order_document._pdf_semaphore = None
        self.assertTrue(peak)
        self.assertLessEqual(max(peak), 2)


if __name__ == "__main__":
    unittest.main()
