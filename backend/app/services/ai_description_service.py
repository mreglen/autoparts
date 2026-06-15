from __future__ import annotations

import re
from datetime import date, datetime, timezone

from fastapi import HTTPException
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.models.ai_description_generation_log import AiDescriptionGenerationLog
from app.models.organization_ai_description_access import OrganizationAiDescriptionAccess
from app.models.part_type import PartType
from app.models.site_openrouter_integration import SiteOpenRouterIntegration
from app.models.user import User
from app.services.openrouter_service import OpenRouterApiError, chat_completion
from app.utils.openrouter_crypto import decrypt_openrouter_secret
from app.utils.openrouter_integration_db import get_or_create_openrouter_integration

SYSTEM_PROMPT = (
    "Ты помощник маркетплейса автозапчастей «Свой Гараж». "
    "Пиши только на русском языке. "
    "Создавай краткое описание товара для карточки на сайте (2–4 предложения). "
    "Используй только факты из запроса пользователя. "
    "НЕ выдумывай совместимость с автомобилями, OEM-номера, технические характеристики, "
    "размеры и материалы, если они не указаны явно. "
    "Не используй маркетинговые клише и восклицательные знаки. "
    "Ответ — только текст описания, без заголовков и списков."
)

RECOMMENDED_FREE_MODELS = [
    "meta-llama/llama-3.3-70b-instruct:free",
    "google/gemma-3-12b-it:free",
    "qwen/qwen-2.5-7b-instruct:free",
    "openrouter/free",
]


def _utc_today() -> date:
    return datetime.now(timezone.utc).date()


def _start_of_utc_day() -> datetime:
    today = _utc_today()
    return datetime(today.year, today.month, today.day, tzinfo=timezone.utc)


def get_plain_api_key(row: SiteOpenRouterIntegration) -> str | None:
    encrypted = (row.api_key_encrypted or "").strip()
    if not encrypted:
        return None
    try:
        return decrypt_openrouter_secret(encrypted)
    except Exception:
        return None


def _reset_daily_counter_if_needed(row: SiteOpenRouterIntegration) -> None:
    today = _utc_today()
    if row.requests_today_date != today:
        row.requests_today = 0
        row.requests_today_date = today


def get_global_usage(row: SiteOpenRouterIntegration) -> tuple[int, int]:
    _reset_daily_counter_if_needed(row)
    return int(row.requests_today or 0), int(row.daily_limit or 50)


def count_org_requests_today(db: Session, organization_id: str) -> int:
    return (
        db.query(func.count(AiDescriptionGenerationLog.id))
        .filter(
            AiDescriptionGenerationLog.organization_id == organization_id,
            AiDescriptionGenerationLog.status == "success",
            AiDescriptionGenerationLog.created_at >= _start_of_utc_day(),
        )
        .scalar()
        or 0
    )


def is_org_ai_description_enabled(db: Session, organization_id: str | None) -> bool:
    if not organization_id:
        return False
    row = (
        db.query(OrganizationAiDescriptionAccess)
        .filter(
            OrganizationAiDescriptionAccess.organization_id == organization_id,
            OrganizationAiDescriptionAccess.is_enabled.is_(True),
        )
        .first()
    )
    return row is not None


def get_seller_access_info(db: Session, user: User) -> dict:
    integration = get_or_create_openrouter_integration(db)
    _reset_daily_counter_if_needed(integration)

    org_id = user.organization_id
    org_enabled = is_org_ai_description_enabled(db, org_id)
    global_used, global_limit = get_global_usage(integration)
    org_used = count_org_requests_today(db, org_id) if org_id else 0
    org_limit = int(integration.per_org_daily_limit or 10)

    enabled = bool(
        integration.is_enabled
        and integration.api_key_encrypted
        and org_enabled
        and user.is_seller
    )
    remaining_global = max(0, global_limit - global_used)
    remaining_org = max(0, org_limit - org_used)
    remaining_today = min(remaining_global, remaining_org) if enabled else 0

    return {
        "enabled": enabled,
        "remaining_today": remaining_today,
        "org_limit": org_limit,
        "global_limit": global_limit,
        "global_used": global_used,
        "org_used": org_used,
    }


def _build_user_prompt(
    *,
    brand: str,
    article: str,
    name: str,
    is_new: bool,
    part_type_name: str | None,
) -> str:
    condition = "новая" if is_new else "б/у"
    lines = [
        f"Бренд: {brand}",
        f"Артикул: {article}",
        f"Название: {name}",
        f"Состояние: {condition}",
    ]
    if part_type_name:
        lines.append(f"Тип детали: {part_type_name}")
    lines.append("Напиши описание для карточки товара.")
    return "\n".join(lines)


def _normalize_description(text: str) -> str:
    cleaned = re.sub(r"\s+", " ", (text or "")).strip()
    if len(cleaned) > 2000:
        cleaned = f"{cleaned[:1999].rstrip()}…"
    return cleaned


def _assert_can_generate(
    db: Session,
    *,
    user: User,
    integration: SiteOpenRouterIntegration,
) -> None:
    if not user.is_seller or not user.organization_id:
        raise HTTPException(status_code=403, detail="Доступно только продавцам")

    if not integration.is_enabled:
        raise HTTPException(status_code=503, detail="Генерация описаний отключена администратором")

    if not integration.api_key_encrypted:
        raise HTTPException(status_code=503, detail="OpenRouter не настроен")

    if not is_org_ai_description_enabled(db, user.organization_id):
        raise HTTPException(status_code=403, detail="Для вашей организации генерация не включена")

    _reset_daily_counter_if_needed(integration)
    if int(integration.requests_today or 0) >= int(integration.daily_limit or 50):
        raise HTTPException(status_code=429, detail="Исчерпан дневной лимит генерации на сайте")

    org_used = count_org_requests_today(db, user.organization_id)
    org_limit = int(integration.per_org_daily_limit or 10)
    if org_used >= org_limit:
        raise HTTPException(status_code=429, detail="Исчерпан дневной лимит вашей организации")


def generate_product_description(
    db: Session,
    *,
    user: User,
    brand: str,
    article: str,
    name: str,
    is_new: bool = False,
    part_type_id: int | None = None,
    product_id: int | None = None,
) -> dict:
    brand_text = (brand or "").strip()
    article_text = (article or "").strip()
    name_text = (name or "").strip()
    if not brand_text or not article_text or not name_text:
        raise HTTPException(status_code=400, detail="Укажите бренд, артикул и название")

    integration = get_or_create_openrouter_integration(db)
    _assert_can_generate(db, user=user, integration=integration)

    api_key = get_plain_api_key(integration)
    if not api_key:
        raise HTTPException(status_code=503, detail="Не удалось прочитать API-ключ OpenRouter")

    part_type_name = None
    if part_type_id is not None:
        part_type = db.query(PartType).filter(PartType.id == part_type_id).first()
        if part_type is not None:
            part_type_name = (part_type.name or "").strip() or None

    user_prompt = _build_user_prompt(
        brand=brand_text,
        article=article_text,
        name=name_text,
        is_new=is_new,
        part_type_name=part_type_name,
    )
    model_id = (integration.model_id or "").strip() or RECOMMENDED_FREE_MODELS[0]

    log_row = AiDescriptionGenerationLog(
        organization_id=user.organization_id,
        user_id=user.id,
        product_id=product_id,
        brand=brand_text,
        article=article_text,
        model_id=model_id,
        status="error",
    )
    db.add(log_row)
    db.flush()

    try:
        result = chat_completion(
            api_key=api_key,
            model=model_id,
            system_prompt=SYSTEM_PROMPT,
            user_prompt=user_prompt,
        )
        description = _normalize_description(result.content)
        log_row.status = "success"
        log_row.tokens_used = result.tokens_used
        log_row.model_id = result.model
        integration.requests_today = int(integration.requests_today or 0) + 1
        integration.requests_today_date = _utc_today()
        db.commit()
        return {"description": description, "tokens_used": result.tokens_used}
    except OpenRouterApiError as exc:
        log_row.error_message = str(exc)[:1000]
        db.commit()
        status = 429 if exc.status_code == 429 else 502
        raise HTTPException(status_code=status, detail=str(exc)) from exc
    except HTTPException:
        db.commit()
        raise
    except Exception as exc:
        log_row.error_message = str(exc)[:1000]
        db.commit()
        raise HTTPException(status_code=500, detail="Ошибка генерации описания") from exc


def test_openrouter_connection(db: Session) -> dict:
    integration = get_or_create_openrouter_integration(db)
    api_key = get_plain_api_key(integration)
    if not api_key:
        raise HTTPException(status_code=400, detail="API-ключ не настроен")

    model_id = (integration.model_id or "").strip() or RECOMMENDED_FREE_MODELS[0]
    result = chat_completion(
        api_key=api_key,
        model=model_id,
        system_prompt=SYSTEM_PROMPT,
        user_prompt=_build_user_prompt(
            brand="Koyo",
            article="608ZZ",
            name="Подшипник",
            is_new=True,
            part_type_name="Подшипник",
        ),
        max_tokens=200,
    )
    return {
        "ok": True,
        "model": result.model,
        "sample": result.content,
        "tokens_used": result.tokens_used,
    }
