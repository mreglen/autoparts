"""Public user codes: one Latin letter + 6 non-sequential digits (e.g. K482917)."""
from __future__ import annotations

import re
import secrets
import string
from typing import Optional

from sqlalchemy.orm import Session

from app.models.user import User as UserModel

PUBLIC_CODE_PATTERN = re.compile(r"^[A-Z][0-9]{6}$")
PUBLIC_CODE_LENGTH = 7
_MAX_ALLOCATION_ATTEMPTS = 200


def _digits_are_sequential(digits: str) -> bool:
    """True if all six digits are identical or strictly +/-1 steps."""
    if len(digits) != 6 or not digits.isdigit():
        return True
    if len(set(digits)) == 1:
        return True
    diffs = [int(digits[i + 1]) - int(digits[i]) for i in range(5)]
    if all(d == 1 for d in diffs) or all(d == -1 for d in diffs):
        return True
    return False


def is_valid_public_code(code: Optional[str]) -> bool:
    """Letter A–Z + 6 digits; digits must not run in strict order."""
    if not code:
        return False
    normalized = str(code).strip().upper()
    if not PUBLIC_CODE_PATTERN.match(normalized):
        return False
    return not _digits_are_sequential(normalized[1:])


def needs_public_code_migration(code: Optional[str]) -> bool:
    """Missing, wrong shape, or old numeric-only sequential ids."""
    return not is_valid_public_code(code)


def _generate_candidate() -> str:
    letter = secrets.choice(string.ascii_uppercase)
    for _ in range(50):
        digits = "".join(secrets.choice(string.digits) for _ in range(6))
        if not _digits_are_sequential(digits):
            return f"{letter}{digits}"
    # Fallback: shift one digit if random kept hitting sequential (extremely rare)
    digits = "024681"
    return f"{letter}{digits}"


def allocate_public_code(db: Session, *, exclude_user_id: Optional[int] = None) -> str:
    """Random unique code; retries on collision (DB unique index)."""
    for _ in range(_MAX_ALLOCATION_ATTEMPTS):
        candidate = _generate_candidate()
        q = db.query(UserModel.id).filter(UserModel.public_code == candidate)
        if exclude_user_id is not None:
            q = q.filter(UserModel.id != exclude_user_id)
        if not db.query(q.exists()).scalar():
            return candidate
    raise RuntimeError("Не удалось сгенерировать уникальный public_code")


def assign_public_code(user: UserModel, db: Session, *, force: bool = False) -> bool:
    """Set public_code on user. Returns True if assigned or updated."""
    current = getattr(user, "public_code", None)
    if not force and is_valid_public_code(current):
        return False
    user.public_code = allocate_public_code(db, exclude_user_id=getattr(user, "id", None))
    return True


def remigrate_invalid_public_codes(db: Session, *, dry_run: bool = False) -> list[tuple[int, str | None, str]]:
    """
    Replace missing/invalid codes. Returns list of (user_id, old_code, new_code) for updates.
    Caller must commit when not dry_run.
    """
    users = db.query(UserModel).order_by(UserModel.id.asc()).all()
    changes: list[tuple[int, str | None, str]] = []
    for u in users:
        if not needs_public_code_migration(u.public_code):
            continue
        old = u.public_code
        if dry_run:
            changes.append((u.id, old, "(dry-run)"))
            continue
        assign_public_code(u, db, force=True)
        if not is_valid_public_code(u.public_code):
            raise RuntimeError(f"Invalid generated code for user {u.id}: {u.public_code!r}")
        changes.append((u.id, old, u.public_code))
    return changes
