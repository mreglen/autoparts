from __future__ import annotations

import json
import logging
from dataclasses import dataclass
from typing import Any

import httpx

logger = logging.getLogger(__name__)

OPENROUTER_API_URL = "https://openrouter.ai/api/v1/chat/completions"
DEFAULT_TIMEOUT_SEC = 60.0


class OpenRouterApiError(Exception):
    def __init__(self, message: str, *, status_code: int | None = None) -> None:
        super().__init__(message)
        self.status_code = status_code


@dataclass(frozen=True)
class OpenRouterCompletionResult:
    content: str
    tokens_used: int | None
    model: str


def _extract_message_content(message: dict[str, Any]) -> str:
    content = message.get("content")
    if isinstance(content, str):
        return content.strip()
    if isinstance(content, list):
        parts: list[str] = []
        for item in content:
            if isinstance(item, dict):
                text = item.get("text") or item.get("content")
                if text:
                    parts.append(str(text).strip())
            elif isinstance(item, str) and item.strip():
                parts.append(item.strip())
        return " ".join(parts).strip()
    if content is not None:
        text = str(content).strip()
        if text and text not in {"[]", "{}"}:
            return text
    reasoning = message.get("reasoning")
    if isinstance(reasoning, str) and reasoning.strip():
        return reasoning.strip()
    return ""


def _parse_error_detail(response: httpx.Response) -> str:
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


def chat_completion(
    *,
    api_key: str,
    model: str,
    system_prompt: str,
    user_prompt: str,
    max_tokens: int = 400,
    temperature: float = 0.4,
) -> OpenRouterCompletionResult:
    headers = {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json; charset=utf-8",
        "HTTP-Referer": "https://svoygarage.ru",
        "X-Title": "Svoy Garage",
    }
    payload: dict[str, Any] = {
        "model": model,
        "messages": [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_prompt},
        ],
        "max_tokens": max_tokens,
        "temperature": temperature,
    }
    # Явный UTF-8: на серверах с LANG=C httpx/json=payload может падать на кириллице.
    body_bytes = json.dumps(payload, ensure_ascii=False).encode("utf-8")

    try:
        with httpx.Client(timeout=DEFAULT_TIMEOUT_SEC) as client:
            response = client.post(OPENROUTER_API_URL, headers=headers, content=body_bytes)
    except (httpx.RequestError, UnicodeEncodeError) as exc:
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
