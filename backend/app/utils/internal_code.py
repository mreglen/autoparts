"""Внутренний код товара: {ORG_PREFIX}-{LETTERS5}, например QMHB-AAAAA."""
from __future__ import annotations

import re
from typing import Iterable

from sqlalchemy.orm import Session

INTERNAL_CODE_PATTERN = re.compile(r"^[A-Z0-9]{4}-[A-Z]{5}$")
SUFFIX_WIDTH = 5
PREFIX_LEN = 4
MAX_SUFFIX_INDEX = 26**SUFFIX_WIDTH - 1


def org_prefix(organization_id: str | None) -> str:
    if not organization_id:
        raise ValueError("organization_id is required for internal code")
    return organization_id[:PREFIX_LEN].upper()


def int_to_letters(n: int, width: int = SUFFIX_WIDTH) -> str:
    if n < 0:
        raise ValueError("n must be non-negative")
    if n > MAX_SUFFIX_INDEX:
        raise ValueError(f"n exceeds maximum for width {width}")
    chars: list[str] = []
    value = n
    for _ in range(width):
        chars.append(chr(ord("A") + (value % 26)))
        value //= 26
    return "".join(reversed(chars))


def letters_to_int(s: str) -> int:
    value = 0
    for ch in s:
        if not ("A" <= ch <= "Z"):
            raise ValueError(f"invalid letter: {ch}")
        value = value * 26 + (ord(ch) - ord("A"))
    return value


def is_valid_internal_code(code: str | None) -> bool:
    if not code:
        return False
    return INTERNAL_CODE_PATTERN.match(str(code).strip()) is not None


def parse_internal_code(code: str) -> tuple[str, str] | None:
    if not is_valid_internal_code(code):
        return None
    prefix, suffix = code.split("-", 1)
    return prefix, suffix


def build_internal_code(organization_id: str, suffix_index: int) -> str:
    return f"{org_prefix(organization_id)}-{int_to_letters(suffix_index)}"


def _max_suffix_index(codes: Iterable[str | None], prefix: str) -> int:
    max_idx = -1
    for code in codes:
        if not code:
            continue
        parsed = parse_internal_code(code)
        if parsed and parsed[0] == prefix:
            max_idx = max(max_idx, letters_to_int(parsed[1]))
    return max_idx


def _collect_org_codes(db: Session, organization_id: str) -> list[str]:
    from app.models.pending_product import PendingProduct as PendingProductModel
    from app.models.product import Product as ProductModel

    product_codes = [
        row[0]
        for row in db.query(ProductModel.internal_code)
        .filter(ProductModel.organization_id == organization_id)
        .all()
    ]
    pending_codes = [
        row[0]
        for row in db.query(PendingProductModel.internal_code)
        .filter(PendingProductModel.organization_id == organization_id)
        .all()
    ]
    return product_codes + pending_codes


def _code_exists_globally(
    db: Session,
    code: str,
    *,
    reserved_codes: set[str] | None = None,
) -> bool:
    from app.models.pending_product import PendingProduct as PendingProductModel
    from app.models.product import Product as ProductModel

    if reserved_codes and code in reserved_codes:
        return True
    if db.query(ProductModel.id).filter(ProductModel.internal_code == code).first():
        return True
    if db.query(PendingProductModel.id).filter(PendingProductModel.internal_code == code).first():
        return True
    return False


def next_internal_code(
    db: Session,
    organization_id: str,
    *,
    reserved_codes: set[str] | None = None,
    start_suffix_index: int | None = None,
) -> str:
    """Следующий уникальный internal_code для организации."""
    prefix = org_prefix(organization_id)
    reserved = reserved_codes or set()

    if start_suffix_index is not None:
        idx = start_suffix_index
    else:
        idx = _max_suffix_index(_collect_org_codes(db, organization_id), prefix) + 1

    while idx <= MAX_SUFFIX_INDEX:
        candidate = f"{prefix}-{int_to_letters(idx)}"
        if candidate not in reserved and not _code_exists_globally(db, candidate, reserved_codes=reserved):
            return candidate
        idx += 1

    raise RuntimeError("internal code space exhausted for organization")


def resolve_internal_code_for_import(
    db: Session,
    organization_id: str,
    unique_ad_id: str | None = None,
    *,
    reserved_codes: set[str] | None = None,
) -> str:
    """Avito/import: сохранить валидный код org, иначе выдать новый."""
    candidate = (unique_ad_id or "").strip()
    prefix = org_prefix(organization_id)
    if candidate and is_valid_internal_code(candidate) and candidate.startswith(f"{prefix}-"):
        if not _code_exists_globally(db, candidate, reserved_codes=reserved_codes):
            return candidate
    return next_internal_code(db, organization_id, reserved_codes=reserved_codes)
