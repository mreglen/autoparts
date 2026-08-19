"""Загрузка и нормализация заказов Rossko через GetOrders."""
from __future__ import annotations

import logging
from dataclasses import dataclass, field
from typing import Any

from zeep.helpers import serialize_object

from app.utils.rossko_api_keys import get_rossko_api_keys

logger = logging.getLogger(__name__)

BATCH_SIZE = 50


@dataclass
class RosskoOrderLine:
    name: str = ""
    brand: str | None = None
    partnumber: str | None = None
    quantity: int = 1
    price: float = 0.0
    status_code: str = "pending"


@dataclass
class RosskoOrderSnapshot:
    order_id: str
    status: str | None = None
    lines: list[RosskoOrderLine] = field(default_factory=list)


def _clean_soap_params(data: Any) -> Any:
    if isinstance(data, dict):
        return {k: _clean_soap_params(v) for k, v in data.items() if v is not None}
    if isinstance(data, list):
        return [_clean_soap_params(i) for i in data]
    return data


def _as_list(value: Any) -> list:
    if value is None:
        return []
    if isinstance(value, list):
        return value
    if isinstance(value, dict):
        for key in ("item", "Item", "Order", "Orders", "Part", "Parts", "part", "parts"):
            if key in value:
                inner = value[key]
                return inner if isinstance(inner, list) else [inner]
        return [value]
    return [value]


def _pick_str(raw: dict, *keys: str) -> str | None:
    for key in keys:
        val = raw.get(key)
        if val is not None and str(val).strip():
            return str(val).strip()
    return None


def _pick_float(raw: dict, *keys: str) -> float:
    for key in keys:
        val = raw.get(key)
        if val is not None:
            try:
                return float(val)
            except (TypeError, ValueError):
                continue
    return 0.0


def _pick_int(raw: dict, *keys: str) -> int:
    for key in keys:
        val = raw.get(key)
        if val is not None:
            try:
                return int(val)
            except (TypeError, ValueError):
                continue
    return 1


def _parse_line(raw: dict) -> RosskoOrderLine:
    name = (
        _pick_str(raw, "name", "Name", "description", "Description", "title", "Title")
        or _pick_str(raw, "partname", "PartName")
        or "Товар"
    )
    brand = _pick_str(raw, "brand", "Brand", "manufacturer", "Manufacturer")
    partnumber = _pick_str(raw, "partnumber", "PartNumber", "part_number", "article", "Article")
    qty = _pick_int(raw, "count", "Count", "quantity", "Quantity", "qty", "Qty")
    price = _pick_float(raw, "price", "Price", "cost", "Cost", "amount", "Amount")
    line_status = _pick_str(raw, "status", "Status", "status_code", "StatusCode", "state", "State") or "pending"
    return RosskoOrderLine(
        name=name,
        brand=brand,
        partnumber=partnumber,
        quantity=qty,
        price=price,
        status_code=line_status,
    )


def _extract_order_id(raw: dict) -> str | None:
    for key in ("id", "Id", "order_id", "OrderId", "orderId"):
        val = raw.get(key)
        if val is not None and str(val).strip():
            return str(val).strip()
    return None


def _extract_order_status(raw: dict) -> str | None:
    # Не используем type/Type — там часто 0 (тип заказа), а не статус.
    for key in (
        "status_name",
        "StatusName",
        "StatusPayment",
        "statusPayment",
        "status",
        "Status",
        "state",
        "State",
    ):
        val = raw.get(key)
        if val is not None and str(val).strip():
            return str(val).strip()
    return None


def _extract_lines_from_order(raw: dict) -> list[RosskoOrderLine]:
    lines: list[RosskoOrderLine] = []
    for key in ("parts", "Parts", "items", "Items", "part", "Part", "lines", "Lines"):
        if key in raw:
            for part_raw in _as_list(raw[key]):
                if isinstance(part_raw, dict):
                    lines.append(_parse_line(part_raw))
    if not lines and any(k in raw for k in ("partnumber", "PartNumber", "brand", "Brand")):
        lines.append(_parse_line(raw))
    return lines


def _collect_orders_from_node(node: Any, out: dict[str, RosskoOrderSnapshot]) -> None:
    if node is None:
        return
    if isinstance(node, list):
        for item in node:
            _collect_orders_from_node(item, out)
        return
    if not isinstance(node, dict):
        return

    order_id = _extract_order_id(node)
    lines = _extract_lines_from_order(node)
    status = _extract_order_status(node)

    if order_id:
        existing = out.get(order_id)
        if existing:
            if status and not existing.status:
                existing.status = status
            if lines:
                existing.lines = lines
        else:
            out[order_id] = RosskoOrderSnapshot(order_id=order_id, status=status, lines=lines)

    for key in ("Orders", "orders", "Order", "order", "OrderList", "orderList", "result", "Result", "data", "Data"):
        if key in node:
            _collect_orders_from_node(node[key], out)

    if not order_id:
        for value in node.values():
            if isinstance(value, (dict, list)):
                _collect_orders_from_node(value, out)


def parse_get_orders_response(raw: Any) -> dict[str, RosskoOrderSnapshot]:
    """Парсит ответ GetOrders в словарь rossko_order_id -> snapshot."""
    out: dict[str, RosskoOrderSnapshot] = {}
    if raw is None:
        return out
    if isinstance(raw, dict):
        success = raw.get("success")
        if success is False or str(success).lower() == "false":
            msg = _pick_str(raw, "message", "Message", "error", "Error") or "Rossko GetOrders failed"
            logger.warning("GetOrders success=false: %s", msg)
            return out
    serialized = raw if isinstance(raw, dict) else serialize_object(raw)
    _collect_orders_from_node(serialized, out)
    return out


def fetch_orders_by_ids(order_ids: list[int]) -> dict[str, RosskoOrderSnapshot]:
    """Batch-запрос GetOrders по списку id. Пустой список — пустой результат."""
    unique_ids = sorted({int(i) for i in order_ids if i is not None})
    if not unique_ids:
        return {}

    merged: dict[str, RosskoOrderSnapshot] = {}
    from app.routers.rossko_api.rossko_api import get_orders_client

    client = get_orders_client()

    for offset in range(0, len(unique_ids), BATCH_SIZE):
        chunk = unique_ids[offset : offset + BATCH_SIZE]
        key1, key2 = get_rossko_api_keys()
        params = _clean_soap_params(
            {
                "KEY1": key1,
                "KEY2": key2,
                "order_ids": {"id": chunk},
            }
        )
        try:
            result = client.service.GetOrders(**params)
            serialized = serialize_object(result)
            parsed = parse_get_orders_response(serialized)
            merged.update(parsed)
        except Exception as exc:
            logger.exception("Rossko GetOrders batch failed for ids %s: %s", chunk, exc)
            raise

    return merged


def fetch_orders_by_ids_safe(order_ids: list[int]) -> tuple[dict[str, RosskoOrderSnapshot], str | None]:
    """Как fetch_orders_by_ids, но при ошибке возвращает пустой dict и текст ошибки."""
    try:
        return fetch_orders_by_ids(order_ids), None
    except Exception as exc:
        return {}, str(exc)
