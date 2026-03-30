from fastapi import APIRouter, WebSocket, WebSocketDisconnect, HTTPException, Depends, Header
from typing import Dict, List
from datetime import datetime, timedelta
import json
import base64
import io
from pathlib import Path
import tempfile
import subprocess
import sys
import qrcode
from app.core.auth import get_current_user
from app.core.config import settings
from app.models.user import User
from app.models.organization import Organization
from app.models.product import Product as ProductModel
from app.models.printer_agent import PrinterAgent
from app.models.printer_agent_printer import PrinterAgentPrinter
from app.models.printer_permission import PrinterPermission
from app.db.database import get_db
from sqlalchemy import and_
from sqlalchemy.orm import Session
import asyncio
import secrets
from jinja2 import Environment, FileSystemLoader, select_autoescape

router = APIRouter(prefix="/printers", tags=["printers"])

# Store active WebSocket connections and their printers in memory
# Key: agent_id, Value: {websocket, last_seen}
active_connections: Dict[int, dict] = {}

# Store print jobs in memory (for demo purposes)
print_jobs: Dict[int, dict] = {}
job_counter = 0

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
    agent_ids_online = list(active_connections.keys())
    if not agent_ids_online:
        return []

    user_org_id = None
    if not current_user.is_admin and hasattr(current_user, "organization_id"):
        user_org_id = current_user.organization_id

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
    agent_ids_online = list(active_connections.keys())
    if not agent_ids_online:
        return []

    user_org_id = None
    if not current_user.is_admin and hasattr(current_user, "organization_id"):
        user_org_id = current_user.organization_id

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
        "is_active": agent.id in active_connections,
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
    global job_counter

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

    websocket_data = active_connections.get(p.agent_id)
    if not websocket_data or not websocket_data.get("websocket"):
        raise HTTPException(
            status_code=400,
            detail="Printer agent is not connected. Please ensure the agent is running.",
        )

    websocket = websocket_data["websocket"]

    # Create print job in memory
    job_counter += 1
    job_id = job_counter

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
        await websocket.send_json(print_command)

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
    Печать пробной этикетки по HTML-шаблону label_print.html, как PDF.
    """
    global job_counter
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

    websocket_data = active_connections.get(p.agent_id)
    if not websocket_data or not websocket_data.get("websocket"):
        raise HTTPException(status_code=400, detail="Printer agent is not connected. Please ensure the agent is running.")

    width_mm = int(getattr(perm, "label_width_mm", 58) if perm else 58)
    height_mm = int(getattr(perm, "label_height_mm", 38) if perm else 38)

    tmpl = _templates_env.get_template("label_print.html")
    html = tmpl.render(
        label_width_mm=width_mm,
        label_height_mm=height_mm,
        brand="BOSCH",
        article="0 986 479 123",
        storage_address="A-01-02-03",
        name="Тормозные колодки передние",
        internal_code="INT-0000123",
        price="1 250 ₽",
    )

    pdf_bytes = _html_to_pdf_bytes(html, width_mm=width_mm, height_mm=height_mm)
    pdf_b64 = base64.b64encode(pdf_bytes).decode("ascii")

    job_counter += 1
    job_id = job_counter
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
        await websocket_data["websocket"].send_json(print_command)
        print_jobs[job_id]["status"] = "printing"
        print_jobs[job_id]["started_at"] = datetime.utcnow().isoformat()
        return {"status": "success", "message": "Test label sent", "job_id": job_id}
    except Exception as e:
        print_jobs[job_id]["status"] = "failed"
        print_jobs[job_id]["error_message"] = str(e)
        raise HTTPException(status_code=500, detail=f"Failed to send print command: {str(e)}")


@router.post("/id/{printer_id}/print-label")
async def print_product_label(
    printer_id: str,
    payload: dict,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Печать этикетки товара по HTML-шаблону label_print.html, как PDF.
    """
    global job_counter
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

    websocket_data = active_connections.get(p.agent_id)
    if not websocket_data or not websocket_data.get("websocket"):
        raise HTTPException(status_code=400, detail="Printer agent is not connected. Please ensure the agent is running.")

    # Get label settings from permission or use defaults
    width_mm = int(getattr(perm, "label_width_mm", payload.get("width_mm", 58)))
    height_mm = int(getattr(perm, "label_height_mm", payload.get("height_mm", 38)))

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

    # Extract product data from payload
    brand = payload.get("brand", "—")
    article = payload.get("article", "—")
    storage_address = payload.get("storage_address", "—")
    name = payload.get("name", "—")
    internal_code = payload.get("internal_code", "—")
    price = payload.get("price", "—")
    base_url = (settings.PUBLIC_BASE_URL or "").rstrip("/")
    qr_url = f"{base_url}/seller/part-card/{product_id}" if base_url else f"/seller/part-card/{product_id}"
    qr_data_uri = _build_qr_data_uri(qr_url)

    tmpl = _templates_env.get_template("label_print.html")
    html = tmpl.render(
        label_width_mm=width_mm,
        label_height_mm=height_mm,
        brand=brand,
        article=article,
        storage_address=storage_address,
        name=name,
        internal_code=internal_code,
        price=price,
        qr_data_uri=qr_data_uri,
    )

    pdf_bytes = _html_to_pdf_bytes(html, width_mm=width_mm, height_mm=height_mm)
    pdf_b64 = base64.b64encode(pdf_bytes).decode("ascii")

    copies = int(payload.get("copies", 1))

    job_counter += 1
    job_id = job_counter
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
        await websocket_data["websocket"].send_json(print_command)
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
    agent_ids_online = list(active_connections.keys())
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

    if not active_connections.get(p.agent_id):
        raise HTTPException(status_code=400, detail="Printer agent is not connected")

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
        # Поднимаем “онлайн” состояние агента для роутинга print job
        active_connections[agent_id] = {
            "websocket": websocket,
            "last_seen": datetime.utcnow().isoformat(),
        }

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
                    # обновляем last_seen в памяти тоже
                    if agent_id in active_connections:
                        active_connections[agent_id]["last_seen"] = datetime.utcnow().isoformat()

            except json.JSONDecodeError:
                await websocket.send_json({"type": "error", "message": "Invalid JSON format"})

    except WebSocketDisconnect:
        if agent_id in active_connections:
            del active_connections[agent_id]
        print(f"WebSocket disconnected for agent_id={agent_id} hostname={hostname}")

    except Exception as e:
        if agent_id in active_connections:
            del active_connections[agent_id]
        print(f"WebSocket error: {e}")
