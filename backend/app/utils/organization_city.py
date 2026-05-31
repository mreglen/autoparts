from __future__ import annotations

import re

DEFAULT_CITY = "Екатеринбург"

_CITY_PREP = {
    "екатеринбург": "Екатеринбурге",
    "москва": "Москве",
    "санкт-петербург": "Санкт-Петербурге",
    "новосибирск": "Новосибирске",
    "казань": "Казани",
    "нижний новгород": "Нижнем Новгороде",
    "челябинск": "Челябинске",
    "самара": "Самаре",
    "омск": "Омске",
    "ростов-на-дону": "Ростове-на-Дону",
    "уфа": "Уфе",
    "красноярск": "Красноярске",
    "пермь": "Перми",
    "воронеж": "Воронеже",
    "волгоград": "Волгограде",
}


def extract_city_from_address(address: str | None) -> str:
    value = re.sub(r"\s+", " ", str(address or "")).strip()
    if not value:
        return DEFAULT_CITY

    city_match = re.search(
        r"(?:^|[,\s])(?:г\.?\s*|город\s+)([А-Яа-яЁё][А-Яа-яЁё\s\-]+?)(?=[,\s]|$)",
        value,
        flags=re.IGNORECASE,
    )
    if city_match:
        city = city_match.group(1).strip(" ,")
        if city:
            return city[0].upper() + city[1:]

    after_index = re.search(
        r"\b\d{6}\b[,\s]+(?:[А-Яа-яЁё\-]+\s+)?(?:обл\.|область|край|респ\.|республика)?[,\s]*([А-Яа-яЁё][А-Яа-яЁё\-]+)",
        value,
        flags=re.IGNORECASE,
    )
    if after_index:
        city = after_index.group(1).strip(" ,")
        if city and city.lower() not in {"обл", "область", "край", "респ", "республика"}:
            return city[0].upper() + city[1:]

    return DEFAULT_CITY


def format_city_in_prepositional(city: str | None) -> str:
    normalized = re.sub(r"\s+", " ", str(city or "")).strip()
    if not normalized:
        normalized = DEFAULT_CITY
    key = normalized.casefold()
    if key in _CITY_PREP:
        return _CITY_PREP[key]
    if normalized.endswith(("а", "я")):
        return f"{normalized[:-1]}е"
    return normalized
