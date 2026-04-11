import logging
from datetime import datetime, timezone
from typing import Any, Optional

import httpx

from app.services.avito_api import AVITO_BASE

logger = logging.getLogger(__name__)

# GET сообщений: v3 первым, затем v2/v1 если v3 пустой или недоступен. Real-time — вебхуки → наш WS/push.
# Остальное (read, upload, send): см. каталог Messenger API / avito-api.


class AvitoMessengerError(RuntimeError):
    pass


def _coerce_created(val: Any) -> Any:
    if val is None:
        return None
    if isinstance(val, (int, float)):
        try:
            return datetime.fromtimestamp(int(val), tz=timezone.utc).strftime("%Y-%m-%dT%H:%M:%S+00:00")
        except (OSError, ValueError, OverflowError):
            return str(val)
    return val


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


async def _post_once(
    access_token: str,
    path: str,
    *,
    json_body: Optional[dict[str, Any]] = None,
    timeout_s: float = 60.0,
) -> tuple[int, Any]:
    url = f"{AVITO_BASE}{path}"
    headers = {"Authorization": f"Bearer {access_token}"}
    async with httpx.AsyncClient(timeout=timeout_s) as client:
        response = await client.post(url, headers=headers, json=json_body)
    status = response.status_code
    try:
        body: Any = response.json()
    except Exception:
        body = {"raw": response.text[:8000]}
    return status, body


async def _post_empty(access_token: str, path: str, timeout_s: float = 30.0) -> tuple[int, Any]:
    url = f"{AVITO_BASE}{path}"
    headers = {"Authorization": f"Bearer {access_token}"}
    async with httpx.AsyncClient(timeout=timeout_s) as client:
        response = await client.post(url, headers=headers)
    status = response.status_code
    try:
        body: Any = response.json() if response.content else {}
    except Exception:
        body = {"raw": response.text[:2000]}
    return status, body


def _extract_chat_payload(data: Any) -> dict[str, Any]:
    if isinstance(data, dict):
        inner = data.get("chat")
        if isinstance(inner, dict):
            return inner
        return data
    raise AvitoMessengerError(f"Неожиданный ответ чата: {type(data).__name__}")


def _extract_list(data: Any) -> list[dict[str, Any]]:
    if isinstance(data, list):
        return [x for x in data if isinstance(x, dict)]
    if not isinstance(data, dict):
        return []
    for key in ("chats", "messages", "items", "result", "data", "elements", "values"):
        val = data.get(key)
        if isinstance(val, list):
            return [x for x in val if isinstance(x, dict)]
    return []


def _extract_messages_response(data: Any) -> list[dict[str, Any]]:
    """Сообщения: сначала ключ messages (не путать с chats в составном JSON), затем корень-массив, затем прочие ключи."""
    if isinstance(data, dict) and "messages" in data:
        inner = data.get("messages")
        if isinstance(inner, list):
            return [x for x in inner if isinstance(x, dict)]
    if isinstance(data, list):
        return [x for x in data if isinstance(x, dict)]
    msgs = _extract_list(data)
    if msgs:
        return msgs
    return []


def _image_urls_from_content(content: dict[str, Any]) -> list[str]:
    img = content.get("image")
    if not isinstance(img, dict):
        return []
    sizes = img.get("sizes")
    if isinstance(sizes, dict):
        urls = [u for u in sizes.values() if isinstance(u, str) and u.startswith("http")]
        return sorted(urls, key=len, reverse=True)
    return []


def _voice_id_from_content(content: dict[str, Any]) -> Optional[str]:
    v = content.get("voice")
    if isinstance(v, dict):
        vid = v.get("voice_id") or v.get("id")
        if vid is not None:
            return str(vid)
    return None


def _context_image_url(context_value: dict[str, Any]) -> Optional[str]:
    images = context_value.get("images")
    if not isinstance(images, dict):
        return None
    main = images.get("main")
    if isinstance(main, dict):
        for key in ("140x105", "1280x960", "432x324"):
            url = main.get(key)
            if isinstance(url, str) and url:
                return url
        for v in main.values():
            if isinstance(v, str) and v.startswith("http"):
                return v
    return None


def normalize_chat(
    chat: dict[str, Any], idx: int, *, account_user_id: Optional[int] = None
) -> dict[str, Any]:
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
    participants: list[dict[str, str]] = []
    for u in users:
        if isinstance(u, dict):
            uid = u.get("id")
            participants.append(
                {
                    "id": str(uid) if uid is not None else "",
                    "name": str(u.get("name") or u.get("title") or "").strip(),
                }
            )

    loc = context_value.get("location") if isinstance(context_value.get("location"), dict) else {}
    location_title = loc.get("title") if isinstance(loc.get("title"), str) else None

    last_message_is_mine = False
    if isinstance(last_message, dict):
        lm_dir = last_message.get("direction")
        if lm_dir in ("out", "OUT", "outgoing"):
            last_message_is_mine = True
        elif lm_dir not in ("in", "IN", "incoming") and account_user_id is not None:
            la = last_message.get("author") if isinstance(last_message.get("author"), dict) else {}
            last_author_id = la.get("id") or last_message.get("author_id")
            if last_author_id is not None:
                try:
                    last_message_is_mine = int(last_author_id) == int(account_user_id)
                except (TypeError, ValueError):
                    last_message_is_mine = False

    return {
        "id": str(chat_id),
        "title": (
            chat.get("title")
            or context_value.get("title")
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
        "last_message_created_at": _coerce_created(
            last_message.get("created") or last_message.get("created_at") or chat.get("updated") or chat.get("updated_at")
        ),
        "unread_count": int(chat.get("unread") or chat.get("unread_count") or 0),
        "context_type": context.get("type"),
        "context_id": context_value.get("id") or context.get("id"),
        "context_title": context_value.get("title") if isinstance(context_value.get("title"), str) else None,
        "context_url": context_value.get("url") if isinstance(context_value.get("url"), str) else None,
        "context_price": context_value.get("price_string") if isinstance(context_value.get("price_string"), str) else None,
        "context_image_url": _context_image_url(context_value),
        "context_location": location_title,
        "participants": participants,
        "created_at": _coerce_created(chat.get("created") or chat.get("created_at")),
        "updated_at": _coerce_created(chat.get("updated") or chat.get("updated_at")),
        "last_message_is_mine": last_message_is_mine,
        "raw": chat,
    }


def normalize_message(
    msg: dict[str, Any], idx: int, *, account_user_id: Optional[int] = None
) -> dict[str, Any]:
    msg_id = msg.get("id") or msg.get("message_id") or msg.get("uuid") or f"msg_{idx}"
    author = msg.get("author") if isinstance(msg.get("author"), dict) else {}
    content = msg.get("content") if isinstance(msg.get("content"), dict) else {}
    sender_raw = author.get("id") or msg.get("author_id") or msg.get("user_id") or msg.get("sender_id")

    msg_type_raw = msg.get("type") or "text"
    message_type = str(msg_type_raw).lower() if msg_type_raw else "text"

    text_body = content.get("text") or msg.get("text") or msg.get("message") or ""
    if message_type == "link" and isinstance(content.get("link"), dict):
        link = content["link"]
        text_body = str(link.get("text") or link.get("url") or text_body)
    if message_type == "item" and isinstance(content.get("item"), dict):
        it = content["item"]
        text_body = str(it.get("title") or text_body)

    image_urls = _image_urls_from_content(content)
    voice_id = _voice_id_from_content(content)

    direction = msg.get("direction")
    is_outgoing = False
    if direction in ("out", "OUT", "outgoing"):
        is_outgoing = True
    elif direction in ("in", "IN", "incoming"):
        is_outgoing = False
    elif account_user_id is not None and sender_raw is not None:
        try:
            is_outgoing = int(sender_raw) == int(account_user_id)
        except (TypeError, ValueError):
            is_outgoing = False

    created = _coerce_created(msg.get("created") or msg.get("created_at"))

    return {
        "id": str(msg_id),
        "chat_id": str(msg.get("chat_id") or msg.get("chatId") or ""),
        "sender_id": str(sender_raw) if sender_raw is not None else "",
        "sender_name": author.get("name") or msg.get("sender_name"),
        "message": text_body if message_type in ("text", "link", "item", "system", "deleted") else "",
        "message_type": message_type,
        "image_urls": image_urls,
        "image_url": image_urls[0] if image_urls else None,
        "voice_id": voice_id,
        "voice_url": None,
        "created_at": created,
        "is_read": bool(msg.get("is_read") or msg.get("read")),
        "direction": direction,
        "is_outgoing": is_outgoing,
        "raw": msg,
    }


def _sort_message_key(row: dict[str, Any]) -> tuple:
    c = row.get("created_at")
    if isinstance(c, str) and c:
        return (c, row["id"])
    return (str(c or ""), row["id"])


async def get_voice_file_urls(access_token: str, user_id: int, voice_ids: list[str]) -> dict[str, str]:
    if not voice_ids:
        return {}
    status, data = await _request_with_candidates(
        method="GET",
        access_token=access_token,
        candidates=[f"/messenger/v1/accounts/{user_id}/getVoiceFiles"],
        params={"voice_ids": ",".join(voice_ids)},
    )
    if status != 200 or not isinstance(data, dict):
        logger.warning("Avito getVoiceFiles HTTP %s: %s", status, data)
        return {}
    vu = data.get("voices_urls")
    if not isinstance(vu, dict):
        return {}
    return {str(k): str(v) for k, v in vu.items() if isinstance(v, str)}


async def list_chats(access_token: str, user_id: int) -> list[dict[str, Any]]:
    """Сначала v3 (как в актуальном API); иначе при HTTP 200 от v2 с пустым списком v3 никогда не вызывался."""
    status, data = await _request_with_candidates(
        method="GET",
        access_token=access_token,
        candidates=[
            f"/messenger/v3/accounts/{user_id}/chats/",
            f"/messenger/v3/accounts/{user_id}/chats",
            f"/messenger/v2/accounts/{user_id}/chats",
            f"/messenger/v1/accounts/{user_id}/chats",
        ],
        params={"limit": 100},
    )
    if status != 200:
        raise AvitoMessengerError(f"Avito chats error (HTTP {status}): {data}")
    chats = _extract_list(data)
    return [
        normalize_chat(chat, idx, account_user_id=user_id) for idx, chat in enumerate(chats)
    ]


async def get_chat_detail(access_token: str, user_id: int, chat_id: str) -> dict[str, Any]:
    status, data = await _request_with_candidates(
        method="GET",
        access_token=access_token,
        candidates=[
            f"/messenger/v3/accounts/{user_id}/chats/{chat_id}/",
            f"/messenger/v3/accounts/{user_id}/chats/{chat_id}",
            f"/messenger/v2/accounts/{user_id}/chats/{chat_id}",
            f"/messenger/v1/accounts/{user_id}/chats/{chat_id}",
        ],
    )
    if status != 200:
        raise AvitoMessengerError(f"Avito chat detail error (HTTP {status}): {data}")
    payload = _extract_chat_payload(data)
    return normalize_chat(payload, 0, account_user_id=user_id)


async def mark_chat_read(access_token: str, user_id: int, chat_id: str) -> bool:
    """POST …/read — после GET v3 сообщений (не помечает прочитанным сам по себе)."""
    for path in (
        f"/messenger/v1/accounts/{user_id}/chats/{chat_id}/read",
        f"/messenger/v2/accounts/{user_id}/chats/{chat_id}/read",
    ):
        status, _ = await _post_empty(access_token, path)
        if status in (404, 405):
            continue
        if status in (200, 201, 204):
            return True
        logger.warning("Avito mark read %s HTTP %s", path, status)
    return False


async def get_chat_messages(access_token: str, user_id: int, chat_id: str) -> list[dict[str, Any]]:
    """GET сообщений: сначала v3 (канонический URL со слэшем), затем v2/v1.

    Если v3 отвечает 200 с пустым списком, а переписка есть — пробуем v2/v1 (иначе общий клиент
    останавливался на первом 200 и сообщения не подгружались).

    Real-time — вебхук → /webhooks/avito/messenger → WebSocket/push.
    """
    candidates = [
        f"/messenger/v3/accounts/{user_id}/chats/{chat_id}/messages/",
        f"/messenger/v3/accounts/{user_id}/chats/{chat_id}/messages",
        f"/messenger/v2/accounts/{user_id}/chats/{chat_id}/messages",
        f"/messenger/v1/accounts/{user_id}/chats/{chat_id}/messages",
    ]
    params: dict[str, Any] = {"limit": 200, "offset": 0}
    headers = {"Authorization": f"Bearer {access_token}"}
    last_status = 0
    last_data: Any = None

    async with httpx.AsyncClient(timeout=45.0) as client:
        for path in candidates:
            url = f"{AVITO_BASE}{path}"
            response = await client.get(url, headers=headers, params=params)
            last_status = response.status_code
            try:
                data: Any = response.json()
            except Exception:
                data = {"raw": response.text[:8000]}
            last_data = data

            if response.status_code in (404, 405):
                continue
            if response.status_code == 400:
                logger.warning("Avito GET messages %s HTTP 400: %s", path, data)
                continue
            if response.status_code != 200:
                continue

            messages = _extract_messages_response(data)
            is_v3 = "/messenger/v3/" in path
            if messages or not is_v3:
                normalized = [
                    normalize_message(msg, idx, account_user_id=user_id) for idx, msg in enumerate(messages)
                ]
                voice_ids = list(
                    {m["voice_id"] for m in normalized if m.get("message_type") == "voice" and m.get("voice_id")}
                )
                if voice_ids:
                    urls = await get_voice_file_urls(access_token, user_id, voice_ids)
                    for m in normalized:
                        vid = m.get("voice_id")
                        if vid and vid in urls:
                            m["voice_url"] = urls[vid]
                normalized.sort(key=_sort_message_key)
                return normalized

            logger.info("Avito GET messages: v3 %s returned 200 with 0 messages, trying next path", path)

    raise AvitoMessengerError(f"Avito messages error (HTTP {last_status}): {last_data}")


async def send_chat_message(access_token: str, user_id: int, chat_id: str, text: str) -> dict[str, Any]:
    v1_path = f"/messenger/v1/accounts/{user_id}/chats/{chat_id}/messages"
    status, data = await _post_once(
        access_token,
        v1_path,
        json_body={"type": "text", "message": {"text": text}},
    )
    if status in (200, 201):
        return data if isinstance(data, dict) else {"result": data}

    status, data = await _request_with_candidates(
        method="POST",
        access_token=access_token,
        candidates=[
            f"/messenger/v2/accounts/{user_id}/chats/{chat_id}/messages",
            f"/messenger/v3/accounts/{user_id}/chats/{chat_id}/messages",
            f"/messenger/v1/accounts/{user_id}/chats/{chat_id}/messages",
        ],
        json_body={"message": {"text": text}},
    )
    if status not in (200, 201):
        raise AvitoMessengerError(f"Avito send message error (HTTP {status}): {data}")
    if isinstance(data, dict):
        return data
    return {"result": data}


async def upload_messenger_image(
    access_token: str, user_id: int, file_bytes: bytes, filename: str = "image.jpg", content_type: str = "image/jpeg"
) -> str:
    url = f"{AVITO_BASE}/messenger/v1/accounts/{user_id}/uploadImages"
    headers = {"Authorization": f"Bearer {access_token}"}
    files = {"uploadfile[]": (filename, file_bytes, content_type)}
    async with httpx.AsyncClient(timeout=120.0) as client:
        response = await client.post(url, headers=headers, files=files)
    if response.status_code not in (200, 201):
        try:
            body = response.json()
        except Exception:
            body = response.text[:2000]
        raise AvitoMessengerError(f"Avito uploadImages error (HTTP {response.status_code}): {body}")
    try:
        data = response.json()
    except Exception as exc:
        raise AvitoMessengerError(f"Avito uploadImages: невалидный JSON: {exc}") from exc
    if not isinstance(data, dict) or not data:
        raise AvitoMessengerError(f"Avito uploadImages: пустой ответ: {data}")
    first_key = next(iter(data.keys()))
    return str(first_key)


async def send_chat_image_message(access_token: str, user_id: int, chat_id: str, image_id: str) -> dict[str, Any]:
    path = f"/messenger/v1/accounts/{user_id}/chats/{chat_id}/messages/image"
    status, data = await _post_once(access_token, path, json_body={"image_id": image_id})
    if status not in (200, 201):
        raise AvitoMessengerError(f"Avito send image error (HTTP {status}): {data}")
    return data if isinstance(data, dict) else {"result": data}


async def upload_messenger_voice(
    access_token: str, user_id: int, file_bytes: bytes, filename: str = "voice.ogg", content_type: str = "audio/ogg"
) -> str:
    """Загрузка голоса; перебор типичных путей API."""
    headers = {"Authorization": f"Bearer {access_token}"}
    files = {"uploadfile[]": (filename, file_bytes, content_type)}
    candidates = [
        f"/messenger/v1/accounts/{user_id}/uploadVoice",
        f"/messenger/v1/accounts/{user_id}/uploadVoices",
        f"/messenger/v1/accounts/{user_id}/voice/upload",
    ]
    last_err: Any = None
    async with httpx.AsyncClient(timeout=120.0) as client:
        for path in candidates:
            url = f"{AVITO_BASE}{path}"
            response = await client.post(url, headers=headers, files=files)
            if response.status_code in (404, 405):
                continue
            if response.status_code not in (200, 201):
                try:
                    last_err = response.json()
                except Exception:
                    last_err = response.text[:2000]
                continue
            try:
                data = response.json()
            except Exception as exc:
                raise AvitoMessengerError(f"Avito voice upload: невалидный JSON: {exc}") from exc
            if isinstance(data, dict):
                if "voice_id" in data:
                    return str(data["voice_id"])
                if data:
                    return str(next(iter(data.keys())))
            raise AvitoMessengerError(f"Avito voice upload: неожиданный ответ: {data}")
    raise AvitoMessengerError(f"Avito voice upload failed: {last_err}")


async def send_chat_voice_message(access_token: str, user_id: int, chat_id: str, voice_id: str) -> dict[str, Any]:
    candidates = [
        f"/messenger/v1/accounts/{user_id}/chats/{chat_id}/messages/voice",
        f"/messenger/v2/accounts/{user_id}/chats/{chat_id}/messages/voice",
    ]
    status, data = await _request_with_candidates(
        method="POST",
        access_token=access_token,
        candidates=candidates,
        json_body={"voice_id": voice_id},
    )
    if status not in (200, 201):
        raise AvitoMessengerError(f"Avito send voice error (HTTP {status}): {data}")
    return data if isinstance(data, dict) else {"result": data}


async def subscribe_messenger_webhook(access_token: str, hook_url: str) -> dict[str, Any]:
    status, data = await _post_once(access_token, "/messenger/v3/webhook", json_body={"url": hook_url})
    if status not in (200, 201):
        raise AvitoMessengerError(f"Avito webhook subscribe error (HTTP {status}): {data}")
    return data if isinstance(data, dict) else {"ok": True}
