"""Публичный вебхук Avito Messenger (без JWT)."""

from __future__ import annotations

import logging
from typing import Any, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from sqlalchemy.orm import Session

from app.core.config import settings
from app.db.database import get_db
from app.models.organization_avito_integration import OrganizationAvitoIntegration
from app.routers.websocket import manager

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/webhooks/avito", tags=["Avito webhooks"])


def _as_int(val: Any) -> Optional[int]:
    if val is None:
        return None
    try:
        return int(val)
    except (TypeError, ValueError):
        return None


def _value_dict(body: dict[str, Any]) -> dict[str, Any]:
    pl = body.get("payload")
    if isinstance(pl, dict):
        v = pl.get("value")
        if isinstance(v, dict):
            return v
    v2 = body.get("value")
    if isinstance(v2, dict):
        return v2
    return {}


def parse_messenger_webhook(body: dict[str, Any]) -> tuple[Optional[int], Optional[str], str]:
    """(avito_account_user_id, chat_id_str, preview_text)."""
    val = _value_dict(body)
    uid = _as_int(val.get("user_id") or val.get("account_user_id") or val.get("author_id"))
    if uid is None:
        uid = _as_int(body.get("user_id"))
    cid = val.get("chat_id") if val else None
    if cid is None:
        cid = val.get("chatId") if val else None
    chat_id_str = str(cid) if cid is not None else None

    preview = ""
    cont = val.get("content") if val else None
    if isinstance(cont, dict):
        preview = str(cont.get("text") or "")[:200]
    return uid, chat_id_str, preview


def _check_webhook_secret(request: Request, query_secret: Optional[str]) -> None:
    secret = settings.AVITO_WEBHOOK_SECRET
    if not secret:
        return
    if query_secret == secret:
        return
    hdr = request.headers.get("X-Webhook-Secret")
    if hdr == secret:
        return
    raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Invalid webhook secret")


@router.post("/messenger")
async def avito_messenger_webhook(
    request: Request,
    db: Session = Depends(get_db),
    secret: Optional[str] = Query(None, description="Если задан AVITO_WEBHOOK_SECRET — должен совпадать"),
):
    _check_webhook_secret(request, secret)
    try:
        body = await request.json()
    except Exception:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Expected JSON body")
    if not isinstance(body, dict):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Expected JSON object")

    avito_uid, chat_id, preview = parse_messenger_webhook(body)
    if avito_uid is None:
        logger.debug("Avito webhook: no user_id in payload keys=%s", list(body.keys())[:20])
        return {"ok": True, "ignored": True}

    row = (
        db.query(OrganizationAvitoIntegration)
        .filter(OrganizationAvitoIntegration.avito_user_id == avito_uid)
        .first()
    )
    if not row:
        logger.info("Avito webhook: no integration for avito_user_id=%s", avito_uid)
        return {"ok": True, "ignored": True}

    org_id = str(row.organization_id)

    ws_payload = {
        "type": "avito_messenger_refresh",
        "avito_chat_id": chat_id,
        "organization_id": org_id,
    }
    await manager.broadcast_to_organization(
        org_id,
        ws_payload,
        db,
        push_title="Сообщение Avito",
        push_body=preview or "Новое сообщение в чате Авито",
    )
    return {"ok": True}
