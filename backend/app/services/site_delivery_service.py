from __future__ import annotations

import logging
from decimal import Decimal

from sqlalchemy.orm import Session

from app.models.site_delivery_option import SiteDeliveryOption

logger = logging.getLogger(__name__)

# Федеральные округа (как на чекауте и в Яндекс Товарах).
CHECKOUT_DELIVERY_REGIONS: list[str] = [
    "Центр",
    "Северо-Запад",
    "Юг",
    "Поволжье",
    "Урал",
    "Сибирь",
    "Дальний Восток",
    "Северный Кавказ",
]

CHECKOUT_REGION_IDS: dict[str, int] = {
    "Центр": 101,
    "Северо-Запад": 102,
    "Юг": 103,
    "Поволжье": 104,
    "Урал": 11162,
    "Сибирь": 106,
    "Дальний Восток": 107,
    "Северный Кавказ": 108,
}

# Точные названия служб для Яндекс Товаров (ПВЗ служб доставки).
CHECKOUT_PVZ_CARRIERS: list[tuple[str, str]] = [
    ("СДЭК", "cdek"),
    ("Почта России", "pochta"),
    ("Яндекс Доставка", "yandex"),
]

YANDEX_PVZ_DELIVERY_TYPE = "pvz"
YANDEX_PVZ_NOTES = "ПВЗ службы доставки"

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
        "notes": YANDEX_PVZ_NOTES,
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
        "delivery_type": "pvz",
        "carrier": "Яндекс Доставка",
        "pickup_point": "Пункт выдачи Яндекс Доставка в вашем городе",
        "min_order_amount": Decimal("1000"),
        "sort_order": 50,
        "notes": YANDEX_PVZ_NOTES,
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
    "Банковский перевод",
    "Наличные при получении",
    "Онлайн-оплата",
]

PAYMENT_NOTES = (
    "Оплата: перевод, наличные при получении или онлайн. "
    "Конкретный способ согласовывается при подтверждении заказа."
)


def _norm_carrier(value: str | None) -> str:
    return (value or "").strip().casefold()


def _carrier_aliases() -> dict[str, str]:
    return {
        "сдэк": "СДЭК",
        "cdek": "СДЭК",
        "почта россии": "Почта России",
        "почта": "Почта России",
        "яндекс доставка": "Яндекс Доставка",
        "яндекс": "Яндекс Доставка",
        "yandex": "Яндекс Доставка",
    }


def normalize_carrier_name(carrier: str | None) -> str | None:
    if not carrier or not str(carrier).strip():
        return None
    key = _norm_carrier(carrier)
    return _carrier_aliases().get(key, carrier.strip())


def ensure_default_delivery_options(db: Session) -> None:
    count = db.query(SiteDeliveryOption).count()
    if count > 0:
        return
    for row in DEFAULT_DELIVERY_OPTIONS:
        db.add(SiteDeliveryOption(**row, enabled=True))
    db.commit()


def carrier_to_key(carrier: str | None) -> str | None:
    canonical = normalize_carrier_name(carrier)
    for name, key in CHECKOUT_PVZ_CARRIERS:
        if canonical == name:
            return key
    return None


def ensure_checkout_delivery_matrix(db: Session) -> dict[str, int]:
    """
    Матрица: 8 федеральных округов × 3 ПВЗ (СДЭК, Почта России, Яндекс Доставка).
    Нужна для совпадения с Яндекс Товарами и страницей /delivery.
    """
    ensure_default_delivery_options(db)
    stats = {"created": 0, "updated": 0}

    for region_name in CHECKOUT_DELIVERY_REGIONS:
        region_id = CHECKOUT_REGION_IDS[region_name]
        region_rows = (
            db.query(SiteDeliveryOption)
            .filter(SiteDeliveryOption.region_name == region_name)
            .all()
        )
        by_key: dict[str, SiteDeliveryOption] = {}
        for row in region_rows:
            key = carrier_to_key(row.carrier)
            if key and key not in by_key:
                by_key[key] = row

        for sort_offset, (canonical, key) in enumerate(CHECKOUT_PVZ_CARRIERS):
            sort_order = 100 + region_id * 10 + sort_offset
            match = by_key.get(key)
            if match is None:
                db.add(
                    SiteDeliveryOption(
                        region_id=region_id,
                        region_name=region_name,
                        delivery_type=YANDEX_PVZ_DELIVERY_TYPE,
                        carrier=canonical,
                        pickup_point=f"Пункт выдачи {canonical} в вашем городе",
                        min_order_amount=Decimal("500"),
                        enabled=True,
                        sort_order=sort_order,
                        notes=YANDEX_PVZ_NOTES,
                    )
                )
                stats["created"] += 1
                continue

            changed = False
            if match.region_id != region_id:
                match.region_id = region_id
                changed = True
            if match.delivery_type != YANDEX_PVZ_DELIVERY_TYPE:
                match.delivery_type = YANDEX_PVZ_DELIVERY_TYPE
                changed = True
            if match.carrier != canonical:
                match.carrier = canonical
                changed = True
            if (match.notes or "") != YANDEX_PVZ_NOTES:
                match.notes = YANDEX_PVZ_NOTES
                changed = True
            if not match.enabled:
                match.enabled = True
                changed = True
            if changed:
                stats["updated"] += 1

    if stats["created"] or stats["updated"]:
        db.commit()
        logger.info("Checkout delivery matrix synced: %s", stats)
    return stats


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
