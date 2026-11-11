from __future__ import annotations

from datetime import date, datetime
from decimal import Decimal, ROUND_HALF_UP

from app.schemas.repair_order import RepairOrderWorkView

_TWO_PLACES = Decimal("0.01")
_THREE_PLACES = Decimal("0.001")
_SPACE = "\u00a0"

UNIT_LABELS = {"pcs": "шт.", "l": "л", "kg": "кг"}

_ONES_M = [
    "",
    "один",
    "два",
    "три",
    "четыре",
    "пять",
    "шесть",
    "семь",
    "восемь",
    "девять",
]
_ONES_F = [
    "",
    "одна",
    "две",
    "три",
    "четыре",
    "пять",
    "шесть",
    "семь",
    "восемь",
    "девять",
]
_TEENS = [
    "десять",
    "одиннадцать",
    "двенадцать",
    "тринадцать",
    "четырнадцать",
    "пятнадцать",
    "шестнадцать",
    "семнадцать",
    "восемнадцать",
    "девятнадцать",
]
_TENS = [
    "",
    "",
    "двадцать",
    "тридцать",
    "сорок",
    "пятьдесят",
    "шестьдесят",
    "семьдесят",
    "восемьдесят",
    "девяносто",
]
_HUNDREDS = [
    "",
    "сто",
    "двести",
    "триста",
    "четыреста",
    "пятьсот",
    "шестьсот",
    "семьсот",
    "восемьсот",
    "девятьсот",
]
_MONTHS_GENITIVE = [
    "января",
    "февраля",
    "марта",
    "апреля",
    "мая",
    "июня",
    "июля",
    "августа",
    "сентября",
    "октября",
    "ноября",
    "декабря",
]


def money(value: Decimal | int | float | str | None) -> Decimal:
    return Decimal(str(value or 0)).quantize(_TWO_PLACES, rounding=ROUND_HALF_UP)


def _grouped(integer_part: str, fraction_part: str) -> str:
    chunks: list[str] = []
    while len(integer_part) > 3:
        chunks.insert(0, integer_part[-3:])
        integer_part = integer_part[:-3]
    chunks.insert(0, integer_part)
    grouped = _SPACE.join(chunks)
    return f"{grouped},{fraction_part}" if fraction_part else grouped


def format_money(value: Decimal | int | float | str | None) -> str:
    """Сумма как в веб-печати: «1 234,56» с неразрывным пробелом в разрядах."""
    amount = money(value)
    sign = "-" if amount < 0 else ""
    digits = str(abs(amount))
    integer, _, fraction = digits.partition(".")
    return f"{sign}{_grouped(integer, fraction or '00')}"


def format_integer_ru(value: int | None) -> str:
    """Целое с группировкой разрядов — как `Number.toLocaleString('ru-RU')`."""
    if value is None:
        return ""
    number = int(value)
    return f"{'-' if number < 0 else ''}{_grouped(str(abs(number)), '')}"


def format_quantity(qty: Decimal | int | float | str | None, unit: str = "pcs") -> str:
    """Количество позиции: штуки целым числом, остальные единицы — до трёх знаков."""
    value = Decimal(str(qty or 0))
    if (unit or "pcs") == "pcs":
        return str(int(value.quantize(Decimal("1"), rounding=ROUND_HALF_UP)))
    digits = str(value.quantize(_THREE_PLACES, rounding=ROUND_HALF_UP)).rstrip("0").rstrip(".")
    integer, _, fraction = digits.partition(".")
    return _grouped(integer or "0", fraction)


def format_unit(unit: str | None) -> str:
    return UNIT_LABELS.get(unit or "pcs", unit or "шт.")


def split_vat_inclusive(amount: Decimal | int | float | str, rate: Decimal | int | float) -> tuple[Decimal, Decimal]:
    """Возвращает (НДС, сумма без НДС) для суммы, в которую НДС уже включён."""
    with_vat = money(amount)
    vat_rate = Decimal(str(rate or 0))
    if vat_rate <= 0:
        return Decimal("0.00"), with_vat
    vat = (with_vat * vat_rate / (Decimal("100") + vat_rate)).quantize(
        _TWO_PLACES, rounding=ROUND_HALF_UP
    )
    return vat, money(with_vat - vat)


def _plural(n: int, one: str, few: str, many: str) -> str:
    last_one = n % 10
    last_two = n % 100
    if last_one == 1 and last_two != 11:
        return one
    if 2 <= last_one <= 4 and not 12 <= last_two <= 14:
        return few
    return many


def _triad_to_words(value: int, female: bool) -> list[str]:
    if not value:
        return []
    ones = _ONES_F if female else _ONES_M
    parts: list[str] = []
    hundreds, rest = divmod(value, 100)
    if hundreds:
        parts.append(_HUNDREDS[hundreds])
    if 10 <= rest <= 19:
        parts.append(_TEENS[rest - 10])
        return parts
    tens, unit = divmod(rest, 10)
    if tens:
        parts.append(_TENS[tens])
    if unit:
        parts.append(ones[unit])
    return parts


def rubles_in_words(amount: Decimal | int | float | str | None) -> str:
    cents = int(money(amount) * 100)
    rubles, kopecks = divmod(abs(cents), 100)
    minus = cents < 0
    if not rubles:
        zero = f"Ноль рублей {kopecks:02d} {_plural(kopecks, 'копейка', 'копейки', 'копеек')}"
        return f"Минус {zero.lower()}" if minus else zero
    scales = [
        (False, "", "", ""),
        (True, "тысяча", "тысячи", "тысяч"),
        (False, "миллион", "миллиона", "миллионов"),
        (False, "миллиард", "миллиарда", "миллиардов"),
    ]
    groups: list[str] = []
    rest = rubles
    for female, one, few, many in scales:
        triad = rest % 1000
        rest //= 1000
        if not triad:
            continue
        words = _triad_to_words(triad, female)
        if one:
            words.append(_plural(triad, one, few, many))
        groups = words + groups
    text = " ".join(groups).replace("  ", " ").strip()
    text = text[0].upper() + text[1:]
    result = (
        f"{text} {_plural(rubles, 'рубль', 'рубля', 'рублей')} "
        f"{kopecks:02d} {_plural(kopecks, 'копейка', 'копейки', 'копеек')}"
    )
    return f"Минус {result[0].lower()}{result[1:]}" if minus else result


def format_date(value: datetime | date | None) -> str:
    return value.strftime("%d.%m.%Y") if value else ""


def format_long_date(value: datetime | date | None) -> str:
    if not value:
        return ""
    return f"{value.day} {_MONTHS_GENITIVE[value.month - 1]} {value.year} г."


def work_executors_label(work: RepairOrderWorkView) -> str:
    """Исполнители работы одной строкой — как в веб-печати, не по элементам."""
    names: list[str] = []
    employees = ", ".join(
        ex.employee.name for ex in work.executors if ex.employee and ex.employee.name
    )
    if employees:
        names.append(employees)
    elif work.executor and work.executor.name:
        names.append(work.executor.name)
    names.extend(
        f"{row.contractor.name} (подряд)"
        for row in work.contractors
        if row.contractor and row.contractor.name
    )
    return "; ".join(names)


def buyer_name(person_type: str | None, name: str | None, legal_name: str | None) -> str:
    """Наименование заказчика для печатных форм по типу покупателя."""
    kind = (person_type or "individual").strip().lower()
    plain = (name or "").strip()
    legal = (legal_name or "").strip()
    if kind == "legal":
        return legal or plain
    if kind == "ie":
        return legal or (f"ИП {plain}" if plain else "")
    return plain
