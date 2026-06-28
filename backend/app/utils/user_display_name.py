from __future__ import annotations

from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from app.models.user import User


def format_user_short_name(user: "User | None") -> str | None:
    if not user:
        return None
    initials = f"{user.first_name[0]}." if user.first_name else ""
    if user.patronymic:
        initials += f"{user.patronymic[0]}."
    name = f"{user.last_name or ''} {initials}".strip()
    return name or None


def format_user_full_name(user: "User | None") -> str | None:
    if not user:
        return None
    parts = [
        (user.last_name or "").strip(),
        (user.first_name or "").strip(),
        (user.patronymic or "").strip(),
    ]
    name = " ".join(part for part in parts if part)
    return name or None
