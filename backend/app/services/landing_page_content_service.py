from __future__ import annotations

import html
import json
import re
from dataclasses import dataclass
from typing import Any

from app.schemas.seo_landing_page import SeoLandingResolveOut
from app.services.new_parts_seo_card_service import build_new_part_card_path
from app.utils.product_display_name import format_product_display_title
from app.utils.product_urls import build_product_page_url

DEFAULT_SITE_ORIGIN = "https://svoygarage.ru"
POPULAR_QUERIES_LIMIT = 12


@dataclass(frozen=True)
class FaqItem:
    question: str
    answer: str


@dataclass(frozen=True)
class PopularQueryLink:
    label: str
    path: str


@dataclass(frozen=True)
class LandingContentOut:
    about_html: str
    order_delivery_html: str
    faq_items: tuple[FaqItem, ...]
    popular_queries: tuple[PopularQueryLink, ...]
    faq_json_ld: str = ""

    def to_dict(self) -> dict[str, Any]:
        return {
            "about_html": self.about_html,
            "order_delivery_html": self.order_delivery_html,
            "faq_items": [{"question": item.question, "answer": item.answer} for item in self.faq_items],
            "popular_queries": [{"label": link.label, "path": link.path} for link in self.popular_queries],
            "faq_json_ld": self.faq_json_ld,
        }


def _strip_html(value: str | None) -> str:
    text = re.sub(r"<[^>]+>", " ", str(value or ""))
    return re.sub(r"\s+", " ", text).strip()


def _word_count(*parts: str) -> int:
    total = 0
    for part in parts:
        total += len(_strip_html(part).split())
    return total


def _escape_html(text: str) -> str:
    return html.escape(text, quote=False)


def _paragraph(text: str) -> str:
    return f"<p>{_escape_html(text)}</p>"


def _article_samples(top_items: list[Any], *, is_new: bool, limit: int = 6) -> str:
    labels: list[str] = []
    for item in top_items[:limit]:
        brand = getattr(item, "brand", None) or ""
        article = getattr(item, "article", None) or ""
        name = getattr(item, "name", None) or ""
        if brand and article:
            labels.append(f"{brand} {article}")
        elif article:
            labels.append(str(article))
        elif name:
            labels.append(str(name)[:60])
    if not labels:
        return ""
    joined = ", ".join(labels[:limit])
    kind_label = "новые позиции" if is_new else "объявления"
    return f"Среди популярных {kind_label} в каталоге: {joined}."


def _build_popular_queries(
    top_items: list[Any],
    *,
    is_new: bool,
    site_origin: str = DEFAULT_SITE_ORIGIN,
) -> tuple[PopularQueryLink, ...]:
    links: list[PopularQueryLink] = []
    seen: set[str] = set()
    for item in top_items:
        brand = (getattr(item, "brand", None) or "").strip()
        article = (getattr(item, "article", None) or "").strip()
        name = (getattr(item, "name", None) or "").strip()
        if is_new:
            card_id = getattr(item, "id", None)
            if not card_id:
                continue
            path = build_new_part_card_path(card_id, brand, article)
            label = article or name or f"#{card_id}"
        else:
            product_id = getattr(item, "id", None)
            if not product_id:
                continue
            path = build_product_page_url(item, site_origin)
            if path.startswith("http"):
                path = path.replace(site_origin.rstrip("/"), "", 1) or path
            label = f"{brand} {article}".strip() if brand and article else (article or name or f"#{product_id}")
        key = path.lower()
        if key in seen:
            continue
        seen.add(key)
        links.append(PopularQueryLink(label=label, path=path))
        if len(links) >= POPULAR_QUERIES_LIMIT:
            break
    return tuple(links)


def _build_about_html_auto(
    landing: SeoLandingResolveOut,
    *,
    kind: str,
    total_count: int,
    top_items: list[Any],
    is_new: bool,
) -> str:
    parts: list[str] = []
    brand = (landing.brand_name or landing.title_ru or "").strip()
    title = (landing.title_ru or "").strip()
    city = (landing.city or landing.title_ru or "").strip()

    if kind == "brand_new":
        parts.append(
            f"На «Свой Гараж» собран каталог новых автозапчастей {brand} с актуальными артикулами, "
            f"ценами поставщиков и информацией о наличии на складах. "
            f"Раздел помогает быстро найти оригинальные детали и проверенные аналоги по номеру производителя."
        )
        if total_count > 0:
            parts.append(
                f"Сейчас в каталоге {total_count} позиций {brand}: фильтры, тормозная система, "
                f"электрика, расходники и другие группы запчастей для иномарок и отечественных авто."
            )
    elif kind == "brand_used":
        parts.append(
            f"Каталог б/у автозапчастей {brand} на маркетплейсе «Свой Гараж» — объявления проверенных "
            f"продавцов с фото, ценами и возможностью уточнить детали в чате. "
            f"Покупка б/у деталей позволяет сэкономить на ремонте без потери совместимости по артикулу."
        )
        if total_count > 0:
            parts.append(
                f"В разделе {total_count} объявлений {brand}: агрегаты, кузовные элементы, "
                f"ходовая часть и расходные материалы с доставкой по Екатеринбургу и России."
            )
    elif kind == "category_new":
        parts.append(
            f"Раздел «Новые {title.lower()}» — это подборка актуальных артикулов от поставщиков "
            f"с ценами, сроками поставки и доставкой по России. "
            f"Каталог удобен, если вы уже знаете нужную деталь или подбираете запчасть по названию категории."
        )
        if total_count > 0:
            parts.append(
                f"В категории {total_count} позиций: можно сравнить бренды, посмотреть аналоги "
                f"и оформить заказ онлайн без звонков."
            )
    elif kind == "category_used":
        parts.append(
            f"Каталог б/у {title.lower()} на «Свой Гараж» объединяет предложения частных продавцов "
            f"и магазинов. Каждое объявление содержит фото, цену и контакт через чат платформы."
        )
        if total_count > 0:
            parts.append(
                f"Сейчас доступно {total_count} объявлений в категории «{title}»: "
                f"выбирайте по состоянию, цене и городу продавца."
            )
    elif kind == "geo":
        parts.append(
            f"Б/у автозапчасти в {city} — локальный каталог объявлений продавцов на «Свой Гараж». "
            f"Можно найти детали для ремонта рядом с домом или заказать доставку по Свердловской области и России."
        )
        if total_count > 0:
            parts.append(
                f"В городе {total_count} активных объявлений: двигатель, подвеска, кузов, "
                f"оптика и другие категории от разных продавцов."
            )
    else:
        parts.append(
            f"Каталог «{title}» на маркетплейсе «Свой Гараж» — новые и б/у автозапчасти с доставкой."
        )

    samples = _article_samples(top_items, is_new=is_new)
    if samples:
        parts.append(samples)

    parts.append(
        "Платформа объединяет каталог, корзину для новых запчастей, чат с продавцом для б/у "
        "и прозрачные условия оплаты — всё на одном сайте."
    )

    return "".join(_paragraph(p) for p in parts)


def _build_order_delivery_html(*, is_new: bool) -> str:
    parts: list[str] = []
    if is_new:
        parts.append(
            "Как оформить заказ новых запчастей: добавьте позицию в корзину, выберите способ доставки "
            "и оплатите заказ онлайн. Срок поставки зависит от склада поставщика — актуальные сроки "
            "указаны на карточке товара."
        )
    else:
        parts.append(
            "Как купить б/у запчасть: откройте карточку объявления, уточните детали в чате с продавцом "
            "и договоритесь о передаче или доставке. Оплата и передача согласуются с продавцом напрямую через платформу."
        )
    parts.append(
        "Доставка по Екатеринбургу доступна у большинства продавцов и поставщиков. "
        "Отправка в другие города России — через транспортные компании и курьерские службы; "
        "точные условия смотрите на странице «Доставка»."
    )
    parts.append(
        "Если нужна консультация по подбору, используйте поиск по артикулу или бренду — "
        "система покажет совместимые позиции и аналоги."
    )
    return "".join(_paragraph(p) for p in parts)


def _build_faq_items(kind: str, landing: SeoLandingResolveOut, *, is_new: bool) -> tuple[FaqItem, ...]:
    brand = (landing.brand_name or landing.title_ru or "").strip()
    title = (landing.title_ru or "").strip()
    city = (landing.city or landing.title_ru or "").strip()

    items: list[FaqItem] = [
        FaqItem(
            question="Оригинал или аналог — что выбрать?",
            answer=(
                "Оригинал (OE) выпускается брендом автопроизводителя или по его лицензии; "
                "аналог (aftermarket) — от независимых производителей с тем же назначением. "
                "На «Свой Гараж» указаны бренд и артикул — сравните цену, срок поставки и отзывы. "
                "Для критичных узлов (тормоза, подвеска) часто выбирают оригинал или премиальные аналоги."
            ),
        ),
        FaqItem(
            question="Как проверить совместимость запчасти?",
            answer=(
                "Сверьте артикул производителя с каталогом по VIN или модели авто. "
                "На карточке указаны бренд, артикул и название — сравните с вашей старой деталью. "
                "Для б/у запчастей уточните в чате год выпуска, модификацию и фото бирки."
            ),
        ),
    ]

    if kind in ("brand_new", "brand_used"):
        section = "новых" if is_new else "б/у"
        items.append(
            FaqItem(
                question=f"Все ли запчасти {brand} в каталоге оригинальные?",
                answer=(
                    f"В разделе {section} запчастей {brand} представлены позиции разных линейок: "
                    f"оригинальные номера и качественные аналоги. Бренд и артикул указаны на каждой карточке — "
                    f"выбирайте по задаче и бюджету."
                ),
            )
        )
    elif kind in ("category_new", "category_used"):
        items.append(
            FaqItem(
                question=f"Какие бренды {title.lower()} есть в каталоге?",
                answer=(
                    f"В категории «{title}» представлены популярные производители — "
                    f"используйте фильтры и блок «Популярные запросы» для быстрого перехода к нужному артикулу."
                ),
            )
        )
    elif kind == "geo":
        items.append(
            FaqItem(
                question=f"Можно ли забрать запчасть в {city} лично?",
                answer=(
                    f"Многие продавцы в {city} предлагают самовывоз — уточните адрес и время в чате на карточке объявления. "
                    f"Доставка по городу и области также доступна у части продавцов."
                ),
            )
        )

    items.append(
        FaqItem(
            question="Как связаться с продавцом?",
            answer=(
                "На карточке б/у запчасти нажмите «Написать продавцу» — откроется чат на платформе. "
                "Для новых запчастей оформление идёт через корзину; при вопросах по наличию используйте контакты на сайте."
            ),
        )
    )

    return tuple(items)


def build_faq_json_ld(faq_items: tuple[FaqItem, ...] | list[FaqItem]) -> str:
    if not faq_items:
        return ""
    entities = [
        {
            "@type": "Question",
            "name": item.question,
            "acceptedAnswer": {"@type": "Answer", "text": item.answer},
        }
        for item in faq_items
    ]
    payload = {"@context": "https://schema.org", "@type": "FAQPage", "mainEntity": entities}
    return json.dumps(payload, ensure_ascii=False)


def build_landing_content(
    landing: SeoLandingResolveOut,
    *,
    kind: str,
    total_count: int = 0,
    top_items: list[Any] | None = None,
    is_new: bool = False,
    site_origin: str = DEFAULT_SITE_ORIGIN,
) -> LandingContentOut:
    items = top_items or []
    intro_override = (landing.intro_html or "").strip()

    if intro_override:
        about_html = intro_override
    else:
        about_html = _build_about_html_auto(
            landing,
            kind=kind,
            total_count=total_count,
            top_items=items,
            is_new=is_new,
        )

    order_delivery_html = _build_order_delivery_html(is_new=is_new)
    faq_items = _build_faq_items(kind, landing, is_new=is_new)
    popular_queries = _build_popular_queries(items, is_new=is_new, site_origin=site_origin)
    faq_json_ld = build_faq_json_ld(faq_items)

    return LandingContentOut(
        about_html=about_html,
        order_delivery_html=order_delivery_html,
        faq_items=faq_items,
        popular_queries=popular_queries,
        faq_json_ld=faq_json_ld,
    )


def landing_content_word_count(content: LandingContentOut) -> int:
    faq_text = " ".join(f"{item.question} {item.answer}" for item in content.faq_items)
    return _word_count(content.about_html, content.order_delivery_html, faq_text)


def render_faq_html(faq_items: tuple[FaqItem, ...] | list[FaqItem]) -> str:
    if not faq_items:
        return ""
    blocks: list[str] = ['<section class="faq">', "<h2>Частые вопросы</h2>"]
    for item in faq_items:
        blocks.append("<details>")
        blocks.append(f"<summary>{_escape_html(item.question)}</summary>")
        blocks.append(_paragraph(item.answer))
        blocks.append("</details>")
    blocks.append("</section>")
    return "\n".join(blocks)


def render_popular_queries_html(
    popular_queries: tuple[PopularQueryLink, ...] | list[PopularQueryLink],
) -> str:
    if not popular_queries:
        return ""
    items = "".join(
        f'<li><a href="{_escape_html(link.path)}">{_escape_html(link.label)}</a></li>'
        for link in popular_queries
    )
    return f'<section><h2>Популярные запросы</h2><ul>{items}</ul></section>'
