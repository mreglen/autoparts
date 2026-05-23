from __future__ import annotations

from sqlalchemy.orm import Session

from app.models.site_quick_link import SiteQuickLink

DEFAULT_QUICK_LINKS: list[dict[str, str | int | bool]] = [
    {"title": "Каталог", "url": "/catalog", "sort_order": 10},
    {"title": "Б/у запчасти", "url": "/autoparts/used", "sort_order": 20},
    {"title": "Новые запчасти", "url": "/autoparts/new", "sort_order": 30},
    {"title": "Доставка", "url": "/delivery", "sort_order": 40},
    {"title": "Оплата", "url": "/payment", "sort_order": 50},
    {"title": "О компании", "url": "/about", "sort_order": 60},
]


def normalize_quick_link_url(url: str) -> str:
    value = (url or "").strip()
    if not value.startswith("/"):
        raise ValueError("URL должен начинаться с /")
    if value.startswith("//") or "://" in value:
        raise ValueError("URL должен быть относительным путём на сайте")
    return value


def ensure_default_quick_links(db: Session) -> None:
    count = db.query(SiteQuickLink).count()
    if count > 0:
        return
    for row in DEFAULT_QUICK_LINKS:
        db.add(
            SiteQuickLink(
                title=str(row["title"]),
                url=str(row["url"]),
                enabled=bool(row.get("enabled", True)),
                sort_order=int(row["sort_order"]),
            )
        )
    db.commit()


def list_quick_links(db: Session, *, enabled_only: bool = False) -> list[SiteQuickLink]:
    ensure_default_quick_links(db)
    query = db.query(SiteQuickLink)
    if enabled_only:
        query = query.filter(SiteQuickLink.enabled.is_(True))
    return query.order_by(SiteQuickLink.sort_order.asc(), SiteQuickLink.id.asc()).all()
