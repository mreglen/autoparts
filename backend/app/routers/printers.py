from fastapi import APIRouter, WebSocket, WebSocketDisconnect, HTTPException, Depends, Header
from typing import Dict, List, Optional
from datetime import datetime, timedelta
import json
import base64
import io
from pathlib import Path
import tempfile
import subprocess
import sys
from urllib.parse import urlsplit, urlunsplit
import qrcode
from app.core.auth import get_current_user
from app.core.config import settings
from app.models.user import User
from app.models.organization import Organization
from app.models.product import Product as ProductModel
from app.models.pending_product import PendingProduct
from app.models.rejected_product import RejectedProduct
from app.models.printer_agent import PrinterAgent
from app.models.printer_agent_printer import PrinterAgentPrinter
from app.models.printer_permission import PrinterPermission
from app.models.product_storage_cell import ProductStorageCell as ProductStorageCellModel
from app.models.pending_product_storage_cell import PendingProductStorageCell as PendingProductStorageCellModel
from app.models.storage_cell import StorageCell as StorageCellModel
from app.db.database import get_db
from app.services.audit_service import log_audit
from app.services.printer_agent_hub import printer_hub
from sqlalchemy import and_
from sqlalchemy.orm import Session
import asyncio
import os
import secrets
from jinja2 import Environment, FileSystemLoader, select_autoescape

router = APIRouter(prefix="/printers", tags=["printers"])

AGENT_OFFLINE_DETAIL = (
    "Агент печати не подключён к серверу. "
    "Убедитесь, что AutoParts Printer Agent запущен на компьютере с принтером."
)

# Print jobs in memory (status polling is best-effort across workers)
print_jobs: Dict[int, dict] = {}
job_counter = 0

# Limit concurrent Playwright PDF renders so parallel label prints do not block the API.
MAX_CONCURRENT_LABEL_PDF_RENDERS = max(2, min(8, (os.cpu_count() or 4)))
_pdf_render_semaphore: asyncio.Semaphore | None = None
_job_counter_lock = asyncio.Lock()

_templates_env = Environment(
    loader=FileSystemLoader(str(Path(__file__).resolve().parents[1] / "templates" / "printing")),
    autoescape=select_autoescape(["html", "xml"]),
)


def _build_qr_data_uri(url: str, size_px: int = 220) -> str:
    qr = qrcode.QRCode(
        version=None,
        error_correction=qrcode.constants.ERROR_CORRECT_M,
        box_size=10,
        border=2,
    )
    qr.add_data(url)
    qr.make(fit=True)
    img = qr.make_image(fill_color="black", back_color="white").convert("RGB")
    img = img.resize((size_px, size_px))
    buffer = io.BytesIO()
    img.save(buffer, format="PNG")
    encoded = base64.b64encode(buffer.getvalue()).decode("ascii")
    return f"data:image/png;base64,{encoded}"


def _short_cell_name(name: str) -> str:
    text = (name or "").strip()
    return text[:4] if text else "—"


def _build_test_label_storage_cells():
    """Демо-ячейки для пробной печати: первая строка — сокращённое имя (4 символа), вторая — значение."""
    samples = [
        ("Стеллаж", "A-01"),
        ("Секция", "02"),
        ("Место", "03"),
        ("Ряд", "04"),
        ("Уровень", "B2"),
        ("Полка", "C5"),
    ]
    return [{"name_short": _short_cell_name(name), "value": value} for name, value in samples]


def _storage_cells_per_row_full(width_mm: int) -> int:
    """Колонок адресного хранения на всю ширину этикетки (пробная печать)."""
    usable = max(24, int(width_mm) - 4)
    return max(3, min(8, usable // 6))


def _chunk_test_storage_cells(cells, width_mm: int):
    size = _storage_cells_per_row_full(width_mm)
    if not cells:
        return []
    return [cells[i : i + size] for i in range(0, len(cells), size)]


def _storage_cell_row(name: str, value: str) -> Optional[dict]:
    clean_value = (value or "").strip()
    if not clean_value:
        return None
    return {"name_short": _short_cell_name(name), "value": clean_value}


def _normalize_payload_storage_cells(payload: dict) -> list:
    raw = payload.get("storage_cells")
    if not isinstance(raw, list) or not raw:
        return []

    rows = []
    for item in raw:
        if not isinstance(item, dict):
            continue
        name = (
            item.get("name")
            or item.get("cell_name")
            or item.get("storage_cell_name")
            or ""
        )
        name_short = item.get("name_short") or _short_cell_name(name)
        value = item.get("value")
        clean_value = (str(value) if value is not None else "").strip()
        if not clean_value:
            continue
        rows.append({"name_short": name_short, "value": clean_value})
    return rows


def _load_product_storage_cell_rows(db: Session, product_id: int, organization_id: str) -> list:
    product = (
        db.query(ProductModel)
        .filter(
            ProductModel.id == product_id,
            ProductModel.organization_id == organization_id,
        )
        .first()
    )
    if not product:
        return []

    links = (
        db.query(ProductStorageCellModel)
        .filter(ProductStorageCellModel.product_id == product_id)
        .all()
    )
    rows = []
    for link in links:
        cell = db.query(StorageCellModel).filter(StorageCellModel.id == link.storage_cell_id).first()
        row = _storage_cell_row(cell.name if cell else "", link.value)
        if row:
            rows.append(row)
    return rows


def _load_pending_storage_cell_rows(db: Session, pending_product_id: int, organization_id: str) -> list:
    pending = (
        db.query(PendingProduct)
        .filter(
            PendingProduct.id == pending_product_id,
            PendingProduct.organization_id == organization_id,
        )
        .first()
    )
    if not pending:
        return []

    links = (
        db.query(PendingProductStorageCellModel)
        .filter(PendingProductStorageCellModel.pending_product_id == pending_product_id)
        .all()
    )
    rows = []
    for link in links:
        cell = db.query(StorageCellModel).filter(StorageCellModel.id == link.storage_cell_id).first()
        row = _storage_cell_row(cell.name if cell else "", link.value)
        if row:
            rows.append(row)
    return rows


def _build_label_storage_cell_rows(payload: dict, db: Session, current_user: User, width_mm: int) -> list:
    rows = _normalize_payload_storage_cells(payload)
    if not rows:
        source = (payload.get("source") or "product").strip().lower()
        org_id = current_user.organization_id
        if source == "pending":
            try:
                pending_id = int(payload.get("pending_product_id") or payload.get("product_id"))
                rows = _load_pending_storage_cell_rows(db, pending_id, org_id)
            except (TypeError, ValueError):
                rows = []
        elif source != "rejected":
            try:
                product_id = int(payload.get("product_id"))
                rows = _load_product_storage_cell_rows(db, product_id, org_id)
            except (TypeError, ValueError):
                rows = []

    return _chunk_test_storage_cells(rows, width_mm)


def _render_label_html(
    *,
    width_mm: int,
    height_mm: int,
    brand: str,
    article: str,
    name: str,
    internal_code: str,
    price: str,
    qr_data_uri: str,
    storage_cell_rows: list,
) -> str:
    tmpl = _templates_env.get_template("label_print_test.html")
    return tmpl.render(
        label_width_mm=width_mm,
        label_height_mm=height_mm,
        brand=brand,
        article=article,
        storage_cell_rows=storage_cell_rows,
        name=name,
        internal_code=internal_code,
        price=price,
        qr_data_uri=qr_data_uri,
    )


def _normalize_public_base_url(raw_url: str) -> str:
    if not raw_url:
        return ""
    clean = raw_url.strip().strip("'").strip('"').rstrip("/")
    try:
        parsed = urlsplit(clean)
        path = (parsed.path or "").rstrip("/")
        # Deployment can serve API under /server, but QR link must point to frontend root.
        if path.endswith("/server"):
            path = path[: -len("/server")]
        normalized = urlunsplit((parsed.scheme, parsed.netloc, path, "", ""))
        return normalized.rstrip("/")
    except Exception:
        return clean


def _html_to_pdf_bytes(html: str, width_mm: int, height_mm: int) -> bytes:
    renderer_script = Path(__file__).resolve().parents[1] / "utils" / "render_label_pdf.py"
    with tempfile.TemporaryDirectory(prefix="label_pdf_") as tmp_dir:
        tmp_path = Path(tmp_dir)
        html_path = tmp_path / "label.html"
        pdf_path = tmp_path / "label.pdf"
        html_path.write_text(html, encoding="utf-8")

        proc = subprocess.run(
            [
                sys.executable,
                str(renderer_script),
                str(html_path),
                str(pdf_path),
                str(int(width_mm)),
                str(int(height_mm)),
            ],
            capture_output=True,
            text=True,
        )
        if proc.returncode != 0:
            raise RuntimeError(f"PDF renderer failed: {proc.stderr or proc.stdout or 'unknown error'}")
        return pdf_path.read_bytes()


def _get_pdf_render_semaphore() -> asyncio.Semaphore:
    global _pdf_render_semaphore
    if _pdf_render_semaphore is None:
        _pdf_render_semaphore = asyncio.Semaphore(MAX_CONCURRENT_LABEL_PDF_RENDERS)
    return _pdf_render_semaphore


async def _render_label_pdf_bytes(html: str, width_mm: int, height_mm: int) -> bytes:
    async with _get_pdf_render_semaphore():
        return await asyncio.to_thread(_html_to_pdf_bytes, html, width_mm, height_mm)


async def _ensure_agent_online(agent_id: int) -> None:
    if not await printer_hub.is_online(agent_id):
        raise HTTPException(status_code=400, detail=AGENT_OFFLINE_DETAIL)


async def _online_agent_ids(db: Session, org_id: str | None = None) -> list[int]:
    q = db.query(PrinterAgent.id).filter(PrinterAgent.is_active.is_(True))
    if org_id:
        q = q.filter(PrinterAgent.organization_id == org_id)
    ids = [row.id for row in q.all()]
    return await printer_hub.filter_online(ids)


async def _next_job_id() -> int:
    global job_counter
    async with _job_counter_lock:
        job_counter += 1
        return job_counter


def generate_printer_token() -> str:
    """Generate a new printer token for organization"""
    return secrets.token_urlsafe(32)


async def validate_printer_token(token: str, organization_id: str, db: Session) -> PrinterAgent | None:
    """Validate that the printer token matches the organization and returns PrinterAgent."""
    if not token or not organization_id:
        return None

    agent = (
        db.query(PrinterAgent)
        .filter(
            PrinterAgent.printer_token == token,
            PrinterAgent.organization_id == organization_id,
            PrinterAgent.is_active == True,
        )
        .first()
    )
    return agent


@router.get("/")
async def get_all_printers(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Get all registered printers from active connections
    If user is not admin, only show printers from their organization
    """
    user_org_id = None
    if not current_user.is_admin and hasattr(current_user, "organization_id"):
        user_org_id = current_user.organization_id

    agent_ids_online = await _online_agent_ids(db, user_org_id)
    if not agent_ids_online:
        return []

    q = (
        db.query(PrinterAgentPrinter)
        .join(PrinterAgent, PrinterAgentPrinter.agent_id == PrinterAgent.id)
        .filter(PrinterAgentPrinter.agent_id.in_(agent_ids_online))
    )
    if user_org_id:
        q = q.filter(PrinterAgent.organization_id == user_org_id)

    printers = []
    for p in q.all():
        printers.append(
            {
                "id": p.id,
                "name": p.printer_name,
                "driver_name": p.driver_name,
                "port_name": p.port_name,
                "is_default": p.is_default,
                "agent_hostname": p.agent.hostname if p.agent else None,
                "organization_id": p.agent.organization_id if p.agent else None,
                "is_active": True,
            }
        )
    return printers


@router.get("/available")
async def get_available_printers(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Get list of currently available printers (active agents)
    Filtered by organization for non-admin users
    """
    user_org_id = None
    if not current_user.is_admin and hasattr(current_user, "organization_id"):
        user_org_id = current_user.organization_id

    agent_ids_online = await _online_agent_ids(db, user_org_id)
    if not agent_ids_online:
        return []

    q = (
        db.query(PrinterAgentPrinter)
        .join(PrinterAgent, PrinterAgentPrinter.agent_id == PrinterAgent.id)
        .filter(PrinterAgentPrinter.agent_id.in_(agent_ids_online))
    )

    if user_org_id:
        q = q.filter(PrinterAgent.organization_id == user_org_id)

    # Если пользователь не админ — возвращаем только принтеры, на которые есть права
    if not current_user.is_admin:
        q = (
            q.join(
                PrinterPermission,
                and_(
                    PrinterPermission.printer_id == PrinterAgentPrinter.id,
                    PrinterPermission.user_id == current_user.id,
                ),
            )
        )

    printers = []
    for p in q.all():
        printers.append(
            {
                "id": p.id,
                "name": p.printer_name,
                "driver_name": p.driver_name,
                "port_name": p.port_name,
                "is_default": p.is_default,
                "agent_hostname": p.agent.hostname if p.agent else None,
                "organization_id": p.agent.organization_id if p.agent else None,
                "is_active": True,
            }
        )

    return printers


@router.get("/id/{printer_id}")
async def get_printer(
    printer_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Get specific printer details
    """
    try:
        printer_id_int = int(printer_id)
    except Exception:
        raise HTTPException(status_code=422, detail="Invalid printer id")

    p: PrinterAgentPrinter | None = db.query(PrinterAgentPrinter).filter(PrinterAgentPrinter.id == printer_id_int).first()
    if not p:
        raise HTTPException(status_code=404, detail="Printer not found")

    agent = db.query(PrinterAgent).filter(PrinterAgent.id == p.agent_id).first()
    if not agent:
        raise HTTPException(status_code=404, detail="Agent not found")

    if not current_user.is_admin and current_user.organization_id != agent.organization_id:
        raise HTTPException(status_code=403, detail="Not enough permissions")

    if not current_user.is_admin:
        has_perm = (
            db.query(PrinterPermission)
            .filter(
                PrinterPermission.user_id == current_user.id,
                PrinterPermission.printer_id == p.id,
            )
            .first()
            is not None
        )
        if not has_perm:
            raise HTTPException(status_code=403, detail="Not enough permissions")

    return {
        "id": p.id,
        "name": p.printer_name,
        "driver_name": p.driver_name,
        "port_name": p.port_name,
        "is_default": p.is_default,
        "agent_hostname": agent.hostname,
        "organization_id": agent.organization_id,
        "is_active": await printer_hub.is_online(agent.id),
    }


@router.post("/id/{printer_id}/print")
async def print_to_printer(
    printer_id: str,
    print_data: dict,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Send a print job to a specific printer
    """
    # В этой версии printer_id = ID записи в printer_agent_printers
    try:
        printer_id_int = int(printer_id)
    except Exception:
        raise HTTPException(status_code=422, detail="Invalid printer id")

    p: PrinterAgentPrinter | None = db.query(PrinterAgentPrinter).filter(PrinterAgentPrinter.id == printer_id_int).first()
    if not p:
        raise HTTPException(status_code=404, detail="Printer not found")

    agent = db.query(PrinterAgent).filter(PrinterAgent.id == p.agent_id).first()
    if not agent:
        raise HTTPException(status_code=404, detail="Agent not found")

    if not current_user.is_admin and current_user.organization_id != agent.organization_id:
        raise HTTPException(status_code=403, detail="Not enough permissions")

    # Проверяем права пользователя на печать
    if not current_user.is_admin:
        has_perm = (
            db.query(PrinterPermission)
            .filter(
                PrinterPermission.user_id == current_user.id,
                PrinterPermission.printer_id == p.id,
            )
            .first()
            is not None
        )
        if not has_perm:
            raise HTTPException(status_code=403, detail="Not enough permissions for this printer")

    await _ensure_agent_online(p.agent_id)

    # Create print job in memory
    job_id = await _next_job_id()

    print_job = {
        "id": job_id,
        "printer_id": printer_id_int,
        "printer_name": p.printer_name,
        "content": print_data.get("content", ""),
        "copies": print_data.get("copies", 1),
        "status": "pending",
        "created_at": datetime.utcnow().isoformat(),
        "started_at": None,
        "completed_at": None,
        "error_message": None,
    }

    print_jobs[job_id] = print_job

    print_command = {
        "type": "print",
        "data": {
            "printer_name": p.printer_name,
            "content": print_data.get("content", ""),
            "copies": print_data.get("copies", 1),
            "job_id": job_id,
        },
    }

    try:
        await printer_hub.send_command(p.agent_id, print_command)

        print_job["status"] = "printing"
        print_job["started_at"] = datetime.utcnow().isoformat()

        return {
            "status": "success",
            "message": f"Print job sent to printer '{p.printer_name}'",
            "job_id": job_id,
        }
    except Exception as e:
        print_job["status"] = "failed"
        print_job["error_message"] = str(e)
        raise HTTPException(status_code=500, detail=f"Failed to send print command: {str(e)}")


@router.post("/id/{printer_id}/print-test-label")
async def print_test_label(
    printer_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Печать пробной этикетки по HTML-шаблону label_print_test.html, как PDF.
    """
    try:
        printer_id_int = int(printer_id)
    except Exception:
        raise HTTPException(status_code=422, detail="Invalid printer id")

    p: PrinterAgentPrinter | None = db.query(PrinterAgentPrinter).filter(PrinterAgentPrinter.id == printer_id_int).first()
    if not p:
        raise HTTPException(status_code=404, detail="Printer not found")

    agent = db.query(PrinterAgent).filter(PrinterAgent.id == p.agent_id).first()
    if not agent:
        raise HTTPException(status_code=404, detail="Agent not found")

    if not current_user.is_admin and current_user.organization_id != agent.organization_id:
        raise HTTPException(status_code=403, detail="Not enough permissions")

    perm = (
        db.query(PrinterPermission)
        .filter(
            PrinterPermission.user_id == current_user.id,
            PrinterPermission.printer_id == p.id,
        )
        .first()
    )
    if not perm and not current_user.is_admin:
        raise HTTPException(status_code=403, detail="Not enough permissions for this printer")

    await _ensure_agent_online(p.agent_id)

    width_mm = int(getattr(perm, "label_width_mm", 58) if perm else 58)
    height_mm = int(getattr(perm, "label_height_mm", 38) if perm else 38)

    base_url = _normalize_public_base_url(settings.PUBLIC_BASE_URL or "")
    qr_url = f"{base_url}/my-parts" if base_url else "/my-parts"
    qr_data_uri = _build_qr_data_uri(qr_url)

    test_storage_cells = _build_test_label_storage_cells()
    html = _render_label_html(
        width_mm=width_mm,
        height_mm=height_mm,
        brand="BOSCH",
        article="0 986 479 123",
        name="Тормозные колодки передние",
        internal_code="INT-0000123",
        price="1 250 ₽",
        qr_data_uri=qr_data_uri,
        storage_cell_rows=_chunk_test_storage_cells(test_storage_cells, width_mm),
    )

    pdf_bytes = await _render_label_pdf_bytes(html, width_mm=width_mm, height_mm=height_mm)
    pdf_b64 = base64.b64encode(pdf_bytes).decode("ascii")

    job_id = await _next_job_id()
    print_jobs[job_id] = {
        "id": job_id,
        "printer_id": printer_id_int,
        "printer_name": p.printer_name,
        "status": "pending",
        "created_at": datetime.utcnow().isoformat(),
        "started_at": None,
        "completed_at": None,
        "error_message": None,
        "type": "pdf",
    }

    print_command = {
        "type": "print_pdf",
        "data": {
            "printer_name": p.printer_name,
            "pdf_base64": pdf_b64,
            "copies": 1,
            "job_id": job_id,
        },
    }

    try:
        await printer_hub.send_command(p.agent_id, print_command)
        print_jobs[job_id]["status"] = "printing"
        print_jobs[job_id]["started_at"] = datetime.utcnow().isoformat()
        return {"status": "success", "message": "Test label sent", "job_id": job_id}
    except Exception as e:
        print_jobs[job_id]["status"] = "failed"
        print_jobs[job_id]["error_message"] = str(e)
        raise HTTPException(status_code=500, detail=f"Failed to send print command: {str(e)}")


def _resolve_label_qr_url(payload: dict, current_user: User, db: Session) -> str:
    """QR для этикетки: складской товар, на модерации или отклонённый."""
    base_url = _normalize_public_base_url(settings.PUBLIC_BASE_URL or "")
    source = (payload.get("source") or "product").strip().lower()

    if source == "pending":
        try:
            pending_id = int(payload.get("pending_product_id") or payload.get("product_id"))
        except Exception:
            raise HTTPException(status_code=422, detail="pending_product_id is required")
        row = (
            db.query(PendingProduct)
            .filter(
                PendingProduct.id == pending_id,
                PendingProduct.organization_id == current_user.organization_id,
            )
            .first()
        )
        if not row:
            raise HTTPException(status_code=404, detail="Pending product not found")
        path = f"/my-parts/edit-pending/{pending_id}"
        return f"{base_url}{path}" if base_url else path

    if source == "rejected":
        try:
            rejected_id = int(payload.get("rejected_product_id") or payload.get("product_id"))
        except Exception:
            raise HTTPException(status_code=422, detail="rejected_product_id is required")
        row = (
            db.query(RejectedProduct)
            .filter(
                RejectedProduct.id == rejected_id,
                RejectedProduct.organization_id == current_user.organization_id,
            )
            .first()
        )
        if not row:
            raise HTTPException(status_code=404, detail="Rejected product not found")
        path = f"/my-parts/resubmit/{rejected_id}"
        return f"{base_url}{path}" if base_url else path

    try:
        product_id = int(payload.get("product_id"))
    except Exception:
        raise HTTPException(status_code=422, detail="product_id is required")

    product = (
        db.query(ProductModel)
        .filter(
            ProductModel.id == product_id,
            ProductModel.organization_id == current_user.organization_id,
        )
        .first()
    )
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")

    if base_url:
        return f"{base_url}/seller/part-card/{product_id}"
    return f"/seller/part-card/{product_id}"


@router.post("/id/{printer_id}/print-label")
async def print_product_label(
    printer_id: str,
    payload: dict,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Печать этикетки товара по HTML-шаблону label_print_test.html, как PDF.
    """
    try:
        printer_id_int = int(printer_id)
    except Exception:
        raise HTTPException(status_code=422, detail="Invalid printer id")

    p: PrinterAgentPrinter | None = db.query(PrinterAgentPrinter).filter(PrinterAgentPrinter.id == printer_id_int).first()
    if not p:
        raise HTTPException(status_code=404, detail="Printer not found")

    agent = db.query(PrinterAgent).filter(PrinterAgent.id == p.agent_id).first()
    if not agent:
        raise HTTPException(status_code=404, detail="Agent not found")

    if not current_user.is_admin and current_user.organization_id != agent.organization_id:
        raise HTTPException(status_code=403, detail="Not enough permissions")

    perm = (
        db.query(PrinterPermission)
        .filter(
            PrinterPermission.user_id == current_user.id,
            PrinterPermission.printer_id == p.id,
        )
        .first()
    )
    if not perm and not current_user.is_admin:
        raise HTTPException(status_code=403, detail="Not enough permissions for this printer")

    await _ensure_agent_online(p.agent_id)

    # Get label settings from permission or use defaults
    width_mm = int(getattr(perm, "label_width_mm", payload.get("width_mm", 58)))
    height_mm = int(getattr(perm, "label_height_mm", payload.get("height_mm", 38)))

    # Extract product data from payload
    brand = payload.get("brand", "—")
    article = payload.get("article", "—")
    name = payload.get("name", "—")
    internal_code = payload.get("internal_code", "—")
    price = payload.get("price", "—")
    qr_url = _resolve_label_qr_url(payload, current_user, db)
    qr_data_uri = _build_qr_data_uri(qr_url)
    storage_cell_rows = _build_label_storage_cell_rows(payload, db, current_user, width_mm)

    html = _render_label_html(
        width_mm=width_mm,
        height_mm=height_mm,
        brand=brand,
        article=article,
        name=name,
        internal_code=internal_code,
        price=price,
        qr_data_uri=qr_data_uri,
        storage_cell_rows=storage_cell_rows,
    )

    pdf_bytes = await _render_label_pdf_bytes(html, width_mm=width_mm, height_mm=height_mm)
    pdf_b64 = base64.b64encode(pdf_bytes).decode("ascii")

    copies = int(payload.get("copies", 1))

    job_id = await _next_job_id()
    print_jobs[job_id] = {
        "id": job_id,
        "printer_id": printer_id_int,
        "printer_name": p.printer_name,
        "status": "pending",
        "created_at": datetime.utcnow().isoformat(),
        "started_at": None,
        "completed_at": None,
        "error_message": None,
        "type": "pdf",
    }

    print_command = {
        "type": "print_pdf",
        "data": {
            "printer_name": p.printer_name,
            "pdf_base64": pdf_b64,
            "copies": copies,
            "job_id": job_id,
        },
    }

    try:
        await printer_hub.send_command(p.agent_id, print_command)
        print_jobs[job_id]["status"] = "printing"
        print_jobs[job_id]["started_at"] = datetime.utcnow().isoformat()
        return {"status": "success", "message": "Label sent to printer", "job_id": job_id}
    except Exception as e:
        print_jobs[job_id]["status"] = "failed"
        print_jobs[job_id]["error_message"] = str(e)
        raise HTTPException(status_code=500, detail=f"Failed to send print command: {str(e)}")


@router.get("/jobs")
async def get_print_jobs(
    limit: int = 50,
    offset: int = 0,
    current_user: User = Depends(get_current_user)
):
    """
    Get recent print jobs
    """
    # Convert dict to list and sort by created_at
    jobs_list = sorted(print_jobs.values(), key=lambda x: x['created_at'], reverse=True)
    
    # Apply pagination
    paginated_jobs = jobs_list[offset:offset + limit]
    
    return paginated_jobs


@router.get("/jobs/{job_id}")
async def get_print_job(job_id: int, current_user: User = Depends(get_current_user)):
    """
    Get specific print job details
    """
    job = print_jobs.get(job_id)
    
    if not job:
        raise HTTPException(status_code=404, detail="Print job not found")
    
    return job


@router.get("/qr-preview")
async def get_qr_preview(
    url: str,
    current_user: User = Depends(get_current_user),
):
    if not url:
        raise HTTPException(status_code=422, detail="url is required")
    return {"data_uri": _build_qr_data_uri(url)}


@router.post("/printer-token/generate")
async def generate_printer_token_endpoint(
    organization_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Generate a new printer token for an organization
    Only accessible by organization director
    """
    # Check permissions (only director)
    if not current_user.is_director:
        if hasattr(current_user, "organization_id") and current_user.organization_id != organization_id:
            raise HTTPException(status_code=403, detail="Not enough permissions")
        raise HTTPException(status_code=403, detail="Director permissions required")

    org = db.query(Organization).filter(Organization.id == organization_id).first()
    if not org:
        raise HTTPException(status_code=404, detail="Organization not found")

    # Revoke previous active tokens for this org
    (
        db.query(PrinterAgent)
        .filter(PrinterAgent.organization_id == organization_id, PrinterAgent.is_active == True)
        .update({PrinterAgent.is_active: False})
    )
    db.commit()

    printer_token = generate_printer_token()
    agent = PrinterAgent(
        organization_id=organization_id,
        printer_token=printer_token,
        created_by_user_id=current_user.id,
        is_active=True,
    )
    db.add(agent)
    db.commit()

    return {
        "printer_token": printer_token,
        "organization_id": organization_id,
        "message": "Printer token generated successfully. Store it securely as it won't be shown again.",
        "usage_example": f"python printer_agent.py {printer_token} {organization_id}",
    }


@router.get("/printer-token/current")
async def get_current_printer_token(
    organization_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Get current printer token for an organization (masked)
    Only accessible for directors; returns masked token preview
    """
    if not current_user.is_director:
        if hasattr(current_user, "organization_id") and current_user.organization_id != organization_id:
            raise HTTPException(status_code=403, detail="Not enough permissions")
        raise HTTPException(status_code=403, detail="Director permissions required")

    org = db.query(Organization).filter(Organization.id == organization_id).first()
    if not org:
        raise HTTPException(status_code=404, detail="Organization not found")

    active_agent = (
        db.query(PrinterAgent)
        .filter(PrinterAgent.organization_id == organization_id, PrinterAgent.is_active == True)
        .order_by(PrinterAgent.created_at.desc())
        .first()
    )
    has_token = bool(active_agent and active_agent.printer_token)

    return {
        "organization_id": organization_id,
        "has_token": has_token,
        "token_preview": f"{active_agent.printer_token[:8]}..." if has_token else None,
        "message": "Use /printer-token/generate to create a new token if none exists",
    }


# Printers visibility & permissions for UI
@router.get("/connected")
async def get_connected_printers(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Список подключенных принтеров в организации (без фильтра прав).
    Используется, чтобы сотрудник мог выбрать принтер в настройках.
    """
    agent_ids_online = await _online_agent_ids(db, current_user.organization_id)
    if not agent_ids_online:
        return []

    q = (
        db.query(PrinterAgentPrinter)
        .join(PrinterAgent, PrinterAgentPrinter.agent_id == PrinterAgent.id)
        .filter(PrinterAgentPrinter.agent_id.in_(agent_ids_online))
        .filter(PrinterAgent.organization_id == current_user.organization_id)
    )

    printers = []
    for p in q.all():
        printers.append(
            {
                "id": p.id,
                "name": p.printer_name,
                "driver_name": p.driver_name,
                "port_name": p.port_name,
                "is_default": p.is_default,
                "agent_hostname": p.agent.hostname if p.agent else None,
            }
        )
    return printers


@router.get("/me/permissions")
async def get_my_printer_permissions(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Какие принтеры уже доступны конкретному пользователю.
    """
    q = (
        db.query(PrinterPermission)
        .join(PrinterAgentPrinter, PrinterPermission.printer_id == PrinterAgentPrinter.id)
        .join(PrinterAgent, PrinterAgentPrinter.agent_id == PrinterAgent.id)
        .filter(PrinterPermission.user_id == current_user.id)
        .filter(PrinterAgent.organization_id == current_user.organization_id)
    )

    out = []
    for perm in q.all():
        out.append(
            {
                "printer_id": perm.printer_id,
                "name": perm.printer.printer_name if perm.printer else None,
                "is_current": bool(getattr(perm, "is_current", False)),
                "label_width_mm": getattr(perm, "label_width_mm", None),
                "label_height_mm": getattr(perm, "label_height_mm", None),
            }
        )
    return out


@router.get("/me/label-print")
async def get_my_printers_for_label_print(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Принтеры для печати этикеток: из БД (права пользователя) + пометка онлайн по WebSocket агента.
    Не зависит только от моментального подключения агента — список не пропадает при кратком обрыве.
    """
    if not current_user.organization_id:
        return []

    agent_ids_online = set(await _online_agent_ids(db, current_user.organization_id))
    by_id: Dict[int, dict] = {}

    perm_rows = (
        db.query(PrinterPermission)
        .join(PrinterAgentPrinter, PrinterPermission.printer_id == PrinterAgentPrinter.id)
        .join(PrinterAgent, PrinterAgentPrinter.agent_id == PrinterAgent.id)
        .filter(PrinterPermission.user_id == current_user.id)
        .filter(PrinterAgent.organization_id == current_user.organization_id)
        .all()
    )

    for perm in perm_rows:
        p = perm.printer
        if not p:
            continue
        agent = (
            db.query(PrinterAgent)
            .filter(PrinterAgent.id == p.agent_id)
            .first()
        )
        by_id[p.id] = {
            "id": p.id,
            "name": p.printer_name,
            "is_default": bool(p.is_default),
            "is_current": bool(getattr(perm, "is_current", False)),
            "is_online": bool(agent and agent.id in agent_ids_online),
        }

    if agent_ids_online:
        online_rows = (
            db.query(PrinterAgentPrinter)
            .join(PrinterAgent, PrinterAgentPrinter.agent_id == PrinterAgent.id)
            .filter(PrinterAgentPrinter.agent_id.in_(agent_ids_online))
            .filter(PrinterAgent.organization_id == current_user.organization_id)
            .all()
        )
        for p in online_rows:
            if p.id in by_id:
                by_id[p.id]["is_online"] = True
            else:
                by_id[p.id] = {
                    "id": p.id,
                    "name": p.printer_name,
                    "is_default": bool(p.is_default),
                    "is_current": False,
                    "is_online": True,
                }

    items = list(by_id.values())
    items.sort(
        key=lambda row: (
            not row.get("is_current"),
            not row.get("is_online"),
            not row.get("is_default"),
            (row.get("name") or "").lower(),
        )
    )
    return items


@router.post("/id/{printer_id}/grant")
async def grant_printer_permission(
    printer_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    “Назначение права” на принтер через выбор на странице настроек организации.
    На данном этапе считаем, что у пользователя может быть один активный принтер,
    поэтому при выборе нового удаляем старые разрешения.
    """
    try:
        printer_id_int = int(printer_id)
    except Exception:
        raise HTTPException(status_code=422, detail="Invalid printer id")

    p = db.query(PrinterAgentPrinter).filter(PrinterAgentPrinter.id == printer_id_int).first()
    if not p:
        raise HTTPException(status_code=404, detail="Printer not found")

    agent = db.query(PrinterAgent).filter(PrinterAgent.id == p.agent_id).first()
    if not agent:
        raise HTTPException(status_code=404, detail="Agent not found")

    if not current_user.is_admin and current_user.organization_id != agent.organization_id:
        raise HTTPException(status_code=403, detail="Not enough permissions")

    await _ensure_agent_online(p.agent_id)

    # Один текущий принтер, но сохраняем остальные разрешения и их настройки.
    db.query(PrinterPermission).filter(PrinterPermission.user_id == current_user.id).update(
        {"is_current": False}
    )

    perm = (
        db.query(PrinterPermission)
        .filter(
            PrinterPermission.user_id == current_user.id,
            PrinterPermission.printer_id == p.id,
        )
        .first()
    )
    if not perm:
        perm = PrinterPermission(user_id=current_user.id, printer_id=p.id, is_current=True)
        db.add(perm)
    else:
        perm.is_current = True
    db.commit()

    return {"status": "success", "message": "Printer permission updated", "printer_id": p.id}


@router.put("/id/{printer_id}/label-settings")
async def update_label_settings_for_printer(
    printer_id: str,
    payload: dict,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Обновить персональные настройки этикетки для выбранного принтера (user, printer).
    """
    try:
        printer_id_int = int(printer_id)
    except Exception:
        raise HTTPException(status_code=422, detail="Invalid printer id")

    perm = (
        db.query(PrinterPermission)
        .filter(
            PrinterPermission.user_id == current_user.id,
            PrinterPermission.printer_id == printer_id_int,
        )
        .first()
    )
    if not perm:
        raise HTTPException(status_code=404, detail="No permission for this printer")

    w = payload.get("label_width_mm")
    h = payload.get("label_height_mm")
    try:
        w_int = int(w)
        h_int = int(h)
    except Exception:
        raise HTTPException(status_code=422, detail="Invalid label size")

    if w_int <= 0 or h_int <= 0:
        raise HTTPException(status_code=422, detail="Label size must be positive")

    perm.label_width_mm = w_int
    perm.label_height_mm = h_int
    db.commit()
    log_audit(
        db,
        event_type="printer_label_settings_updated",
        category="settings",
        summary=f"Этикетка принтера #{printer_id_int}: {w_int}×{h_int} мм",
        user=current_user,
        organization_id=current_user.organization_id,
        details={"printer_id": printer_id_int, "label_width_mm": w_int, "label_height_mm": h_int},
        entity_type="printer",
        entity_id=printer_id_int,
    )

    return {
        "printer_id": perm.printer_id,
        "label_width_mm": perm.label_width_mm,
        "label_height_mm": perm.label_height_mm,
    }


@router.websocket("/ws")
async def printer_websocket_endpoint(
    websocket: WebSocket,
    x_printer_token: str = Header(None, alias="X-Printer-Token"),
    x_organization_id: str = Header(None, alias="X-Organization-ID")
):
    """
    WebSocket endpoint for printer agents to connect and communicate
    Agents authenticate using organization printer tokens
    """
    db = next(get_db())

    if not x_printer_token or not x_organization_id:
        await websocket.close(code=4001, reason="Missing printer token or organization ID")
        return

    agent: PrinterAgent | None = await validate_printer_token(x_printer_token, x_organization_id, db)
    if not agent:
        await websocket.close(code=4002, reason="Invalid printer token or organization ID mismatch")
        return

    await websocket.accept()

    agent_id = agent.id
    hostname = None

    try:
        await printer_hub.register(agent_id, websocket)

        while True:
            data = await websocket.receive_text()
            try:
                message = json.loads(data)
                msg_type = message.get("type")

                if msg_type == "printer_list":
                    printer_data = message.get("data", {})
                    hostname = printer_data.get("hostname")
                    if not hostname:
                        await websocket.send_json({"type": "error", "message": "Hostname not provided"})
                        continue

                    printers = printer_data.get("printers", []) or []

                    # Обновляем агент (hostname/last_seen)
                    agent.hostname = hostname
                    agent.last_seen = datetime.utcnow()
                    db.commit()

                    # Upsert printers for this agent
                    director_user_id = agent.created_by_user_id
                    for pr in printers:
                        printer_name = (pr or {}).get("name")
                        if not printer_name:
                            continue

                        driver_name = (pr or {}).get("driver_name")
                        port_name = (pr or {}).get("port_name")
                        is_default = bool((pr or {}).get("default"))

                        row = (
                            db.query(PrinterAgentPrinter)
                            .filter(
                                PrinterAgentPrinter.agent_id == agent_id,
                                PrinterAgentPrinter.printer_name == printer_name,
                            )
                            .first()
                        )
                        if not row:
                            row = PrinterAgentPrinter(
                                agent_id=agent_id,
                                printer_name=printer_name,
                                driver_name=driver_name,
                                port_name=port_name,
                                is_default=is_default,
                            )
                            db.add(row)
                            db.flush()  # ensure row.id for permissions
                        else:
                            row.driver_name = driver_name
                            row.port_name = port_name
                            row.is_default = is_default

                        # На данном этапе директор получает права автоматически на свои принтеры,
                        # чтобы он мог начать печать сразу после подключения.
                        if director_user_id:
                            existing_perm = (
                                db.query(PrinterPermission)
                                .filter(
                                    PrinterPermission.user_id == director_user_id,
                                    PrinterPermission.printer_id == row.id,
                                )
                                .first()
                            )
                            if not existing_perm:
                                db.add(PrinterPermission(user_id=director_user_id, printer_id=row.id))

                    db.commit()
                    await printer_hub.touch(agent_id)

                    # Send acknowledgment
                    await websocket.send_json(
                        {
                            "type": "ack",
                            "message": f"Received {len(printers)} printer(s) from {hostname}",
                            "data": {
                                "printers_registered": len(printers),
                                "timestamp": datetime.utcnow().isoformat(),
                                "organization_id": agent.organization_id,
                            },
                        }
                    )

                elif msg_type == "print_status":
                    status_data = message.get("data", {})
                    job_id = status_data.get("job_id")

                    if job_id and job_id in print_jobs:
                        job = print_jobs[job_id]
                        job["status"] = status_data.get("status", "unknown")

                        if status_data.get("status") == "success":
                            job["completed_at"] = datetime.utcnow().isoformat()
                        elif status_data.get("status") == "error":
                            job["error_message"] = status_data.get("message")
                            job["completed_at"] = datetime.utcnow().isoformat()

                elif msg_type == "pong":
                    agent.last_seen = datetime.utcnow()
                    db.commit()
                    await printer_hub.touch(agent_id)

            except json.JSONDecodeError:
                await websocket.send_json({"type": "error", "message": "Invalid JSON format"})

    except WebSocketDisconnect:
        await printer_hub.unregister(agent_id)
        print(f"WebSocket disconnected for agent_id={agent_id} hostname={hostname}")

    except Exception as e:
        await printer_hub.unregister(agent_id)
        print(f"WebSocket error: {e}")
