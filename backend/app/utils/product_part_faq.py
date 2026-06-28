from __future__ import annotations

from app.utils.organization_city import DEFAULT_CITY, format_city_in_prepositional


def build_product_faq_items(
    *,
    brand: str | None = None,
    article: str | None = None,
    part_type_name: str | None = None,
    is_new: bool = False,
    city: str | None = None,
    fitment_text: str | None = None,
    in_stock: bool = True,
) -> list[dict[str, str]]:
    brand_text = (brand or "").strip()
    article_text = (article or "").strip()
    label = f"{brand_text} {article_text}".strip() or "эта запчасть"
    part_type = (part_type_name or "").strip() or "автозапчасть"
    city_prep = format_city_in_prepositional(city or DEFAULT_CITY)
    condition = "новая" if is_new else "б/у"
    fitment = (fitment_text or "").strip().rstrip(".")

    items: list[dict[str, str]] = []

    if fitment:
        items.append(
            {
                "question": f"На какие автомобили подходит {label}?",
                "answer": (
                    f"По справочным данным {label} ({part_type.lower()}) может подойти для: "
                    f"{fitment}. Перед покупкой уточните совместимость у продавца — "
                    f"это {condition} деталь, осмотр рекомендуется."
                ),
            }
        )
    else:
        items.append(
            {
                "question": f"Как проверить, подойдёт ли {label} на мой автомобиль?",
                "answer": (
                    f"Сверьте артикул {article_text or label} с каталогом производителя или VIN. "
                    f"На «Свой Гараж» можно написать продавцу в чат и уточнить совместимость "
                    f"перед заказом {condition} {part_type.lower()}."
                ),
            }
        )

    stock_answer = (
        f"Да, {label} сейчас в наличии в {city_prep}. Количество и актуальность уточняйте "
        "на карточке или у продавца."
        if in_stock
        else (
            f"Это предложение может быть недоступно. Посмотрите другие варианты "
            f"{label} в каталоге б/у запчастей «Свой Гараж»."
        )
    )
    items.append(
        {
            "question": f"Есть ли {label} в наличии?",
            "answer": stock_answer,
        }
    )

    items.append(
        {
            "question": "Как оформить доставку и оплату?",
            "answer": (
                f"Добавьте товар в корзину на svoygarage.ru или свяжитесь с продавцом. "
                f"Доставка по России, самовывоз в {city_prep} — условия согласуются с продавцом. "
                "Подробнее — на странице «Доставка»."
            ),
        }
    )

    if is_new:
        items.append(
            {
                "question": f"Какое состояние у новой запчасти {label}?",
                "answer": (
                    f"Это новая {part_type.lower()} {label}. Состояние упаковки и комплектацию "
                    "уточняйте у продавца перед покупкой."
                ),
            }
        )
    else:
        items.append(
            {
                "question": f"Какое состояние у б/у запчасти {label}?",
                "answer": (
                    f"Это {condition} {part_type.lower()} {label}. Рекомендуем осмотреть деталь "
                    "лично или запросить дополнительные фото и видео у продавца перед оплатой."
                ),
            }
        )

    items.append(
        {
            "question": "Как купить запчасть на «Свой Гараж»?",
            "answer": (
                f"Откройте карточку {label}, добавьте товар в корзину или нажмите «Написать» / "
                "«Позвонить» продавцу. Оформление заказа и оплата проходят через маркетплейс "
                "или напрямую с продавцом — как указано на карточке."
            ),
        }
    )

    return items


def build_product_faq_json_ld(
    *,
    canonical_url: str,
    brand: str | None = None,
    article: str | None = None,
    part_type_name: str | None = None,
    is_new: bool = False,
    city: str | None = None,
    fitment_text: str | None = None,
    in_stock: bool = True,
) -> dict:
    items = build_product_faq_items(
        brand=brand,
        article=article,
        part_type_name=part_type_name,
        is_new=is_new,
        city=city,
        fitment_text=fitment_text,
        in_stock=in_stock,
    )
    return {
        "@type": "FAQPage",
        "@id": f"{canonical_url}#faq",
        "mainEntity": [
            {
                "@type": "Question",
                "name": item["question"],
                "acceptedAnswer": {
                    "@type": "Answer",
                    "text": item["answer"],
                },
            }
            for item in items
        ],
    }
