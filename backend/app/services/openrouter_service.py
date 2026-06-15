from __future__ import annotations

import json
import logging
import urllib.error
import urllib.request
from dataclasses import dataclass
from typing import Any

logger = logging.getLogger(__name__)

OPENROUTER_API_URL = "https://openrouter.ai/api/v1/chat/completions"
DEFAULT_TIMEOUT_SEC = 60.0

API_KEY_MIN_LEN = 20
API_KEY_MAX_LEN = 256


class OpenRouterApiError(Exception):
    def __init__(self, message: str, *, status_code: int | None = None) -> None:
        super().__init__(message)
        self.status_code = status_code


@dataclass(frozen=True)
class OpenRouterCompletionResult:
    content: str
    tokens_used: int | None
    model: str


@dataclass(frozen=True)
class _HttpResponse:
    status_code: int
    text: str

    def json(self) -> Any:
        return json.loads(self.text)


def normalize_openrouter_api_key(api_key: str) -> str:
    key = (api_key or "").strip()
    if not key:
        raise OpenRouterApiError("API-ключ OpenRouter не задан")
    if "\n" in key or "\r" in key or "\t" in key:
        raise OpenRouterApiError(
            "API-ключ OpenRouter не должен содержать переносы строк или табуляцию. "
            "Сохраните ключ заново в /admin-settings → OpenRouter."
        )
    if " " in key:
        raise OpenRouterApiError(
            "API-ключ OpenRouter не должен содержать пробелы. "
            "Сохраните ключ заново в /admin-settings → OpenRouter."
        )
    if not key.isascii():
        raise OpenRouterApiError(
            "API-ключ OpenRouter содержит недопустимые символы. "
            "Откройте /admin-settings → OpenRouter и сохраните ключ заново (только sk-or-v1-...)."
        )
    if not key.startswith("sk-or-"):
        raise OpenRouterApiError("Некорректный формат API-ключа OpenRouter")
    if not (API_KEY_MIN_LEN <= len(key) <= API_KEY_MAX_LEN):
        raise OpenRouterApiError(
            f"Длина API-ключа OpenRouter должна быть от {API_KEY_MIN_LEN} до {API_KEY_MAX_LEN} символов"
        )
    return key


def _assert_latin1_header(value: str, header_name: str) -> None:
    try:
        value.encode("latin-1")
    except UnicodeEncodeError as exc:
        raise OpenRouterApiError(
            f"Заголовок {header_name} содержит недопустимые символы для HTTP"
        ) from exc


def _extract_message_content(message: dict[str, Any], *, include_reasoning: bool = False) -> str:
    content = message.get("content")
    if isinstance(content, str):
        text = content.strip()
        if text and text not in {"[]", "{}"}:
            return text
    if isinstance(content, list):
        parts: list[str] = []
        for item in content:
            if isinstance(item, dict):
                item_type = str(item.get("type") or "").lower()
                if item_type in {"reasoning", "thinking", "reasoning_content"}:
                    continue
                text = item.get("text") or item.get("content")
                if text:
                    parts.append(str(text).strip())
            elif isinstance(item, str) and item.strip():
                parts.append(item.strip())
        if parts:
            return "\n\n".join(parts).strip()
    if content is not None:
        text = str(content).strip()
        if text and text not in {"[]", "{}"}:
            return text
    if include_reasoning:
        reasoning = message.get("reasoning")
        if isinstance(reasoning, str) and reasoning.strip():
            return reasoning.strip()
    return ""


def _parse_error_detail(response: _HttpResponse) -> str:
    try:
        data = response.json()
    except json.JSONDecodeError:
        return (response.text or "")[:500]
    if isinstance(data, dict):
        error = data.get("error")
        if isinstance(error, dict):
            return str(error.get("message") or error)[:500]
        if error:
            return str(error)[:500]
    return (response.text or "")[:500]


def _build_request_body(payload: dict[str, Any]) -> bytes:
    return json.dumps(payload, ensure_ascii=False).encode("utf-8")


def _build_openrouter_headers(api_key: str) -> dict[str, str]:
    headers = {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json; charset=utf-8",
        "HTTP-Referer": "https://svoygarage.ru",
        "X-Title": "Svoy Garage",
    }
    for name, value in headers.items():
        _assert_latin1_header(value, name)
    return headers


def _post_openrouter(url: str, headers: dict[str, str], body: bytes, timeout: float) -> _HttpResponse:
    request = urllib.request.Request(url, data=body, method="POST")
    for name, value in headers.items():
        request.add_header(name, value)
    try:
        with urllib.request.urlopen(request, timeout=timeout) as response:
            return _HttpResponse(
                status_code=response.status,
                text=response.read().decode("utf-8"),
            )
    except urllib.error.HTTPError as exc:
        return _HttpResponse(
            status_code=exc.code,
            text=exc.read().decode("utf-8", errors="replace"),
        )
    except urllib.error.URLError as exc:
        raise OpenRouterApiError(f"Не удалось отправить запрос в OpenRouter: {exc}") from exc


def chat_completion(
    *,
    api_key: str,
    model: str,
    system_prompt: str,
    user_prompt: str,
    max_tokens: int = 400,
    temperature: float = 0.4,
) -> OpenRouterCompletionResult:
    normalized_key = normalize_openrouter_api_key(api_key)
    headers = _build_openrouter_headers(normalized_key)
    payload: dict[str, Any] = {
        "model": model,
        "messages": [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_prompt},
        ],
        "max_tokens": max_tokens,
        "temperature": temperature,
    }
    body_bytes = _build_request_body(payload)

    try:
        response = _post_openrouter(
            OPENROUTER_API_URL,
            headers=headers,
            body=body_bytes,
            timeout=DEFAULT_TIMEOUT_SEC,
        )
    except (OpenRouterApiError, UnicodeEncodeError) as exc:
        if isinstance(exc, OpenRouterApiError):
            raise
        logger.exception("OpenRouter request failed")
        raise OpenRouterApiError(f"Не удалось отправить запрос в OpenRouter: {exc}") from exc
    except Exception as exc:
        logger.exception("OpenRouter request failed")
        raise OpenRouterApiError(f"Не удалось отправить запрос в OpenRouter: {exc}") from exc

    if response.status_code >= 400:
        detail = _parse_error_detail(response)
        raise OpenRouterApiError(
            f"OpenRouter вернул ошибку {response.status_code}: {detail}",
            status_code=response.status_code,
        )

    try:
        data = response.json()
    except json.JSONDecodeError as exc:
        snippet = (response.text or "")[:300]
        raise OpenRouterApiError(f"OpenRouter вернул не-JSON ответ: {snippet}") from exc

    if not isinstance(data, dict):
        raise OpenRouterApiError("OpenRouter вернул некорректный JSON")

    choices = data.get("choices") or []
    if not choices:
        raise OpenRouterApiError("OpenRouter вернул пустой ответ")

    first = choices[0] if isinstance(choices[0], dict) else {}
    message = first.get("message") if isinstance(first.get("message"), dict) else {}
    content = _extract_message_content(message)
    if not content:
        raise OpenRouterApiError("OpenRouter вернул пустое описание")

    usage = data.get("usage") if isinstance(data.get("usage"), dict) else {}
    tokens_used = usage.get("total_tokens")
    if tokens_used is not None:
        try:
            tokens_used = int(tokens_used)
        except (TypeError, ValueError):
            tokens_used = None

    return OpenRouterCompletionResult(
        content=content,
        tokens_used=tokens_used,
        model=str(data.get("model") or model),
    )
