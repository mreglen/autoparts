"""Shared handling of the three requisite sets (individual / IE / legal entity)."""
from __future__ import annotations

from typing import Any, Optional

REQUISITE_KINDS = ("individual", "ie", "legal")

REQUISITE_FIELDS = (
    "person_type_default",
    "ind_name",
    "ie_name",
    "legal_name",
    "inn_individual",
    "inn_ie",
    "inn_legal",
    "kpp",
    "ogrnip",
    "ogrn",
    "address",
    "email",
)

NAME_COLUMN_BY_KIND = {
    "individual": "ind_name",
    "ie": "ie_name",
    "legal": "legal_name",
}

INN_COLUMN_BY_KIND = {
    "individual": "inn_individual",
    "ie": "inn_ie",
    "legal": "inn_legal",
}

OGRN_COLUMN_BY_KIND = {
    "ie": "ogrnip",
    "legal": "ogrn",
}


def normalize_requisite_kind(value: Optional[str]) -> str:
    return value if value in REQUISITE_KINDS else "individual"


def apply_requisite_sets(target: Any, source: Any) -> None:
    for field in REQUISITE_FIELDS:
        setattr(target, field, getattr(source, field, None))
    target.person_type_default = normalize_requisite_kind(
        getattr(source, "person_type_default", None)
    )


def requisite_sets_from_obj(obj: Any) -> dict[str, Any]:
    return {field: getattr(obj, field, None) for field in REQUISITE_FIELDS}


def requisite_name(obj: Any, kind: str) -> str:
    return (getattr(obj, NAME_COLUMN_BY_KIND.get(kind, "ind_name"), None) or "").strip()


def requisite_inn(obj: Any, kind: str) -> str:
    return (getattr(obj, INN_COLUMN_BY_KIND.get(kind, "inn_individual"), None) or "").strip()


def requisite_is_filled(obj: Any, kind: str) -> bool:
    return bool(requisite_name(obj, kind) or requisite_inn(obj, kind))
