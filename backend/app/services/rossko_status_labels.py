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
