from __future__ import annotations

from app.utils.organization_city import DEFAULT_CITY, format_city_in_prepositional


def _format_price_phrase(price: float | int | str | None) -> str:
    if price is None:
        return ""
    try:
        amount = float(price)
    except (TypeError, ValueError):
        return ""
    if amount <= 0:
        return ""
    if amount.is_integer():
        return f"{int(amount)} ₽"
    return f"{amount:.2f} ₽"


def build_product_faq_items(
    *,
    brand: str | None = None,
    article: str | None = None,
    part_type_name: str | None = None,
    is_new: bool = False,
    city: str | None = None,
    fitment_text: str | None = None,
    in_stock: bool = True,
    quantity: int | None = None,
    price: float | int | str | None = None,
    stock_summary: str | None = None,
) -> list[dict[str, str]]:
    brand_text = (brand or "").strip()
    article_text = (article or "").strip()
    label = f"{brand_text} {article_text}".strip() or "эта запчасть"
    part_type = (part_type_name or "").strip() or "автозапчасть"
    city_prep = format_city_in_prepositional(city or DEFAULT_CITY)
    condition = "новая" if is_new else "б/у"
    fitment = (fitment_text or "").strip().rstrip(".")
    price_phrase = _format_price_phrase(price)
    stock_text = (stock_summary or "").strip().rstrip(".")
    qty: int | None = None
    if quantity is not None:
        try:
            qty = max(0, int(quantity))
        except (TypeError, ValueError):
            qty = None

    items: list[dict[str, str]] = []

    if fitment:
        items.append(
            {
                "question": f"На какие автомобили подходит {label}?",
                "answer": (
                    f"По справочным данным {label} ({part_type.lower()}) может подойти для: "
                    f"{fitment}. Перед покупкой сверьте артикул {article_text or label} "
                    f"и уточните совместимость у продавца."
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

    if in_stock:
        qty_part = f" ({qty} шт.)" if qty and qty > 1 else ""
        price_part = f" Актуальная цена на карточке — {price_phrase}." if price_phrase else ""
        stock_part = f" {stock_text}." if stock_text else ""
        stock_answer = (
            f"Да, {label} сейчас в наличии{qty_part} в {city_prep}.{price_part}{stock_part} "
            "Количество и сроки доставки уточняйте на карточке перед заказом."
        )
    elif is_new:
        stock_answer = (
            f"Сейчас новых предложений {label} на складах нет. Посмотрите б/у варианты "
            f"{label} в каталоге «Свой Гараж» или аналоги на этой странице."
        )
    else:
        stock_answer = (
            f"Это предложение сейчас недоступно. Посмотрите другие варианты "
            f"{label} в каталоге б/у запчастей «Свой Гараж»."
        )
    items.append(
        {
            "question": f"Есть ли {label} в наличии?",
            "answer": stock_answer,
        }
    )

    items.append(
        {
            "question": f"Как оформить доставку и оплату для {label}?",
            "answer": (
                f"Добавьте {label} в корзину на svoygarage.ru или свяжитесь с продавцом. "
                f"Доставка по России, самовывоз в {city_prep} — условия согласуются при заказе. "
                "Подробнее — на странице «Доставка»."
            ),
        }
    )

    if is_new:
        items.append(
            {
                "question": f"Какое состояние у новой запчасти {label}?",
                "answer": (
                    f"Это новая {part_type.lower()} {label} со склада поставщика. "
                    "Состояние упаковки и комплектацию уточняйте у продавца перед покупкой."
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

    price_hint = f" по цене {price_phrase}" if price_phrase and in_stock else ""
    items.append(
        {
            "question": f"Как купить {label} на «Свой Гараж»?",
            "answer": (
                f"Откройте карточку {label}{price_hint}, добавьте товар в корзину или нажмите "
                "«Написать» / «Позвонить» продавцу. Оформление заказа и оплата проходят через "
                "маркетплейс или напрямую с продавцом — как указано на карточке."
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
    quantity: int | None = None,
    price: float | int | str | None = None,
    stock_summary: str | None = None,
) -> dict:
    items = build_product_faq_items(
        brand=brand,
        article=article,
        part_type_name=part_type_name,
        is_new=is_new,
        city=city,
        fitment_text=fitment_text,
        in_stock=in_stock,
        quantity=quantity,
        price=price,
        stock_summary=stock_summary,
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
