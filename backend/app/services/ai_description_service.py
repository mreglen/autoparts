from __future__ import annotations

import logging
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

logger = logging.getLogger(__name__)

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


def can_use_ai_description_ui(user: User) -> bool:
    if not user.organization_id:
        return False
    return bool(user.is_seller or user.is_director or user.is_employee)


def can_generate_ai_description(user: User) -> bool:
    return can_use_ai_description_ui(user)


def _resolve_block_reason(
    *,
    user: User,
    integration: SiteOpenRouterIntegration,
    org_enabled: bool,
) -> str | None:
    if not can_use_ai_description_ui(user):
        return "Доступно только продавцам и сотрудникам организации"
    if not integration.api_key_encrypted:
        return "Администратор ещё не сохранил API-ключ OpenRouter"
    if not integration.is_enabled:
        return "Генерация отключена в /admin-settings → OpenRouter"
    if not org_enabled:
        return "Для вашей организации доступ не включён в /admin-settings"
    return None


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

    show_ui = can_use_ai_description_ui(user)
    block_reason = _resolve_block_reason(
        user=user,
        integration=integration,
        org_enabled=org_enabled,
    )
    enabled = show_ui and block_reason is None
    remaining_global = max(0, global_limit - global_used)
    remaining_org = max(0, org_limit - org_used)
    remaining_today = min(remaining_global, remaining_org) if enabled else 0

    return {
        "show_ui": show_ui,
        "enabled": enabled,
        "reason": block_reason,
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
    if not can_generate_ai_description(user):
        raise HTTPException(status_code=403, detail="Доступно только продавцам и сотрудникам организации")

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


def _append_generation_log(
    db: Session,
    *,
    user: User,
    brand: str,
    article: str,
    model_id: str,
    product_id: int | None,
    status: str,
    tokens_used: int | None = None,
    error_message: str | None = None,
) -> None:
    db.add(
        AiDescriptionGenerationLog(
            organization_id=user.organization_id,
            user_id=user.id,
            product_id=product_id,
            brand=brand,
            article=article,
            model_id=model_id,
            tokens_used=tokens_used,
            status=status,
            error_message=(error_message or "")[:1000] or None,
        )
    )


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

    try:
        result = chat_completion(
            api_key=api_key,
            model=model_id,
            system_prompt=SYSTEM_PROMPT,
            user_prompt=user_prompt,
        )
        description = _normalize_description(result.content)
        _append_generation_log(
            db,
            user=user,
            brand=brand_text,
            article=article_text,
            model_id=result.model,
            product_id=product_id,
            status="success",
            tokens_used=result.tokens_used,
        )
        integration.requests_today = int(integration.requests_today or 0) + 1
        integration.requests_today_date = _utc_today()
        db.commit()
        return {"description": description, "tokens_used": result.tokens_used}
    except OpenRouterApiError as exc:
        db.rollback()
        try:
            _append_generation_log(
                db,
                user=user,
                brand=brand_text,
                article=article_text,
                model_id=model_id,
                product_id=product_id,
                status="error",
                error_message=str(exc),
            )
            db.commit()
        except Exception:
            db.rollback()
            logger.exception("Failed to persist OpenRouter error log")
        status = 429 if exc.status_code == 429 else 502
        if status == 429:
            detail = (
                "OpenRouter вернул ошибку 429: исчерпан лимит бесплатной модели. "
                "Попробуйте другую модель :free или повторите позже."
            )
        else:
            detail = str(exc)
        raise HTTPException(status_code=status, detail=detail) from exc
    except HTTPException:
        db.rollback()
        raise
    except Exception as exc:
        db.rollback()
        logger.exception("AI description generation failed")
        try:
            _append_generation_log(
                db,
                user=user,
                brand=brand_text,
                article=article_text,
                model_id=model_id,
                product_id=product_id,
                status="error",
                error_message=str(exc),
            )
            db.commit()
        except Exception:
            db.rollback()
            logger.exception("Failed to persist AI generation error log")
        raise HTTPException(
            status_code=500,
            detail=f"Ошибка генерации описания: {exc}",
        ) from exc


def test_openrouter_connection(db: Session) -> dict:
    integration = get_or_create_openrouter_integration(db)
    api_key = get_plain_api_key(integration)
    if not api_key:
        raise HTTPException(status_code=400, detail="API-ключ не настроен")

    model_id = (integration.model_id or "").strip() or RECOMMENDED_FREE_MODELS[0]
    try:
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
    except OpenRouterApiError as exc:
        status = exc.status_code if exc.status_code else 502
        if status == 429:
            detail = (
                "OpenRouter вернул ошибку 429: исчерпан лимит бесплатной модели. "
                "Выберите другую модель с суффиксом :free (например google/gemma-3-12b-it:free) "
                "или повторите через несколько минут."
            )
        else:
            detail = str(exc)
        raise HTTPException(status_code=status, detail=detail) from exc
    return {
        "ok": True,
        "model": result.model,
        "sample": result.content,
        "tokens_used": result.tokens_used,
    }
