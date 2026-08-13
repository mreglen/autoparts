"""Человекочитаемые подписи статусов Rossko GetOrders (коды номенклатуры)."""
from __future__ import annotations

# https://api.rossko.ru — GetOrders, поле status у строки заказа
ROSSKO_LINE_STATUS_LABELS: dict[str, str] = {
    "0": "Ждёт подтверждения",
    "1": "Комплектуется",
    "2": "Отгружено",
    "3": "Готово к отгрузке",
    "5": "Ожидаем поступление",
    "6": "На складе филиала",
    "7": "Нет в наличии",
    "8": "Отменён клиентом",
    "9": "Просрочен",
    "31": "Ожидаем товар на складе",
    "32": "Возврат на согласовании",
    "33": "Товар на экспертизе",
    "34": "Возврат отклонён",
    "35": "Возврат частично отклонён",
    "36": "Товар возвращён",
}


# Локальные статусы "новых запчастей" (5 стадий для UI и хранения в БД).
# Код статуса — то, что хранится в garage_new_orders.status_code / garage_new_order_items.status_code.
NEW_PARTS_STATUS_CODES: dict[str, str] = {
    "new_waiting_confirmation": "Ждёт подтверждения",
    "new_assembling": "Комплектуется",
    "new_shipped": "Отгружено",
    "new_awaiting_arrival": "Ожидает поступления",
    "new_ready_for_pickup": "К выдаче",
    "new_received": "Получен",
}

# Приоритет стадий для определения статуса заказа по позициям (чем больше — тем "позже").
NEW_PARTS_STATUS_PRIORITY: dict[str, int] = {
    "new_waiting_confirmation": 1,
    "new_assembling": 2,
    "new_shipped": 3,
    "new_awaiting_arrival": 4,
    "new_ready_for_pickup": 5,
    "new_received": 6,
}


# Нормализация Rossko-кодов номенклатуры в 5 локальных стадий.
# При необходимости маппинг можно уточнить под реальную логику Rossko для "получен".
ROSSKO_LINE_STATUS_TO_NEW_PARTS_STATUS_CODE: dict[str, str] = {
    # До отгрузки
    "0": "new_waiting_confirmation",
    "1": "new_assembling",
    "3": "new_assembling",  # "готово к отгрузке" => всё ещё в сборке
    # Отгрузка
    "2": "new_shipped",
    # Между отгрузкой и получением
    "5": "new_awaiting_arrival",
    "31": "new_awaiting_arrival",

    # "на складе филиала" трактуем как "получен" для UI
    "6": "new_received",

    # Терминальные статусы (отмена/просрочка/возвраты) — считаем "получен" как конечный статус
    "7": "new_received",
    "8": "new_received",
    "9": "new_received",
    "32": "new_received",
    "33": "new_received",
    "34": "new_received",
    "35": "new_received",
    "36": "new_received",
}


def map_rossko_line_status_to_new_parts_status_code(
    raw: str | int | None,
    *,
    for_seller: bool = False,
) -> str | None:
    """Переводит Rossko status-код строки номенклатуры в локальный status_code (1 из 5)."""
    if raw is None:
        return None
    text = str(raw).strip()
    if not text:
        return None
    mapped = ROSSKO_LINE_STATUS_TO_NEW_PARTS_STATUS_CODE.get(text)
    # Для продавца «на складе филиала» ещё не выдано покупателю — ждём «К выдаче».
    if for_seller and text == "6" and mapped == "new_received":
        return "new_awaiting_arrival"
    return mapped


def format_rossko_status(raw: str | int | None) -> str | None:
    """Возвращает подпись для UI или None, если показывать бейдж не нужно."""
    if raw is None:
        return None
    text = str(raw).strip()
    if not text:
        return None
    if text in ROSSKO_LINE_STATUS_LABELS:
        return ROSSKO_LINE_STATUS_LABELS[text]
    if text.isdigit():
        return None
    return text
