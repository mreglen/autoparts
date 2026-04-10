import logging
from typing import Any, Optional

import httpx

from app.services.avito_api import AVITO_BASE

logger = logging.getLogger(__name__)


class AvitoMessengerError(RuntimeError):
    pass


async def _request_with_candidates(
    *,
    method: str,
    access_token: str,
    candidates: list[str],
    params: Optional[dict[str, Any]] = None,
    json_body: Optional[dict[str, Any]] = None,
    timeout_s: float = 45.0,
) -> tuple[int, Any]:
    headers = {"Authorization": f"Bearer {access_token}"}
    last_status = 0
    last_body: Any = None
    last_url = ""

    async with httpx.AsyncClient(timeout=timeout_s) as client:
        for path in candidates:
            url = f"{AVITO_BASE}{path}"
            last_url = url
            response = await client.request(
                method=method.upper(),
                url=url,
                headers=headers,
                params=params,
                json=json_body,
            )
            last_status = response.status_code
            try:
                last_body = response.json()
            except Exception:
                last_body = {"raw": response.text[:8000]}

            if response.status_code in (404, 405):
                continue
            return response.status_code, last_body

    return last_status, {"error": last_body, "url": last_url}


def _extract_list(data: Any) -> list[dict[str, Any]]:
    if isinstance(data, list):
        return [x for x in data if isinstance(x, dict)]
    if not isinstance(data, dict):
        return []
    for key in ("chats", "messages", "items", "result", "data"):
        val = data.get(key)
        if isinstance(val, list):
            return [x for x in val if isinstance(x, dict)]
    return []


def normalize_chat(chat: dict[str, Any], idx: int) -> dict[str, Any]:
    chat_id = (
        chat.get("id")
        or chat.get("chat_id")
        or chat.get("chatId")
        or chat.get("conversation_id")
        or f"chat_{idx}"
    )
    context = chat.get("context") if isinstance(chat.get("context"), dict) else {}
    context_value = context.get("value") if isinstance(context.get("value"), dict) else {}
    last_message = chat.get("last_message") if isinstance(chat.get("last_message"), dict) else {}
    users = chat.get("users") if isinstance(chat.get("users"), list) else []
    first_user = users[0] if users and isinstance(users[0], dict) else {}

    return {
        "id": str(chat_id),
        "title": (
            chat.get("title")
            or first_user.get("name")
            or first_user.get("title")
            or f"Чат {chat_id}"
        ),
        "avatar_url": chat.get("avatar_url") or chat.get("image"),
        "last_message_text": (
            last_message.get("content", {}).get("text")
            if isinstance(last_message.get("content"), dict)
            else last_message.get("text")
        )
        or chat.get("last_message_text")
        or "",
        "last_message_created_at": last_message.get("created")
        or last_message.get("created_at")
        or chat.get("updated")
        or chat.get("updated_at"),
        "unread_count": int(chat.get("unread") or chat.get("unread_count") or 0),
        "context_type": context.get("type"),
        "context_id": context_value.get("id") or context.get("id"),
        "raw": chat,
    }


def normalize_message(msg: dict[str, Any], idx: int) -> dict[str, Any]:
    msg_id = msg.get("id") or msg.get("message_id") or msg.get("uuid") or f"msg_{idx}"
    author = msg.get("author") if isinstance(msg.get("author"), dict) else {}
    content = msg.get("content") if isinstance(msg.get("content"), dict) else {}
    return {
        "id": str(msg_id),
        "chat_id": str(msg.get("chat_id") or msg.get("chatId") or ""),
        "sender_id": str(author.get("id") or msg.get("user_id") or msg.get("sender_id") or ""),
        "sender_name": author.get("name") or msg.get("sender_name"),
        "message": content.get("text") or msg.get("text") or msg.get("message") or "",
        "created_at": msg.get("created") or msg.get("created_at"),
        "is_read": bool(msg.get("is_read") or msg.get("read")),
        "direction": msg.get("direction"),
        "raw": msg,
    }


async def list_chats(access_token: str, user_id: int) -> list[dict[str, Any]]:
    status, data = await _request_with_candidates(
        method="GET",
        access_token=access_token,
        candidates=[
            f"/messenger/v3/accounts/{user_id}/chats",
            f"/messenger/v2/accounts/{user_id}/chats",
            f"/messenger/v1/accounts/{user_id}/chats",
        ],
        params={"limit": 100},
    )
    if status != 200:
        raise AvitoMessengerError(f"Avito chats error (HTTP {status}): {data}")
    chats = _extract_list(data)
    return [normalize_chat(chat, idx) for idx, chat in enumerate(chats)]


async def get_chat_messages(access_token: str, user_id: int, chat_id: str) -> list[dict[str, Any]]:
    status, data = await _request_with_candidates(
        method="GET",
        access_token=access_token,
        candidates=[
            f"/messenger/v3/accounts/{user_id}/chats/{chat_id}/messages",
            f"/messenger/v2/accounts/{user_id}/chats/{chat_id}/messages",
            f"/messenger/v1/accounts/{user_id}/chats/{chat_id}/messages",
        ],
        params={"limit": 100},
    )
    if status != 200:
        raise AvitoMessengerError(f"Avito messages error (HTTP {status}): {data}")
    messages = _extract_list(data)
    normalized = [normalize_message(msg, idx) for idx, msg in enumerate(messages)]
    normalized.sort(key=lambda x: (x.get("created_at") or "", x["id"]))
    return normalized


async def send_chat_message(access_token: str, user_id: int, chat_id: str, text: str) -> dict[str, Any]:
    payload = {"message": {"text": text}}
    status, data = await _request_with_candidates(
        method="POST",
        access_token=access_token,
        candidates=[
            f"/messenger/v3/accounts/{user_id}/chats/{chat_id}/messages",
            f"/messenger/v2/accounts/{user_id}/chats/{chat_id}/messages",
            f"/messenger/v1/accounts/{user_id}/chats/{chat_id}/messages",
        ],
        json_body=payload,
    )
    if status not in (200, 201):
        raise AvitoMessengerError(f"Avito send message error (HTTP {status}): {data}")
    if isinstance(data, dict):
        return data
    return {"result": data}
