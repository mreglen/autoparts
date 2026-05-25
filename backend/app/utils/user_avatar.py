from __future__ import annotations

import shutil
from pathlib import Path
from typing import Optional

from sqlalchemy.orm import Session

from app.models.user import User
from app.utils.phone import normalize_to_storage_format

MAX_AVATAR_SIZE = 5 * 1024 * 1024  # 5MB
ALLOWED_AVATAR_EXTENSIONS = {".jpg", ".jpeg", ".png", ".webp", ".gif"}
ALLOWED_AVATAR_MIME = {
    "image/jpeg",
    "image/png",
    "image/webp",
    "image/gif",
}


def avatar_public_url(path: str | None) -> str | None:
    if not path:
        return None
    p = path.strip()
    if not p:
        return None
    if p.startswith("http://") or p.startswith("https://"):
        return p
    if not p.startswith("/"):
        p = f"/{p}"
    return p


def _avatar_dir(user_id: int) -> Path:
    return Path("uploads") / "user_avatars" / str(user_id)


def delete_avatar_files(user_id: int) -> None:
    folder = _avatar_dir(user_id)
    if folder.exists():
        try:
            shutil.rmtree(folder)
        except OSError:
            pass


def save_user_avatar_file(user_id: int, file_content: bytes, ext: str) -> str:
    """Save avatar bytes and return relative URL path."""
    ext = ext.lower() if ext else ".jpg"
    if ext not in ALLOWED_AVATAR_EXTENSIONS:
        ext = ".jpg"

    delete_avatar_files(user_id)
    folder = _avatar_dir(user_id)
    folder.mkdir(parents=True, exist_ok=True)

    filename = f"avatar{ext}"
    file_path = folder / filename
    file_path.write_bytes(file_content)

    return f"/uploads/user_avatars/{user_id}/{filename}"


def remove_user_avatar(db: Session, user: User) -> str | None:
    """Remove avatar file and clear DB field. Returns old URL."""
    old_url = user.avatar_url
    delete_avatar_files(user.id)
    user.avatar_url = None
    db.commit()
    db.refresh(user)
    return old_url


def resolve_user_by_contact(
    db: Session,
    phone: str | None,
    email: str | None,
) -> User | None:
    """Find a user by normalized phone or email (for garage orders)."""
    if email and email.strip():
        row = db.query(User).filter(User.email == email.strip()).first()
        if row:
            return row

    if phone and phone.strip():
        normalized = normalize_to_storage_format(phone.strip())
        if normalized:
            row = db.query(User).filter(User.phone == normalized).first()
            if row:
                return row
        row = db.query(User).filter(User.phone == phone.strip()).first()
        if row:
            return row

    return None
