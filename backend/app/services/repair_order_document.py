from __future__ import annotations

import asyncio
import os
import subprocess
import sys
import tempfile
from pathlib import Path
from urllib.parse import quote

from fastapi import HTTPException, status
from jinja2 import Environment, FileSystemLoader, select_autoescape

from app.models.organization import Organization
from app.schemas.repair_order import RepairOrderStaffView
from app.utils.print_document_format import (
    buyer_name,
    format_date,
    format_integer_ru,
    format_money,
    format_quantity,
    format_unit,
    rubles_in_words,
    split_vat_inclusive,
    work_executors_label,
)

TEMPLATES_DIR = Path(__file__).resolve().parents[1] / "templates" / "documents"
RENDERER_SCRIPT = Path(__file__).resolve().parents[1] / "utils" / "render_document_pdf.py"

# Отдельный счётчик от печатных этикеток: документ A4 рендеруется дольше, слотов меньше.
MAX_CONCURRENT_DOCUMENT_PDF_RENDERS = max(2, min(4, (os.cpu_count() or 4)))
_pdf_semaphore: asyncio.Semaphore | None = None

_env = Environment(
    loader=FileSystemLoader(str(TEMPLATES_DIR)),
    autoescape=select_autoescape(["html", "xml"]),
)
_env.filters["money"] = format_money
_env.filters["words"] = rubles_in_words


def _text(value: object | None) -> str:
    return str(value).strip() if value is not None else ""


def _completed_date(view: RepairOrderStaffView) -> str:
    if view.status in ("completed", "done"):
        return format_date(view.updated_at or view.scheduled_end_at)
    return format_date(view.scheduled_end_at)


def _defect_comment(view: RepairOrderStaffView) -> str:
    return "\n".join(
        part for part in (_text(view.client_comment), _text(view.staff_comment)) if part
    )


def build_repair_order_context(view: RepairOrderStaffView, org: Organization | None) -> dict:
    client = view.client
    vehicle = view.vehicle
    vat_rate = view.vat_rate
    works_total = view.works_total
    shop_total = view.shop_parts_total
    grand_total = view.grand_total
    works_vat = split_vat_inclusive(works_total, vat_rate)[0]
    shop_vat = split_vat_inclusive(shop_total, vat_rate)[0]
    grand_vat = split_vat_inclusive(grand_total, vat_rate)[0]
    return {
        "order_number": _text(view.order_number),
        "received_date": format_date(view.created_at or view.scheduled_at),
        "completed_date": _completed_date(view),
        "accepted_by": _text(view.accepted_by.name if view.accepted_by else None),
        "contractor": {
            "name": _text(getattr(org, "legal_name", None) or getattr(org, "name", None)),
            "address": _text(getattr(org, "legal_address", None) or getattr(org, "address", None)),
            "inn": _text(getattr(org, "inn", None)),
            "phone": _text(getattr(org, "phone", None)),
            "director_name": _text(getattr(org, "director_name", None)),
        },
        "customer": {
            "name": buyer_name(
                client.person_type if client else None,
                client.name if client else None,
                client.legal_name if client else None,
            ),
            "phone": _text(client.phone if client else None),
        },
        "vehicle": {
            "make": _text(vehicle.make if vehicle else None),
            "model": _text(vehicle.model if vehicle else None),
            "plate": _text(vehicle.plate if vehicle else None),
            "vin": _text(vehicle.vin if vehicle else None),
            "year": _text(vehicle.year if vehicle and vehicle.year is not None else None),
            "mileage": (
                f"{format_integer_ru(view.mileage_km)} км"
                if view.mileage_km is not None
                else ""
            ),
        },
        "defect_comment": _defect_comment(view),
        "works": [
            {
                "title": _text(work.title),
                "qty": _text(work.qty),
                "price": work.unit_price,
                "sum": work.line_sum,
                "executor": work_executors_label(work),
            }
            for work in view.works
        ],
        "materials": [
            {
                "code": _text(part.partnumber or part.rossko_partnumber or part.id),
                "name": _text(part.display_name or part.title),
                "qty": f"{format_quantity(part.qty, part.unit)} {format_unit(part.unit)}",
                "price": part.price_with_markup,
                "sum": part.line_sum,
            }
            for part in view.shop_parts
        ],
        "client_parts": [
            {
                "name": _text(part.title),
                "qty": f"{part.qty} {format_unit(part.unit)}",
            }
            for part in view.client_parts
        ],
        "works_total": works_total,
        "works_vat": works_vat,
        "shop_total": shop_total,
        "shop_vat": shop_vat,
        "grand_total": grand_total,
        "grand_vat": grand_vat,
        "sign": {
            "client_name": _text(client.name if client else None),
            "contractor_name": _text(
                (view.accepted_by.name if view.accepted_by else None)
                or getattr(org, "director_name", None)
            ),
        },
    }


def require_printable_requisites(context: dict) -> None:
    """Те же обязательные поля, что требует веб-печать: без них документ не печатают."""
    required = [
        (context["order_number"], "Номер заказ-наряда"),
        (context["received_date"], "Дата приема заказа"),
        (context["contractor"]["name"], "Исполнитель"),
        (context["customer"]["name"], "Заказчик"),
    ]
    missing = [label for value, label in required if not value]
    if missing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Заполните: {', '.join(missing)}",
        )


def render_repair_order_html(view: RepairOrderStaffView, org: Organization | None) -> str:
    context = build_repair_order_context(view, org)
    require_printable_requisites(context)
    return _env.get_template("repair_order.html").render(**context)


def repair_order_pdf_filename(order_number: str) -> str:
    return f"Заказ-наряд №{order_number}.pdf"


def content_disposition(filename: str, ascii_fallback: str) -> str:
    return (
        f'attachment; filename="{ascii_fallback}"; '
        f"filename*=UTF-8''{quote(filename)}"
    )


def _html_to_pdf_bytes(html: str) -> bytes:
    with tempfile.TemporaryDirectory(prefix="document_pdf_") as tmp_dir:
        tmp_path = Path(tmp_dir)
        html_path = tmp_path / "document.html"
        pdf_path = tmp_path / "document.pdf"
        html_path.write_text(html, encoding="utf-8")
        proc = subprocess.run(
            [sys.executable, str(RENDERER_SCRIPT), str(html_path), str(pdf_path)],
            capture_output=True,
            text=True,
        )
        if proc.returncode != 0:
            raise RuntimeError(
                f"PDF renderer failed: {proc.stderr or proc.stdout or 'unknown error'}"
            )
        return pdf_path.read_bytes()


def _get_pdf_semaphore() -> asyncio.Semaphore:
    global _pdf_semaphore
    if _pdf_semaphore is None:
        _pdf_semaphore = asyncio.Semaphore(MAX_CONCURRENT_DOCUMENT_PDF_RENDERS)
    return _pdf_semaphore


async def render_document_pdf_bytes(html: str) -> bytes:
    async with _get_pdf_semaphore():
        return await asyncio.to_thread(_html_to_pdf_bytes, html)
