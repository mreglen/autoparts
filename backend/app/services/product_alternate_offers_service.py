from __future__ import annotations

from dataclasses import dataclass

from sqlalchemy import func
from sqlalchemy.orm import Session, selectinload

from app.models.product import Product as ProductModel
from app.utils.organization_city import extract_city_from_address
from app.utils.partnumber import normalize_partnumber
from app.utils.product_display_name import format_product_display_title
from app.utils.product_urls import build_product_page_url


def _sql_normalize_article(column):
    expr = func.upper(column)
    for ch in ("-", " ", ".", "/", "(", ")", "_", "\\"):
        expr = func.replace(expr, ch, "")
    return expr


@dataclass(frozen=True)
class AlternateProductOffer:
    label: str
    url: str
    price: str | None = None


def _photo_url(product: ProductModel) -> str | None:
    for photo in product.photos or []:
        url = str(getattr(photo, "photo_url", "") or "").strip()
        if url:
            return url
    return None


def find_alternate_used_product_offers(
    db: Session,
    *,
    brand: str,
    article: str,
    exclude_product_id: int | None = None,
    limit: int = 5,
    site_origin: str | None = None,
) -> list[AlternateProductOffer]:
    brand_text = str(brand or "").strip()
    article_text = str(article or "").strip()
    if not brand_text or not article_text:
        return []

    load_options = (
        selectinload(ProductModel.photos),
        selectinload(ProductModel.organization),
    )
    query = (
        db.query(ProductModel)
        .options(*load_options)
        .filter(
            ProductModel.quantity > 0,
            ProductModel.is_new.is_(False),
            ProductModel.brand.ilike(brand_text),
            ProductModel.article.ilike(article_text),
        )
        .order_by(ProductModel.id.desc())
    )
    if exclude_product_id is not None:
        query = query.filter(ProductModel.id != int(exclude_product_id))
    products = query.limit(max(1, min(limit, 20))).all()

    if not products:
        normalized_article = normalize_partnumber(article_text)
        if normalized_article:
            fallback_query = (
                db.query(ProductModel)
                .options(*load_options)
                .filter(
                    ProductModel.quantity > 0,
                    ProductModel.is_new.is_(False),
                    ProductModel.brand.ilike(brand_text),
                    _sql_normalize_article(ProductModel.article) == normalized_article,
                )
                .order_by(ProductModel.id.desc())
            )
            if exclude_product_id is not None:
                fallback_query = fallback_query.filter(ProductModel.id != int(exclude_product_id))
            products = fallback_query.limit(max(1, min(limit, 20))).all()

    offers: list[AlternateProductOffer] = []
    for product in products:
        if exclude_product_id is not None and int(product.id) == int(exclude_product_id):
            continue
        label = format_product_display_title(product.brand, product.article, product.name)
        url = build_product_page_url(product, site_origin)
        price = None
        if product.price is not None:
            try:
                price = f"{float(product.price):.2f}"
            except (TypeError, ValueError):
                price = str(product.price)
        offers.append(AlternateProductOffer(label=label or f"Товар #{product.id}", url=url, price=price))
        if len(offers) >= limit:
            break
    return offers


def serialize_public_used_product_matches(
    products: list[ProductModel],
    *,
    exclude_product_id: int | None = None,
) -> list[dict]:
    results: list[dict] = []
    for product in products:
        if exclude_product_id is not None and int(product.id) == int(exclude_product_id):
            continue
        org = getattr(product, "organization", None)
        org_address = getattr(org, "address", None) if org else None
        org_name = getattr(org, "name", None) if org else None
        city = extract_city_from_address(str(org_address) if org_address else None)
        results.append(
            {
                "id": product.id,
                "brand": product.brand,
                "article": product.article,
                "name": product.name,
                "price": float(product.price) if product.price is not None else None,
                "quantity": int(product.quantity or 0),
                "photo_url": _photo_url(product),
                "organization_name": str(org_name).strip() if org_name else None,
                "organization_address": str(org_address).strip() if org_address else None,
                "city": city,
                "compatible_vehicles": list(product.compatible_vehicles or []),
            }
        )
    return results
