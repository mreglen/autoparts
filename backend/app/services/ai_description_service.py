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

# Лаконичное описание товара: факты о детали, без «воды».
DESCRIPTION_TARGET_MIN_CHARS = 220
DESCRIPTION_TARGET_MAX_CHARS = 550
DESCRIPTION_ABSOLUTE_MAX_CHARS = 550
EXISTING_DESCRIPTION_MAX_INPUT = 1500
DESCRIPTION_GENERATION_MAX_TOKENS = 450
DESCRIPTION_GENERATION_TEMPERATURE = 0.2

SYSTEM_PROMPT = (
    "Ты продавец автозапчастей и пишешь описание для карточки товара на маркетплейсе «Свой Гараж». "
    "КРИТИЧНО: только русский язык, без английского и без рассуждений. "
    f"Длина: {DESCRIPTION_TARGET_MIN_CHARS}–{DESCRIPTION_TARGET_MAX_CHARS} символов, 4–6 коротких предложений. "
    "Один абзац или два коротких через пустую строку. "
    "Стиль — как у живого объявления: простые фразы, без канцелярита и рекламных штампов. "
    "Начни с сути: что за деталь и для чего. Затем бренд, артикул, состояние, важные параметры. "
    "Совместимость и применяемость указывай только конкретно (марка, модель, двигатель, год) — "
    "если в данных нет конкретики, не пиши общие фразы вроде «подходит для автомобилей» или «совместим с двигателями». "
    "Используй факты из дополнительных сведений о товаре, но в тексте НИКОГДА не упоминай "
    "черновик, запрос, исходные данные, «указанные характеристики» и подобное — читатель видит только готовое описание. "
    "НЕ выдумывай факты. Без клише («идеальный выбор», «высокое качество», «для установки и поддержки»), "
    "восклицаний и списков с маркерами. "
    "Запрещено: «хорошо», «пользователь просит», «доступно в черновике», «Okay», «Let me» и любые пояснения задания."
)

_CYRILLIC_RE = re.compile(r"[а-яА-ЯёЁ]")
_DRAFT_HAS_VEHICLE_COMPAT_RE = re.compile(
    r"совместим|подходит\s+(?:для|к)|применяем|"
    r"для\s+автомобил|для\s+(?:авто|машин|легков|грузов)|"
    r"\b(?:OEM|oem)\b|оригинал(?:ьный)?\s+номер|"
    r"марки?\s+авто|модел(?:и|ей)\s+авто|"
    r"кузов\w*|двигател\w*|"
    r"Lexus|Toyota|Hyundai|KIA|BMW|Mercedes|Volkswagen|Audi|Nissan|Honda|Mazda|"
    r"Lada|ВАЗ|ГАЗ|УАЗ|Ford|Chevrolet|Opel|Renault|Skoda",
    re.IGNORECASE,
)

_ENGLISH_REASONING_RE = re.compile(
    r"(?is)\b(?:okay|ok[,!]?|sure|let me|the user|user wants|wait[,!]?|"
    r"i need to|i'll|i will|hmm|they specified|the task is|my job is)\b"
)

_META_LEAD_PATTERNS = [
    re.compile(
        r"^(?:хорошо|конечно|разумеется|итак|ладно|понятно|отлично)[,!.\s]+",
        re.IGNORECASE,
    ),
    re.compile(
        r"^пользователь\s+(?:просит|хочет|попросил)\b[^.!?]*[.!?]\s*",
        re.IGNORECASE,
    ),
    re.compile(
        r"^(?:вот|ниже)\s+(?:описание|текст|вариант)\b[^.!?]*[.!?]\s*",
        re.IGNORECASE,
    ),
    re.compile(
        r"^(?:описание\s+товара|текст\s+для\s+карточки)\s*[:—-]\s*",
        re.IGNORECASE,
    ),
    re.compile(
        r"^(?:okay|ok|sure|let me|the user|wait|i need to|i'll)\b[^.!?]*[.!?]\s*",
        re.IGNORECASE,
    ),
]

_META_SENTENCE_RE = re.compile(
    r"(?i)(?:"
    r"черн(?:овик|овика|овике|овику)|"
    r"в\s+запросе|"
    r"по\s+запросу|"
    r"исходн(?:ые|ых|ом|ого)\s+(?:данн|сведен)|"
    r"указанн(?:ые|ых|ой|ая)\s+характеристик|"
    r"доступно\s+в\s+|"
    r"предоставленн(?:ые|ая)\s+(?:сведения|данные)|"
    r"согласно\s+(?:запросу|данным|исходным)|"
    r"ниже\s+перечислен|"
    r"в\s+тексте\s+выше|"
    r"для\s+установки\s+и\s+поддержки"
    r")"
)

_VAGUE_COMPAT_RE = re.compile(
    r"(?i)\b(?:"
    r"совместим(?:ый|ая|ые)?\s+с\s+двигателями\b|"
    r"подходит\s+для\s+автомобилей\b|"
    r"для\s+легковых\s+и\s+грузовых\s+автомобилей\b|"
    r"универсальн(?:ая|ый|ое)\s+запчасть"
    r")"
)

_SPECIFIC_COMPAT_RE = re.compile(
    r"(?i)(?:"
    r"Lexus|Toyota|Hyundai|KIA|Kia|BMW|Mercedes|Volkswagen|Audi|Nissan|Honda|Mazda|"
    r"Lada|ВАЗ|ГАЗ|УАЗ|Ford|Chevrolet|Opel|Renault|Skoda|"
    r"Solaris|Camry|Corolla|RAV4|Land\s+Cruiser|"
    r"\b\d{4}\s*[-–]\s*\d{4}\b"
    r")"
)

REPAIR_USER_SUFFIX = (
    "\n\nВАЖНО: верни ТОЛЬКО итоговое описание на русском языке. "
    f"Строго {DESCRIPTION_TARGET_MIN_CHARS}–{DESCRIPTION_TARGET_MAX_CHARS} символов. "
    "Пиши как продавец в объявлении. Без упоминания черновика, запроса и исходных данных. "
    "Без английского языка и без рассуждений."
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
    existing_description: str | None = None,
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
    draft = (existing_description or "").strip()
    if draft:
        if len(draft) > EXISTING_DESCRIPTION_MAX_INPUT:
            draft = f"{draft[: EXISTING_DESCRIPTION_MAX_INPUT - 1].rstrip()}…"
        lines.append(f"Дополнительные сведения о товаре:\n{draft}")
        if _DRAFT_HAS_VEHICLE_COMPAT_RE.search(draft):
            lines.append(
                "В сведениях указана совместимость или применяемость — "
                "обязательно впиши конкретные марки, модели или двигатели в текст описания."
            )
        lines.append(
            "Напиши описание простым языком, как продавец в объявлении: только факты о детали. "
            f"Длина {DESCRIPTION_TARGET_MIN_CHARS}–{DESCRIPTION_TARGET_MAX_CHARS} символов. "
            "Не упоминай черновик, запрос и исходные данные — только готовый текст для покупателя."
        )
    else:
        lines.append(
            f"Напиши описание простым языком, как продавец в объявлении, по фактам выше "
            f"({DESCRIPTION_TARGET_MIN_CHARS}–{DESCRIPTION_TARGET_MAX_CHARS} символов). "
            "Начни с того, что это за деталь. Верни только готовый текст для покупателя."
        )
    return "\n".join(lines)


def _cyrillic_letter_ratio(text: str) -> float:
    letters = [char for char in text if char.isalpha()]
    if not letters:
        return 0.0
    cyrillic_count = sum(1 for char in letters if _CYRILLIC_RE.match(char))
    return cyrillic_count / len(letters)


def _sentence_is_usable(sentence: str) -> bool:
    sentence = sentence.strip()
    if not sentence or not _CYRILLIC_RE.search(sentence):
        return False
    if _ENGLISH_REASONING_RE.search(sentence):
        return False
    return _cyrillic_letter_ratio(sentence) >= 0.15


def _extract_russian_description(text: str) -> str:
    raw = (text or "").strip()
    if not raw:
        return ""

    paragraphs = [part.strip() for part in re.split(r"\n\s*\n", raw) if part.strip()]
    if not paragraphs:
        paragraphs = [raw]

    russian_blocks: list[str] = []
    for paragraph in paragraphs:
        if _ENGLISH_REASONING_RE.search(paragraph) and _cyrillic_letter_ratio(paragraph) < 0.35:
            sentences = re.split(r"(?<=[.!?])\s+", paragraph)
            good_sentences = [s.strip() for s in sentences if _sentence_is_usable(s)]
            if good_sentences:
                russian_blocks.append(" ".join(good_sentences))
            continue
        if _cyrillic_letter_ratio(paragraph) < 0.15 and not _CYRILLIC_RE.search(paragraph):
            continue
        russian_blocks.append(paragraph)

    if russian_blocks:
        return "\n\n".join(russian_blocks)

    sentences = re.split(r"(?<=[.!?])\s+", raw)
    good = [sentence.strip() for sentence in sentences if _sentence_is_usable(sentence)]
    return " ".join(good) if good else raw


def _strip_meta_lead(text: str) -> str:
    cleaned = (text or "").strip()
    for _ in range(5):
        before = cleaned
        for pattern in _META_LEAD_PATTERNS:
            cleaned = pattern.sub("", cleaned, count=1).strip()
        if cleaned == before:
            break
    return cleaned


def _is_vague_compat_sentence(sentence: str) -> bool:
    if not _VAGUE_COMPAT_RE.search(sentence):
        return False
    return not _SPECIFIC_COMPAT_RE.search(sentence)


def _strip_meta_sentences(text: str) -> str:
    sentences = re.split(r"(?<=[.!?])\s+", (text or "").strip())
    kept: list[str] = []
    for sentence in sentences:
        sentence = sentence.strip()
        if not sentence:
            continue
        if _META_SENTENCE_RE.search(sentence):
            continue
        if _is_vague_compat_sentence(sentence):
            continue
        kept.append(sentence)
    if not kept:
        return (text or "").strip()
    return " ".join(kept)


def _truncate_to_max_chars(text: str, max_chars: int) -> str:
    if len(text) <= max_chars:
        return text
    soft_limit = max_chars - 1 if max_chars > 1 else max_chars
    chunk = text[:soft_limit]
    for sep in (". ", ".\n", "! ", "? "):
        pos = chunk.rfind(sep)
        if pos >= int(soft_limit * 0.55):
            return chunk[: pos + 1].rstrip()
    return chunk.rstrip()


def _is_valid_product_description(text: str) -> bool:
    cleaned = (text or "").strip()
    if len(cleaned) < 50:
        return False
    if _cyrillic_letter_ratio(cleaned) < 0.55:
        return False
    if _ENGLISH_REASONING_RE.search(cleaned[:300]):
        return False
    if len(_CYRILLIC_RE.findall(cleaned)) < 35:
        return False
    return True


def _normalize_description(text: str) -> str:
    cleaned = _extract_russian_description(text)
    cleaned = _strip_meta_lead(cleaned)
    cleaned = _strip_meta_sentences(cleaned)
    cleaned = re.sub(r"[ \t]+", " ", cleaned).strip()
    cleaned = re.sub(r"\n{3,}", "\n\n", cleaned)
    cleaned = _truncate_to_max_chars(cleaned, DESCRIPTION_ABSOLUTE_MAX_CHARS)
    return cleaned


def _finalize_product_description(raw: str) -> str:
    description = _normalize_description(raw)
    if not _is_valid_product_description(description):
        raise ValueError("Модель вернула некорректное описание")
    return description


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
    existing_description: str | None = None,
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
        existing_description=existing_description,
    )
    model_id = (integration.model_id or "").strip() or RECOMMENDED_FREE_MODELS[0]

    try:
        result = chat_completion(
            api_key=api_key,
            model=model_id,
            system_prompt=SYSTEM_PROMPT,
            user_prompt=user_prompt,
            max_tokens=DESCRIPTION_GENERATION_MAX_TOKENS,
            temperature=DESCRIPTION_GENERATION_TEMPERATURE,
        )
        try:
            description = _finalize_product_description(result.content)
        except ValueError:
            logger.warning("AI description invalid on first attempt, retrying with repair prompt")
            repair_result = chat_completion(
                api_key=api_key,
                model=model_id,
                system_prompt=SYSTEM_PROMPT,
                user_prompt=user_prompt + REPAIR_USER_SUFFIX,
                max_tokens=DESCRIPTION_GENERATION_MAX_TOKENS,
                temperature=0.1,
            )
            try:
                description = _finalize_product_description(repair_result.content)
                result = repair_result
            except ValueError as exc:
                raise HTTPException(
                    status_code=502,
                    detail=(
                        "Модель вернула некорректный текст (рассуждения или не русский язык). "
                        "Попробуйте другую модель :free в /admin-settings → OpenRouter."
                    ),
                ) from exc
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
