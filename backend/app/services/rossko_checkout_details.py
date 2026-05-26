"""Нормализация ответа Rossko GetCheckoutDetails для админ-UI."""
from __future__ import annotations

from typing import Any

from app.schemas.rossko_settings import (
    RosskoCheckoutDetailsResponse,
    RosskoDeliveryOption,
    RosskoOptionItem,
    RosskoPaymentOption,
)


def _as_list(value: Any) -> list:
    if value is None:
        return []
    if isinstance(value, list):
        return value
    if isinstance(value, dict):
        for key in (
            "item",
            "Item",
            "delivery",
            "Delivery",
            "payment",
            "Payment",
            "address",
            "Address",
            "company",
            "Company",
            "Requisite",
        ):
            if key in value:
                inner = value[key]
                return inner if isinstance(inner, list) else [inner]
        return [value]
    return [value]


def _pick_id(raw: dict, *keys: str) -> str | None:
    for key in keys:
        val = raw.get(key)
        if val is not None and str(val).strip() != "":
            return str(val).strip()
    return None


def _pick_label(raw: dict, *keys: str) -> str:
    for key in keys:
        val = raw.get(key)
        if val is not None and str(val).strip():
            return str(val).strip()
    return ""


def _is_truthy(val: Any) -> bool:
    if val is True or val == 1:
        return True
    if isinstance(val, str):
        return val.strip().lower() in ("1", "true", "yes", "да")
    return False


def _detect_pickup(label: str, raw: dict) -> bool:
    if _is_truthy(raw.get("is_pickup")) or _is_truthy(raw.get("pickup")):
        return True
    low = label.lower()
    return "самовывоз" in low or "pickup" in low


def _detect_card_payment(label: str, raw: dict) -> bool:
    if _is_truthy(raw.get("is_card")) or _is_truthy(raw.get("card")):
        return True
    low = label.lower()
    return "карт" in low or "card" in low


def payment_requires_requisite(label: str, raw: dict) -> bool:
    """Определяет, нужен ли requisite_id для способа оплаты в GetCheckout."""
    if _detect_card_payment(label, raw):
        return True
    for key in (
        "requisite",
        "need_requisite",
        "requires_requisite",
        "requisit",
        "needRequisite",
        "RequisiteRequired",
    ):
        if _is_truthy(raw.get(key)):
            return True
    low = label.lower()
    if any(
        token in low
        for token in ("безнал", "б/н", "счёт", "счет", "invoice", "перечисл", "карт")
    ):
        return True
    return False


def _unwrap_result_node(raw: dict) -> dict:
    """SOAP-ответ может быть обёрнут в SearchResult / result."""
    for key in ("SearchResult", "searchResult", "GetCheckoutDetailsResult", "result"):
        nested = raw.get(key)
        if isinstance(nested, dict):
            return nested
    return raw


def _parse_deliveries(raw: dict) -> list[RosskoDeliveryOption]:
    deliveries: list[RosskoDeliveryOption] = []
    for container_key in ("DeliveryType", "deliveryType", "TypeDelivery"):
        if container_key not in raw:
            continue
        items = _as_list(raw[container_key])
        for item in items:
            if not isinstance(item, dict):
                continue
            did = _pick_id(item, "id", "delivery_id", "DeliveryId")
            if not did:
                continue
            label = _pick_label(item, "name", "Name", "title", "description", "label") or f"Доставка {did}"
            is_pickup = _detect_pickup(label, item)
            deliveries.append(
                RosskoDeliveryOption(
                    id=did,
                    label=label,
                    is_pickup=is_pickup,
                    requires_address=not is_pickup,
                    raw=item,
                )
            )
    return deliveries


def _parse_addresses(raw: dict) -> list[RosskoOptionItem]:
    addresses: list[RosskoOptionItem] = []
    for container_key in ("DeliveryAddress", "deliveryAddress", "AddressDelivery"):
        if container_key not in raw:
            continue
        items = _as_list(raw[container_key])
        for item in items:
            if not isinstance(item, dict):
                continue
            aid = _pick_id(item, "id", "address_id", "AddressId")
            if not aid:
                continue
            parts = [
                _pick_label(item, "city", "City"),
                _pick_label(item, "street", "Street"),
                _pick_label(item, "house", "House", "dom", "Dom"),
                _pick_label(item, "office", "Office"),
            ]
            parts = [p for p in parts if p]
            label = ", ".join(parts) if parts else _pick_label(item, "name", "address", "title", "label")
            if not label:
                label = f"Адрес {aid}"
            addresses.append(RosskoOptionItem(id=aid, label=label, raw=item))
    return addresses


def _parse_payments(raw: dict) -> list[RosskoPaymentOption]:
    payments: list[RosskoPaymentOption] = []
    for container_key in ("PaymentType", "paymentType", "TypePayment"):
        if container_key not in raw:
            continue
        items = _as_list(raw[container_key])
        for item in items:
            if not isinstance(item, dict):
                continue
            pid_raw = _pick_id(item, "id", "payment_id", "PaymentId")
            if not pid_raw:
                continue
            try:
                pid = int(pid_raw)
            except (TypeError, ValueError):
                continue
            label = _pick_label(item, "name", "Name", "title", "description", "label") or f"Оплата {pid}"
            is_card = _detect_card_payment(label, item)
            needs_requisite = payment_requires_requisite(label, item)
            payments.append(
                RosskoPaymentOption(
                    id=pid,
                    label=label,
                    is_card=is_card,
                    requires_requisite=needs_requisite,
                    raw=item,
                )
            )
    return payments


def _format_company_label(item: dict, rid: str) -> str:
    name = _pick_label(item, "name", "Name")
    requisite_text = _pick_label(item, "requisite", "Requisites", "requisite_text")
    if name and requisite_text:
        short = requisite_text if len(requisite_text) <= 100 else f"{requisite_text[:100]}…"
        return f"{name} — {short}"
    if name:
        return name
    if requisite_text:
        return requisite_text if len(requisite_text) <= 120 else f"{requisite_text[:120]}…"
    return f"Реквизиты {rid}"


def _parse_requisites(raw: dict) -> list[RosskoOptionItem]:
    """Реквизиты Rossko: CompanyList → company (id, name, requisite)."""
    requisites: list[RosskoOptionItem] = []
    for container_key in ("CompanyList", "companyList", "Company"):
        if container_key not in raw:
            continue
        items = _as_list(raw[container_key])
        for item in items:
            if not isinstance(item, dict):
                continue
            rid = _pick_id(item, "id", "Id", "requisite_id", "RequisiteId")
            if not rid:
                continue
            label = _format_company_label(item, rid)
            requisites.append(RosskoOptionItem(id=rid, label=label, raw=item))
    return requisites


def _find_nested_lists(data: Any, depth: int = 0) -> dict[str, list]:
    """Запасной обход для нестандартных вложений."""
    found: dict[str, list] = {}
    if depth > 8 or data is None:
        return found
    if isinstance(data, dict):
        for key, value in data.items():
            key_low = str(key).lower()
            if isinstance(value, (list, dict)):
                items = _as_list(value)
                if items and isinstance(items[0], dict):
                    if "deliver" in key_low and "address" not in key_low:
                        found.setdefault("deliveries", []).extend(items)
                    elif "address" in key_low:
                        found.setdefault("addresses", []).extend(items)
                    elif "payment" in key_low or key_low == "pay":
                        found.setdefault("payments", []).extend(items)
                    elif "requisit" in key_low or key_low == "company":
                        found.setdefault("requisites", []).extend(items)
            if isinstance(value, dict):
                nested = _find_nested_lists(value, depth + 1)
                for nk, nv in nested.items():
                    found.setdefault(nk, []).extend(nv)
    return found


def _merge_unique_deliveries(primary: list[RosskoDeliveryOption], fallback: list[dict]) -> list[RosskoDeliveryOption]:
    if primary:
        return primary
    out: list[RosskoDeliveryOption] = []
    seen: set[str] = set()
    for item in fallback:
        if not isinstance(item, dict):
            continue
        did = _pick_id(item, "id", "delivery_id", "DeliveryId")
        if not did or did in seen:
            continue
        seen.add(did)
        label = _pick_label(item, "name", "title", "description", "label") or f"Доставка {did}"
        is_pickup = _detect_pickup(label, item)
        out.append(
            RosskoDeliveryOption(
                id=did,
                label=label,
                is_pickup=is_pickup,
                requires_address=not is_pickup,
                raw=item,
            )
        )
    return out


def _merge_unique_requisites(primary: list[RosskoOptionItem], fallback: list[dict]) -> list[RosskoOptionItem]:
    if primary:
        return primary
    out: list[RosskoOptionItem] = []
    seen: set[str] = set()
    for item in fallback:
        if not isinstance(item, dict):
            continue
        rid = _pick_id(item, "id", "requisite_id", "RequisiteId")
        if not rid or rid in seen:
            continue
        seen.add(rid)
        label = _format_company_label(item, rid) if item.get("requisite") or item.get("name") else (
            _pick_label(item, "name", "title", "description", "label") or f"Реквизиты {rid}"
        )
        out.append(RosskoOptionItem(id=rid, label=label, raw=item))
    return out


def get_checkout_details_error(raw: dict) -> str | None:
    """Текст ошибки из ответа Rossko (success=false)."""
    node = _unwrap_result_node(raw)
    has_flag = "success" in raw or (isinstance(node, dict) and "success" in node)
    if not has_flag:
        return None
    if _is_truthy(raw.get("success")) or _is_truthy(node.get("success") if isinstance(node, dict) else None):
        return None
    msg = _pick_label(node, "message", "Message", "error", "Error") if isinstance(node, dict) else ""
    if not msg:
        msg = _pick_label(raw, "message", "Message", "error", "Error")
    return msg or "Rossko GetCheckoutDetails: запрос не выполнен"


def normalize_checkout_details(raw: Any) -> RosskoCheckoutDetailsResponse:
    if not isinstance(raw, dict):
        return RosskoCheckoutDetailsResponse(raw={"value": raw})

    node = _unwrap_result_node(raw)
    buckets = _find_nested_lists(node)

    deliveries = _merge_unique_deliveries(_parse_deliveries(node), buckets.get("deliveries", []))
    addresses = _parse_addresses(node) or [
        RosskoOptionItem(
            id=_pick_id(item, "id", "address_id", "AddressId") or "",
            label=_pick_label(item, "name", "address", "city") or f"Адрес",
            raw=item,
        )
        for item in buckets.get("addresses", [])
        if isinstance(item, dict) and _pick_id(item, "id", "address_id", "AddressId")
    ]
    # dedupe addresses
    addr_seen: set[str] = set()
    unique_addresses: list[RosskoOptionItem] = []
    for a in addresses:
        if a.id and a.id not in addr_seen:
            addr_seen.add(a.id)
            unique_addresses.append(a)

    payments = _parse_payments(node)
    if not payments:
        for item in buckets.get("payments", []):
            if not isinstance(item, dict):
                continue
            pid_raw = _pick_id(item, "id", "payment_id", "PaymentId")
            if not pid_raw:
                continue
            try:
                pid = int(pid_raw)
            except (TypeError, ValueError):
                continue
            label = _pick_label(item, "name", "title", "description", "label") or f"Оплата {pid}"
            payments.append(
                RosskoPaymentOption(
                    id=pid,
                    label=label,
                    is_card=_detect_card_payment(label, item),
                    requires_requisite=payment_requires_requisite(label, item),
                    raw=item,
                )
            )

    requisites = _merge_unique_requisites(_parse_requisites(node), buckets.get("requisites", []))

    return RosskoCheckoutDetailsResponse(
        deliveries=deliveries,
        addresses=unique_addresses,
        payments=payments,
        requisites=requisites,
        raw=node,
    )
