from __future__ import annotations

from datetime import datetime, timezone

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.models.site_review import SiteReview
from app.models.user import User
from app.schemas.site_review import SiteReviewCreateIn

DEFAULT_REVIEWS: list[dict] = [
    {
        "author_name": "Алексей М.",
        "author_role": "Покупатель",
        "text": "Заказывал б/у рулевую рейку — прислали с фото до отправки, всё совпало с описанием. Забрал самовывозом в тот же день.",
        "rating": 5,
        "source": "platform",
        "featured": True,
        "sort_order": 10,
    },
    {
        "author_name": "Ирина К.",
        "author_role": "Покупатель",
        "text": "Удобно, что можно написать продавцу в чат и уточнить совместимость. Нашла нужный генератор без долгих звонков.",
        "rating": 5,
        "source": "platform",
        "featured": True,
        "sort_order": 20,
    },
    {
        "author_name": "Дмитрий С.",
        "author_role": "Автосервис",
        "text": "Берём запчасти для клиентов регулярно. Каталог понятный, по артикулу находится быстро, цены адекватные.",
        "rating": 5,
        "source": "platform",
        "featured": True,
        "sort_order": 30,
    },
    {
        "author_name": "Марина В.",
        "author_role": "Покупатель",
        "text": "Первый раз пользовалась «Свой Гараж» — помогли подобрать аналог, доставили в ПВЗ за два дня. Рекомендую.",
        "rating": 5,
        "source": "platform",
        "featured": True,
        "sort_order": 40,
    },
    {
        "author_name": "Олег П.",
        "author_role": "Покупатель",
        "text": "Нормальный магазин: не навязывают лишнее, по телефону и в чате отвечают по делу. Товар пришёл упакованный аккуратно.",
        "rating": 4,
        "source": "yandex",
        "featured": True,
        "sort_order": 50,
    },
    {
        "author_name": "Елена Т.",
        "author_role": "Покупатель",
        "text": "Покупала кузовные детали — всё как на фото. Единственное, хотелось бы чуть больше ракурсов в карточках, но в целом отлично.",
        "rating": 5,
        "source": "yandex",
        "featured": True,
        "sort_order": 60,
    },
    {
        "author_name": "Виктор Н.",
        "author_role": "Покупатель",
        "text": "Брал стойки и опоры — подошли с первого раза. Цена ниже, чем в соседних магазинах на Уралмаше.",
        "rating": 5,
        "source": "avito",
        "featured": False,
        "sort_order": 70,
    },
    {
        "author_name": "Анна Р.",
        "author_role": "Покупатель",
        "text": "Спасибо за оперативную отправку. Трек пришёл сразу после оплаты, менеджер на связи.",
        "rating": 5,
        "source": "platform",
        "featured": False,
        "sort_order": 80,
    },
    {
        "author_name": "Сергей Л.",
        "author_role": "Продавец на платформе",
        "text": "Ведём склад через кабинет — удобно выгружать остатки и отвечать клиентам в одном месте.",
        "rating": 5,
        "source": "platform",
        "featured": False,
        "sort_order": 90,
    },
]


def ensure_default_site_reviews(db: Session) -> None:
    exists = db.query(SiteReview.id).limit(1).first()
    if exists:
        return
    now = datetime.now(tz=timezone.utc)
    for item in DEFAULT_REVIEWS:
        db.add(
            SiteReview(
                author_name=item["author_name"],
                author_role=item.get("author_role"),
                text=item["text"],
                rating=int(item["rating"]),
                source=item.get("source", "platform"),
                review_date=now,
                featured=bool(item.get("featured", False)),
                enabled=True,
                sort_order=int(item.get("sort_order", 0)),
            )
        )
    db.commit()


def list_site_reviews(
    db: Session,
    *,
    enabled_only: bool = True,
    featured_only: bool = False,
    limit: int | None = None,
) -> list[SiteReview]:
    ensure_default_site_reviews(db)
    q = db.query(SiteReview)
    if enabled_only:
        q = q.filter(SiteReview.enabled.is_(True))
    if featured_only:
        q = q.filter(SiteReview.featured.is_(True))
    q = q.order_by(SiteReview.sort_order.asc(), SiteReview.id.desc())
    if limit is not None and limit > 0:
        q = q.limit(limit)
    return q.all()


def reviews_summary(db: Session, reviews: list[SiteReview]) -> tuple[float, int]:
    if not reviews:
        return 0.0, 0
    total = len(reviews)
    avg = sum(int(r.rating or 0) for r in reviews) / total
    return round(avg, 1), total


def _user_display_name(user: User) -> str:
    parts = [user.last_name, user.first_name, user.patronymic]
    name = " ".join(p.strip() for p in parts if p and str(p).strip())
    if name:
        return name[:120]
    if user.email:
        return user.email.split("@")[0][:120]
    return "Пользователь"


def _user_author_role(user: User) -> str:
    if user.is_seller:
        return "Продавец"
    if user.is_buyer:
        return "Покупатель"
    return "Пользователь"


def create_site_review(
    db: Session,
    payload: SiteReviewCreateIn,
    *,
    user: User | None = None,
) -> SiteReview:
    text = payload.text.strip()
    if len(text) < 10:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Текст отзыва должен содержать не менее 10 символов",
        )

    now = datetime.now(tz=timezone.utc)

    if user is not None:
        author_name = _user_display_name(user)
        author_role = _user_author_role(user)
        user_id = user.id
    else:
        author_name = (payload.author_name or "").strip()
        if len(author_name) < 2:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Укажите ваше ФИО",
            )
        author_role = "Покупатель"
        user_id = None

    row = SiteReview(
        user_id=user_id,
        author_name=author_name,
        author_role=author_role,
        text=text,
        rating=int(payload.rating),
        source="platform",
        review_date=now,
        featured=False,
        enabled=True,
        sort_order=0,
    )
    db.add(row)
    db.commit()
    db.refresh(row)
    return row
