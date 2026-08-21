from __future__ import annotations

from app.models.autoservice_payer import AutoservicePayer

_VALID_PERSON_TYPES = {"individual", "ie", "legal"}


def normalize_person_type(value: str | None) -> str:
    if value in _VALID_PERSON_TYPES:
        return value
    return "individual"


def payer_catalog_name(
    person_type: str | None,
    name: str | None,
    legal_name: str | None,
) -> str:
    person_type = normalize_person_type(person_type)
    contact = (name or "").strip()
    legal = (legal_name or "").strip()
    if person_type == "legal":
        return legal or contact
    if person_type == "ie":
        return legal or (f"ИП {contact}" if contact else "")
    return contact


def payer_catalog_name_from_row(row: AutoservicePayer) -> str:
    return payer_catalog_name(row.person_type, row.name, row.legal_name)


def apply_person_type_defaults(row: AutoservicePayer) -> None:
    person_type = normalize_person_type(row.person_type)
    row.person_type = person_type
    if person_type == "individual":
        row.legal_name = None
        row.kpp = None
        row.ogrn = None
    elif person_type == "ie":
        row.kpp = None
