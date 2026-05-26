"""Оформление заказа новых запчастей через Rossko GetCheckout."""
from __future__ import annotations

import json
import logging
from typing import Any

logger = logging.getLogger(__name__)

from fastapi import HTTPException, status
from zeep.helpers import serialize_object

from app.core.config import Settings
from app.models.carts.new_parts_cart import NewPartsCart
from app.models.rossko_settings import RosskoSettings
from app.routers.rossko_api.rossko_api import get_details_client, rossko_checkout
from app.services.rossko_checkout_details import normalize_checkout_details, payment_requires_requisite
from app.utils.rossko_settings_db import rossko_settings_configured

settings = Settings()


def _clean_soap_params(data: Any) -> Any:
    if isinstance(data, dict):
        return {k: _clean_soap_params(v) for k, v in data.items() if v is not None}
    if isinstance(data, list):
        return [_clean_soap_params(i) for i in data]
    return data


def resolve_requisite_id(rossko_cfg: RosskoSettings) -> int | None:
    """Возвращает requisite_id из настроек или подбирает по GetCheckoutDetails."""
    if rossko_cfg.requisite_id is not None:
        return int(rossko_cfg.requisite_id)

    try:
        result = get_details_client().service.GetCheckoutDetails(
            KEY1=settings.ROSSKO_KEY1,
            KEY2=settings.ROSSKO_KEY2,
        )
        details = normalize_checkout_details(serialize_object(result))
    except Exception as exc:
        if rossko_cfg.requires_requisite:
            raise HTTPException(
                status_code=status.HTTP_502_BAD_GATEWAY,
                detail="Не удалось получить реквизиты Rossko (GetCheckoutDetails). "
                "Проверьте настройки в /admin/rossko.",
            ) from exc
        return None

    payment = next((p for p in details.payments if p.id == rossko_cfg.payment_id), None)
    needs = bool(rossko_cfg.requires_requisite)
    if payment:
        needs = needs or payment.requires_requisite
        if payment.raw:
            needs = needs or payment_requires_requisite(
                payment.label, payment.raw if isinstance(payment.raw, dict) else {}
            )

    if not needs and details.requisites and payment:
        label_low = payment.label.lower()
        if "налич" not in label_low and "cash" not in label_low:
            needs = True

    if not needs:
        return None

    if not details.requisites:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Для выбранного способа оплаты Rossko нужны реквизиты, но список пуст. "
            "Обновите настройки в /admin/rossko (GetCheckoutDetails).",
        )

    if len(details.requisites) == 1:
        return int(details.requisites[0].id)

    raise HTTPException(
        status_code=status.HTTP_400_BAD_REQUEST,
        detail="Укажите реквизиты в /admin/rossko для выбранного способа оплаты.",
    )


def build_checkout_payload(
    cart_items: list[NewPartsCart],
    rossko_cfg: RosskoSettings,
    *,
    comment: str | None = None,
    delivery_parts: bool | None = None,
) -> dict[str, Any]:
    if not cart_items:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="В корзине нет новых запчастей для оформления",
        )
    if not rossko_settings_configured(rossko_cfg):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Настройки Rossko не заполнены. Обратитесь к администратору (/admin/rossko).",
        )

    delivery: dict[str, Any] = {"delivery_id": str(rossko_cfg.delivery_id)}
    if rossko_cfg.address_id:
        delivery["address_id"] = str(rossko_cfg.address_id)

    payment: dict[str, Any] = {"payment_id": int(rossko_cfg.payment_id)}
    requisite_id = resolve_requisite_id(rossko_cfg)
    if requisite_id is not None:
        payment["requisite_id"] = requisite_id

    name = (rossko_cfg.contact_name or "").strip()
    phone = (rossko_cfg.contact_phone or "").strip()
    if not name or not phone:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Контактные данные организации не настроены. Обратитесь к администратору.",
        )
    order_comment = comment if comment is not None else rossko_cfg.default_comment

    parts = []
    for item in cart_items:
        part_comment = None
        if order_comment:
            part_comment = str(order_comment)[:50]
        parts.append(
            {
                "partnumber": item.partnumber,
                "brand": item.brand,
                "stock": str(item.stock_id),
                "count": int(item.quantity),
                "comment": part_comment,
            }
        )

    return {
        "delivery": delivery,
        "payment": payment,
        "contact": {
            "name": name,
            "phone": phone,
            "comment": order_comment,
        },
        "delivery_parts": bool(
            delivery_parts if delivery_parts is not None else rossko_cfg.delivery_parts
        ),
        "parts": parts,
    }


def _is_rossko_truthy(val: Any) -> bool:
    if val is True or val == 1:
        return True
    if isinstance(val, str):
        return val.strip().lower() in ("1", "true", "yes", "да")
    return False


def _first_order_id_from_order_ids(node: Any) -> str | None:
    """OrderIDS → id (один id или список)."""
    if node is None:
        return None
    if isinstance(node, dict):
        ids = node.get("id") or node.get("Id")
        if ids is None:
            return extract_rossko_order_id(node)
        if isinstance(ids, list):
            return str(ids[0]) if ids else None
        return str(ids)
    if isinstance(node, list) and node:
        first = node[0]
        if isinstance(first, dict):
            val = first.get("id") or first.get("Id")
            return str(val) if val is not None else extract_rossko_order_id(first)
        return str(first)
    return None


def is_rossko_checkout_success(response: Any) -> bool:
    if not isinstance(response, dict):
        return False
    if _is_rossko_truthy(response.get("success")):
        return True
    return extract_rossko_order_id(response) is not None


def is_rossko_test_mode_notice(text: str) -> bool:
    low = (text or "").lower()
    return "тестирован" in low or ("режим" in low and "тест" in low)


def extract_rossko_order_id(response: Any) -> str | None:
    if response is None:
        return None
    if isinstance(response, dict):
        for key in ("OrderIDS", "OrderIds", "order_ids", "orderIds"):
            found = _first_order_id_from_order_ids(response.get(key))
            if found:
                return found
        for key in ("order_id", "OrderId", "orderId"):
            val = response.get(key)
            if val is not None:
                return str(val)
        for key in ("Orders", "orders", "Order", "order"):
            nested = response.get(key)
            if nested is not None:
                found = extract_rossko_order_id(nested)
                if found:
                    return found
        for key in ("id", "Id"):
            val = response.get(key)
            if val is not None and not isinstance(val, (dict, list)):
                return str(val)
        for value in response.values():
            if isinstance(value, (dict, list)):
                found = extract_rossko_order_id(value)
                if found:
                    return found
    if isinstance(response, list) and response:
        return extract_rossko_order_id(response[0])
    return None


def _pick_rossko_message(response: dict) -> str | None:
    for key in ("message", "Message", "error", "Error", "detail", "Detail"):
        val = response.get(key)
        if val is not None and str(val).strip():
            return str(val).strip()
    return None


def extract_rossko_notice_message(response: Any) -> str | None:
    """Информационное сообщение Rossko при успешном заказе (например, тестовый режим)."""
    if not isinstance(response, dict) or not is_rossko_checkout_success(response):
        return None
    msg = _pick_rossko_message(response)
    if msg and is_rossko_test_mode_notice(msg):
        return msg
    return None


def extract_rossko_error_message(response: Any) -> str | None:
    if not isinstance(response, dict):
        return None
    if is_rossko_checkout_success(response):
        return None
    msg = _pick_rossko_message(response)
    if msg:
        if is_rossko_test_mode_notice(msg):
            return (
                f"{msg} "
                "Если заказ не создаётся — включите тестирование GetCheckout в личном кабинете Rossko "
                "или отключите тестовый режим для боевых ключей."
            )
        return msg
    return "Rossko отклонил заказ"


def _map_rossko_checkout_exception(exc: Exception) -> HTTPException:
    text = str(exc)
    if "реквизит" in text.lower():
        return HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Укажите реквизиты в /admin/rossko для способа оплаты Rossko, затем сохраните настройки.",
        )
    return HTTPException(
        status_code=status.HTTP_502_BAD_GATEWAY,
        detail=text or "Ошибка оформления заказа у поставщика",
    )


async def send_checkout_to_rossko(payload: dict[str, Any]) -> dict[str, Any]:
    checkout_data = {
        "delivery": payload["delivery"],
        "payment": payload["payment"],
        "contact": payload["contact"],
        "delivery_parts": payload["delivery_parts"],
        "parts": payload["parts"],
    }
    try:
        result = await rossko_checkout(checkout_data)
    except HTTPException as exc:
        raise _map_rossko_checkout_exception(exc) if exc.status_code >= 500 else exc
    except Exception as exc:
        raise _map_rossko_checkout_exception(exc) from exc

    if isinstance(result, dict):
        err = extract_rossko_error_message(result)
        if err:
            if "реквизит" in err.lower():
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Укажите реквизиты в /admin/rossko для способа оплаты Rossko, затем сохраните настройки.",
                )
            raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail=err)
    return result if isinstance(result, dict) else serialize_object(result)


def serialize_rossko_response(response: Any) -> str | None:
    try:
        if isinstance(response, dict):
            return json.dumps(response, ensure_ascii=False, default=str)
        return json.dumps(serialize_object(response), ensure_ascii=False, default=str)
    except Exception:
        return str(response)
