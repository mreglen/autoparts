from urllib.parse import quote

from fastapi import APIRouter, Depends, File, HTTPException, Query, UploadFile, status
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.core.auth import get_current_user
from app.core.config import settings
from app.db.database import get_db
from app.models.organization_avito_integration import OrganizationAvitoIntegration
from app.models.user import User
from app.services.avito_api import fetch_access_token
from app.services.avito_messenger_api import (
    AvitoMessengerError,
    get_chat_detail,
    get_chat_messages,
    list_chats,
    mark_chat_read,
    send_chat_image_message,
    send_chat_message,
    send_chat_voice_message,
    subscribe_messenger_webhook,
    upload_messenger_image,
    upload_messenger_voice,
)
from app.utils.avito_crypto import decrypt_secret

# Префикс без повторного /api: api_router уже монтируется с prefix="/api" → итог /api/avito/messenger/...
router = APIRouter(prefix="/avito/messenger", tags=["Avito Messenger"])


class AvitoSendMessageRequest(BaseModel):
    message: str = Field(..., min_length=1, max_length=4000)


class AvitoSendImageRequest(BaseModel):
    image_id: str = Field(..., min_length=1, max_length=256)


class AvitoSendVoiceRequest(BaseModel):
    voice_id: str = Field(..., min_length=1, max_length=256)


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
        return {"enabled": False, "avito_user_id": None}
    row = db.query(OrganizationAvitoIntegration).filter(
        OrganizationAvitoIntegration.organization_id == current_user.organization_id
    ).first()
    enabled = bool(row and row.enabled and row.client_id and row.client_secret_encrypted and row.avito_user_id)
    avito_uid = int(row.avito_user_id) if row and row.avito_user_id is not None else None
    return {"enabled": enabled, "avito_user_id": avito_uid}


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


@router.get("/chats/{chat_id}/product-link")
async def get_avito_chat_product_link(
    chat_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Check if Avito chat is linked to an internal product via product_avito_listing_links."""
    if not current_user.organization_id:
        return {"linked": False, "product_id": None}
    
    # Get chat detail to extract context_id (Avito ad ID)
    try:
        token, avito_user_id = await _get_access_token_for_user(db, current_user)
        chat_detail = await get_chat_detail(token, avito_user_id, chat_id)
        context_id = chat_detail.get("context_id")
        
        if not context_id:
            return {"linked": False, "product_id": None}
        
        # Check if this Avito ad ID is linked to any internal product
        from app.models.product_avito_listing_link import ProductAvitoListingLink
        link = db.query(ProductAvitoListingLink).filter(
            ProductAvitoListingLink.organization_id == current_user.organization_id,
            ProductAvitoListingLink.avito_ad_id == str(context_id)
        ).first()
        
        if link:
            return {"linked": True, "product_id": link.product_id}
        return {"linked": False, "product_id": None}
    except Exception as exc:
        return {"linked": False, "product_id": None, "error": str(exc)}


@router.get("/chats/{chat_id}")
async def get_avito_chat_detail(
    chat_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Прокси к GET …/messenger/v2/accounts/{user_id}/chats/{chat_id} (Avito API)."""
    token, avito_user_id = await _get_access_token_for_user(db, current_user)
    try:
        chat = await get_chat_detail(token, avito_user_id, chat_id)
        return {"chat": chat}
    except AvitoMessengerError as exc:
        raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail=str(exc))


@router.get("/chats/{chat_id}/messages")
async def get_avito_chat_messages(
    chat_id: str,
    mark_read: bool = Query(
        True,
        description="После загрузки списка (v3 не помечает прочитанным) вызвать POST …/read",
    ),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    token, avito_user_id = await _get_access_token_for_user(db, current_user)
    try:
        messages = await get_chat_messages(token, avito_user_id, chat_id)
        if mark_read:
            await mark_chat_read(token, avito_user_id, chat_id)
        return {"messages": messages}
    except AvitoMessengerError as exc:
        raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail=str(exc))


@router.post("/chats/{chat_id}/mark-read")
async def mark_avito_chat_read(
    chat_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Пометить чат Авито как прочитанный"""
    token, avito_user_id = await _get_access_token_for_user(db, current_user)
    try:
        result = await mark_chat_read(token, avito_user_id, chat_id)
        return {"ok": result}
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


@router.post("/chats/{chat_id}/upload-image")
async def post_avito_upload_image(
    chat_id: str,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _ = chat_id
    token, avito_user_id = await _get_access_token_for_user(db, current_user)
    raw = await file.read()
    if len(raw) > 15 * 1024 * 1024:
        raise HTTPException(status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE, detail="Файл больше 15 МБ")
    ct = file.content_type or "image/jpeg"
    try:
        image_id = await upload_messenger_image(token, avito_user_id, raw, file.filename or "image.jpg", ct)
        return {"ok": True, "image_id": image_id}
    except AvitoMessengerError as exc:
        raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail=str(exc))


@router.post("/chats/{chat_id}/messages/image")
async def post_avito_chat_image_message(
    chat_id: str,
    body: AvitoSendImageRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    token, avito_user_id = await _get_access_token_for_user(db, current_user)
    try:
        result = await send_chat_image_message(token, avito_user_id, chat_id, body.image_id.strip())
        return {"ok": True, "result": result}
    except AvitoMessengerError as exc:
        raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail=str(exc))


@router.post("/chats/{chat_id}/upload-voice")
async def post_avito_upload_voice(
    chat_id: str,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _ = chat_id
    token, avito_user_id = await _get_access_token_for_user(db, current_user)
    raw = await file.read()
    if len(raw) > 10 * 1024 * 1024:
        raise HTTPException(status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE, detail="Файл больше 10 МБ")
    ct = file.content_type or "audio/webm"
    fn = file.filename or "voice.webm"
    try:
        voice_id = await upload_messenger_voice(token, avito_user_id, raw, fn, ct)
        return {"ok": True, "voice_id": voice_id}
    except AvitoMessengerError as exc:
        raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail=str(exc))


@router.post("/chats/{chat_id}/messages/voice")
async def post_avito_chat_voice_message(
    chat_id: str,
    body: AvitoSendVoiceRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    token, avito_user_id = await _get_access_token_for_user(db, current_user)
    try:
        result = await send_chat_voice_message(token, avito_user_id, chat_id, body.voice_id.strip())
        return {"ok": True, "result": result}
    except AvitoMessengerError as exc:
        raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail=str(exc))


@router.post("/webhook/subscribe")
async def post_avito_subscribe_messenger_webhook(
    url: str | None = Query(
        None,
        max_length=2048,
        description="Полный URL вебхука; если не указан — PUBLIC_BASE_URL + /webhooks/avito/messenger",
    ),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Регистрация URL в Avito POST /messenger/v3/webhook (тот же access token, что и для чатов)."""
    token, _ = await _get_access_token_for_user(db, current_user)
    base = (settings.PUBLIC_BASE_URL or settings.BASE_URL or "").rstrip("/")
    if not base:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Задайте PUBLIC_BASE_URL в .env для URL вебхука",
        )
    hook_url = (url.strip() if url else f"{base}/webhooks/avito/messenger")
    if settings.AVITO_WEBHOOK_SECRET:
        sep = "&" if "?" in hook_url else "?"
        hook_url = f"{hook_url}{sep}secret={quote(str(settings.AVITO_WEBHOOK_SECRET), safe='')}"
    try:
        result = await subscribe_messenger_webhook(token, hook_url)
        return {"ok": True, "url": hook_url, "result": result}
    except AvitoMessengerError as exc:
        raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail=str(exc))
