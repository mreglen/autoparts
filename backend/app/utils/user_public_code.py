"""Public user codes (1000001, 1000002, …) for display and audit search."""
from __future__ import annotations

from sqlalchemy import func
from sqlalchemy.orm import Session

from app.models.user import User as UserModel

PUBLIC_CODE_START = 1_000_001


def allocate_public_code(db: Session) -> str:
    """Next sequential public code; safe under concurrent inserts via DB unique constraint + retry."""
    max_raw = db.query(func.max(UserModel.public_code)).scalar()
    if not max_raw:
        return str(PUBLIC_CODE_START)
    try:
        return str(int(str(max_raw).strip()) + 1)
    except (TypeError, ValueError):
        return str(PUBLIC_CODE_START)


def assign_public_code(user: UserModel, db: Session) -> None:
    """Set public_code on a new user before flush/commit."""
    if getattr(user, "public_code", None):
        return
    user.public_code = allocate_public_code(db)
