from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.core.auth import get_current_user
from app.db.database import get_db
from app.models.organization_avito_integration import OrganizationAvitoIntegration
from app.models.user import User
from app.services.avito_api import fetch_access_token
from app.services.avito_messenger_api import (
    AvitoMessengerError,
    get_chat_messages,
    list_chats,
    send_chat_message,
)
from app.utils.avito_crypto import decrypt_secret

router = APIRouter(prefix="/api/avito/messenger", tags=["Avito Messenger"])


class AvitoSendMessageRequest(BaseModel):
    message: str = Field(..., min_length=1, max_length=4000)


def _get_org_integration_or_raise(db: Session, current_user: User) -> OrganizationAvitoIntegration:
    if not current_user.organization_id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Пользователь не привязан к организации")

    row = db.query(OrganizationAvitoIntegration).filter(
        OrganizationAvitoIntegration.organization_id == current_user.organization_id
    ).first()
    if not row or not row.client_id or not row.client_secret_encrypted or not row.avito_user_id:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Интеграция Авито не настроена")
    return row


async def _get_access_token_for_user(db: Session, current_user: User) -> tuple[str, int]:
    row = _get_org_integration_or_raise(db, current_user)
    try:
        secret = decrypt_secret(row.client_secret_encrypted)
        token = await fetch_access_token(row.client_id, secret)
        return token, int(row.avito_user_id)
    except Exception as exc:
        raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail=f"Ошибка авторизации Avito: {exc}")


@router.get("/enabled")
async def avito_messenger_enabled(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if not current_user.organization_id:
        return {"enabled": False}
    row = db.query(OrganizationAvitoIntegration).filter(
        OrganizationAvitoIntegration.organization_id == current_user.organization_id
    ).first()
    enabled = bool(row and row.client_id and row.client_secret_encrypted and row.avito_user_id)
    return {"enabled": enabled}


@router.get("/chats")
async def get_avito_chats(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    token, avito_user_id = await _get_access_token_for_user(db, current_user)
    try:
        chats = await list_chats(token, avito_user_id)
        return {"chats": chats, "total": len(chats)}
    except AvitoMessengerError as exc:
        raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail=str(exc))


@router.get("/chats/{chat_id}/messages")
async def get_avito_chat_messages(
    chat_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    token, avito_user_id = await _get_access_token_for_user(db, current_user)
    try:
        messages = await get_chat_messages(token, avito_user_id, chat_id)
        return {"messages": messages}
    except AvitoMessengerError as exc:
        raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail=str(exc))


@router.post("/chats/{chat_id}/messages")
async def post_avito_chat_message(
    chat_id: str,
    body: AvitoSendMessageRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    token, avito_user_id = await _get_access_token_for_user(db, current_user)
    try:
        result = await send_chat_message(token, avito_user_id, chat_id, body.message.strip())
        return {"ok": True, "result": result}
    except AvitoMessengerError as exc:
        raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail=str(exc))
