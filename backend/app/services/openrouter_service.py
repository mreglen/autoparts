from __future__ import annotations

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
        "Content-Type": "application/json",
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

    try:
        with httpx.Client(timeout=DEFAULT_TIMEOUT_SEC) as client:
            response = client.post(OPENROUTER_API_URL, headers=headers, json=payload)
    except httpx.RequestError as exc:
        logger.exception("OpenRouter request failed")
        raise OpenRouterApiError(f"Не удалось связаться с OpenRouter: {exc}") from exc

    if response.status_code >= 400:
        detail = response.text[:500]
        raise OpenRouterApiError(
            f"OpenRouter вернул ошибку {response.status_code}: {detail}",
            status_code=response.status_code,
        )

    data = response.json()
    choices = data.get("choices") or []
    if not choices:
        raise OpenRouterApiError("OpenRouter вернул пустой ответ")

    message = choices[0].get("message") or {}
    content = str(message.get("content") or "").strip()
    if not content:
        raise OpenRouterApiError("OpenRouter вернул пустое описание")

    usage = data.get("usage") or {}
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
