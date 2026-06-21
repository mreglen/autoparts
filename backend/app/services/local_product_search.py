"""Локальный поиск товаров: быстрые точные совпадения + fallback по токенам."""
from __future__ import annotations

from sqlalchemy import and_, case, func, or_
from sqlalchemy.orm import Query, Session, selectinload

from app.models.product import Product as ProductModel
from app.utils.partnumber import normalize_partnumber
from app.utils.search_query import ParsedSearchQuery, parse_search_query
from app.utils.search_sql import get_sql_normalize, get_sql_normalize_brand

_DEFAULT_LIMIT = 200
_MIN_TOKEN_LEN = 2

_PRODUCT_LOAD_OPTIONS = (
    selectinload(ProductModel.photos),
    selectinload(ProductModel.storage_location),
    selectinload(ProductModel.organization),
)


def _in_stock_filter():
    return func.coalesce(ProductModel.quantity, 0) > 0


def _brand_match_conditions(brand_text: str):
    brand_trim = brand_text.strip()
    conditions = [
        ProductModel.brand.ilike(brand_trim),
        func.lower(func.trim(ProductModel.brand)) == brand_trim.casefold(),
    ]
    brand_norm = normalize_partnumber(brand_trim)
    if brand_norm:
        conditions.append(get_sql_normalize_brand(ProductModel.brand) == brand_norm)
    return or_(*conditions)


def _article_match_conditions(article_text: str):
    article_trim = article_text.strip()
    conditions = [
        ProductModel.article.ilike(article_trim),
    ]
    article_norm = normalize_partnumber(article_trim)
    if article_norm:
        conditions.extend(
            [
                get_sql_normalize(ProductModel.article) == article_norm,
                get_sql_normalize(ProductModel.article).ilike(f"{article_norm}%"),
            ]
        )
    if len(article_trim) >= _MIN_TOKEN_LEN:
        conditions.append(ProductModel.article.ilike(f"%{article_trim}%"))
    return or_(*conditions)


def _brand_article_pair_condition(brand_text: str, article_text: str):
    return and_(
        _brand_match_conditions(brand_text),
        _article_match_conditions(article_text),
    )


def _canonical_brand_article_condition(brand_text: str, article_text: str):
    canonical = f"{brand_text.strip()} {article_text.strip()}".casefold()
    return (
        func.lower(
            func.trim(
                func.concat(
                    func.trim(ProductModel.brand),
                    " ",
                    func.trim(ProductModel.article),
                )
            )
        )
        == canonical
    )


def _name_match_condition(name_text: str):
    name_trim = name_text.strip()
    if len(name_trim) < _MIN_TOKEN_LEN:
        return None
    conditions = [ProductModel.name.ilike(f"%{name_trim}%")]
    name_norm = normalize_partnumber(name_trim)
    if name_norm and len(name_norm) >= _MIN_TOKEN_LEN:
        conditions.append(
            func.replace(func.lower(ProductModel.name), " ", "").ilike(f"%{name_norm.lower()}%")
        )
    return or_(*conditions)


def _token_match_condition(token: str):
    token_trim = token.strip()
    if len(token_trim) < _MIN_TOKEN_LEN:
        return None
    conditions = [
        ProductModel.name.ilike(f"%{token_trim}%"),
        ProductModel.brand.ilike(f"%{token_trim}%"),
        ProductModel.article.ilike(f"%{token_trim}%"),
    ]
    token_norm = normalize_partnumber(token_trim)
    if token_norm and len(token_norm) >= _MIN_TOKEN_LEN:
        conditions.extend(
            [
                get_sql_normalize(ProductModel.article).ilike(f"%{token_norm}%"),
                get_sql_normalize_brand(ProductModel.brand).ilike(f"%{token_norm}%"),
            ]
        )
    return or_(*conditions)


def _build_match_conditions(parsed: ParsedSearchQuery) -> list:
    conditions: list = []
    seen_pair_keys: set[tuple[str, str]] = set()

    for brand_text, article_text in parsed.brand_article_pairs:
        key = (brand_text.strip().casefold(), article_text.strip().casefold())
        if key in seen_pair_keys:
            continue
        seen_pair_keys.add(key)
        conditions.append(_brand_article_pair_condition(brand_text, article_text))
        conditions.append(_canonical_brand_article_condition(brand_text, article_text))

    if parsed.normalized_full and len(parsed.normalized_full) >= _MIN_TOKEN_LEN:
        conditions.append(get_sql_normalize(ProductModel.article) == parsed.normalized_full)

    for article in parsed.article_tokens:
        article_norm = normalize_partnumber(article)
        if article_norm:
            conditions.append(get_sql_normalize(ProductModel.article) == article_norm)
            conditions.append(get_sql_normalize(ProductModel.article).ilike(f"{article_norm}%"))

    for brand in parsed.brand_tokens:
        brand_norm = normalize_partnumber(brand)
        if brand_norm:
            conditions.append(get_sql_normalize_brand(ProductModel.brand) == brand_norm)
        conditions.append(func.lower(func.trim(ProductModel.brand)) == brand.strip().casefold())

    if parsed.name_tokens and (parsed.brand_tokens or parsed.article_tokens):
        name_text = " ".join(parsed.name_tokens)
        name_cond = _name_match_condition(name_text)
        if name_cond is not None:
            for brand in parsed.brand_tokens:
                conditions.append(and_(name_cond, _brand_match_conditions(brand)))
            for article in parsed.article_tokens:
                conditions.append(and_(name_cond, _article_match_conditions(article)))

    if parsed.tokens and len(parsed.tokens) >= 2:
        token_conds = [_token_match_condition(t) for t in parsed.tokens]
        token_conds = [c for c in token_conds if c is not None]
        if token_conds:
            conditions.append(and_(*token_conds))

    if len(parsed.tokens) == 1:
        single = _token_match_condition(parsed.tokens[0])
        if single is not None:
            conditions.append(single)

    if parsed.raw and len(parsed.raw) >= _MIN_TOKEN_LEN:
        conditions.append(ProductModel.name.ilike(f"%{parsed.raw}%"))
        if parsed.normalized_full:
            conditions.append(get_sql_normalize(ProductModel.article).ilike(f"%{parsed.normalized_full}%"))
            conditions.append(get_sql_normalize_brand(ProductModel.brand).ilike(f"%{parsed.normalized_full}%"))

    return conditions


def _build_relevance_score(parsed: ParsedSearchQuery):
    whens: list[tuple] = []

    for brand_text, article_text in parsed.brand_article_pairs[:6]:
        whens.append((_brand_article_pair_condition(brand_text, article_text), 100))
        whens.append((_canonical_brand_article_condition(brand_text, article_text), 98))

    if parsed.normalized_full:
        whens.append((get_sql_normalize(ProductModel.article) == parsed.normalized_full, 95))

    for article in parsed.article_tokens[:3]:
        article_norm = normalize_partnumber(article)
        if article_norm:
            whens.append((get_sql_normalize(ProductModel.article) == article_norm, 90))

    for brand in parsed.brand_tokens[:3]:
        brand_norm = normalize_partnumber(brand)
        if brand_norm:
            whens.append((get_sql_normalize_brand(ProductModel.brand) == brand_norm, 85))

    if not whens:
        return None

    return case(*whens, else_=10)


def search_local_products_query(
    db: Session,
    q: str,
    is_new: bool | None = None,
    *,
    limit: int | None = _DEFAULT_LIMIT,
    apply_order: bool = True,
) -> Query:
    """
    Поиск в локальной БД с поддержкой комбинаций бренд/артикул/название.
    apply_order=False — для каталога (сортировку и count делает вызывающий код).
    """
    parsed = parse_search_query(q)
    if not parsed.has_terms:
        return (
            db.query(ProductModel)
            .options(*_PRODUCT_LOAD_OPTIONS)
            .filter(ProductModel.id == -1)
        )

    conditions = _build_match_conditions(parsed)
    if not conditions:
        return (
            db.query(ProductModel)
            .options(*_PRODUCT_LOAD_OPTIONS)
            .filter(ProductModel.id == -1)
        )

    query = (
        db.query(ProductModel)
        .options(*_PRODUCT_LOAD_OPTIONS)
        .filter(or_(*conditions), _in_stock_filter())
    )

    if is_new is not None:
        query = query.filter(ProductModel.is_new == is_new)

    if apply_order:
        relevance = _build_relevance_score(parsed)
        if relevance is not None:
            query = query.order_by(relevance.desc(), ProductModel.id.desc())
        else:
            query = query.order_by(ProductModel.id.desc())

    if limit is not None and limit > 0:
        query = query.limit(limit)

    return query


def build_search_relevance_score(q: str):
    """CASE-выражение релевантности для сортировки результатов поиска."""
    parsed = parse_search_query(q)
    if not parsed.has_terms:
        return None
    return _build_relevance_score(parsed)
