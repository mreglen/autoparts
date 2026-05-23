from __future__ import annotations

from decimal import Decimal

from sqlalchemy.orm import Session

from app.models.site_delivery_option import SiteDeliveryOption

DEFAULT_DELIVERY_OPTIONS: list[dict] = [
    {
        "region_id": 11162,
        "region_name": "Урал",
        "delivery_type": "pickup",
        "carrier": None,
        "pickup_point": "620907, Свердловская область, г. Екатеринбург, ул. Фруктовая, соор. 17",
        "min_order_amount": Decimal("0"),
        "sort_order": 10,
        "notes": "Самовывоз из магазина",
    },
    {
        "region_id": 11162,
        "region_name": "Урал",
        "delivery_type": "pvz",
        "carrier": "СДЭК",
        "pickup_point": "Пункт выдачи СДЭК в вашем городе",
        "min_order_amount": Decimal("500"),
        "sort_order": 20,
        "notes": "ПВЗ службы доставки",
    },
    {
        "region_id": 11162,
        "region_name": "Урал",
        "delivery_type": "courier",
        "carrier": "СДЭК",
        "pickup_point": None,
        "min_order_amount": Decimal("1000"),
        "sort_order": 30,
        "notes": "Курьерская доставка до двери",
    },
    {
        "region_id": 11162,
        "region_name": "Урал",
        "delivery_type": "courier",
        "carrier": "Почта России",
        "pickup_point": None,
        "min_order_amount": Decimal("500"),
        "sort_order": 40,
        "notes": "Курьерская доставка",
    },
    {
        "region_id": 11162,
        "region_name": "Урал",
        "delivery_type": "courier",
        "carrier": "Яндекс Доставка",
        "pickup_point": None,
        "min_order_amount": Decimal("1000"),
        "sort_order": 50,
        "notes": "Курьерская доставка",
    },
    {
        "region_id": 225,
        "region_name": "Россия",
        "delivery_type": "courier",
        "carrier": "Почта России",
        "pickup_point": None,
        "min_order_amount": Decimal("1000"),
        "sort_order": 60,
        "notes": "Доставка по России",
    },
]

DELIVERY_TYPE_LABELS = {
    "pickup": "Самовывоз из магазина",
    "pvz": "ПВЗ",
    "courier": "Курьер",
}

PAYMENT_METHODS = [
    "Наличными при получении",
    "Банковской картой при получении",
    "Безналичный расчёт для юридических лиц",
]

PAYMENT_NOTES = (
    "Способы оплаты зависят от выбранного способа доставки и могут быть уточнены "
    "менеджером при подтверждении заказа."
)


def ensure_default_delivery_options(db: Session) -> None:
    count = db.query(SiteDeliveryOption).count()
    if count > 0:
        return
    for row in DEFAULT_DELIVERY_OPTIONS:
        db.add(SiteDeliveryOption(**row, enabled=True))
    db.commit()


def list_delivery_options(db: Session, *, enabled_only: bool = False) -> list[SiteDeliveryOption]:
    ensure_default_delivery_options(db)
    query = db.query(SiteDeliveryOption).order_by(
        SiteDeliveryOption.sort_order.asc(),
        SiteDeliveryOption.id.asc(),
    )
    if enabled_only:
        query = query.filter(SiteDeliveryOption.enabled.is_(True))
    return query.all()


def enabled_region_ids(db: Session) -> list[int]:
    rows = list_delivery_options(db, enabled_only=True)
    region_ids = sorted({int(row.region_id) for row in rows})
    return region_ids or [225]


def region_ids_csv_from_delivery(db: Session) -> str:
    return ",".join(str(rid) for rid in enabled_region_ids(db))
