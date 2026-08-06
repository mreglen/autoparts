"""Публичный вебхук Avito Messenger (без JWT)."""

from __future__ import annotations

import logging
import secrets
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
    """(avito_account_user_id, chat_id_str, preview_text). user_id — как в OrganizationAvitoIntegration.avito_user_id."""
    val = _value_dict(body)

    def _uid_from_mapping(m: dict[str, Any]) -> Optional[int]:
        if not m:
            return None
        for key in (
            "user_id",
            "account_user_id",
            "account_id",
            "owner_id",
            "author_id",
            "avito_user_id",
            "recipient_id",
        ):
            u = _as_int(m.get(key))
            if u is not None:
                return u
        for nest_key in ("user", "author", "account", "recipient", "seller", "buyer"):
            nested = m.get(nest_key)
            if isinstance(nested, dict):
                u = _as_int(nested.get("id") or nested.get("user_id"))
                if u is not None:
                    return u
        return None

    uid = _uid_from_mapping(val) if isinstance(val, dict) else None
    if uid is None:
        uid = _uid_from_mapping(body)
    cid = val.get("chat_id") if val else None
    if cid is None:
        cid = val.get("chatId") if val else None
    if cid is None and isinstance(body.get("chat_id"), (str, int)):
        cid = body.get("chat_id")
    chat_id_str = str(cid) if cid is not None else None

    preview = ""
    cont = val.get("content") if val else None
    if isinstance(cont, dict):
        preview = str(cont.get("text") or "")[:200]
    return uid, chat_id_str, preview


def _check_webhook_secret(request: Request, query_secret: Optional[str]) -> None:
    secret = (settings.AVITO_WEBHOOK_SECRET or "").strip()
    if not secret:
        logger.error("Avito webhook rejected because AVITO_WEBHOOK_SECRET is not configured")
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Webhook is not configured",
        )
    if query_secret and secrets.compare_digest(query_secret, secret):
        return
    hdr = request.headers.get("X-Webhook-Secret")
    if hdr and secrets.compare_digest(hdr, secret):
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
        top = list(body.keys())[:20]
        val = _value_dict(body)
        inner_keys = list(val.keys())[:25] if isinstance(val, dict) else type(val).__name__
        logger.warning(
            "Avito webhook: could not resolve user_id (body keys=%s; value keys=%s)",
            top,
            inner_keys,
        )
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
