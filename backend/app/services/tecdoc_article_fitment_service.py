from __future__ import annotations

import re
from typing import TYPE_CHECKING

from sqlalchemy import func, or_, text
from sqlalchemy.orm import Session

from app.models.tecdoc import TecdocArticle, TecdocSupplier
from app.services.seo_tecdoc_brand_service import map_tecdoc_brand_to_rossko

if TYPE_CHECKING:
    from app.services.product_reference_fitment_service import ReferenceFitmentVehicle

_ART_CLEAN_RE = re.compile(r"[^A-Za-z0-9А-Яа-яЁё]")


def _norm_article(value: str) -> str:
    return _ART_CLEAN_RE.sub("", (value or "")).upper()


def _sql_norm(column):
    expr = func.upper(column)
    for ch in ("-", " ", ".", "/", "(", ")", "_", "\\"):
        expr = func.replace(expr, ch, "")
    return expr


def _normalize_token(value: object) -> str:
    return re.sub(r"\s+", " ", str(value or "")).strip()


def _resolve_link_query_sql(db: Session) -> str | None:
    rows = db.execute(
        text(
            "SELECT tablename FROM pg_tables "
            "WHERE schemaname = 'public' AND tablename LIKE 'tecdoc%'"
        )
    ).fetchall()
    tables = {row[0] for row in rows}
    for required, sql in (
        (
            {"tecdoc_linkages_art", "tecdoc_linkages_la_typ"},
            """
            SELECT DISTINCT
                COALESCE(m."Description", '') AS brand,
                COALESCE(mo."Description", '') AS model,
                COALESCE(pc."FullDescription", pc."Description", '') AS generation
            FROM tecdoc_articles a
            JOIN tecdoc_linkages_art la ON la.article_id = a.id
            JOIN tecdoc_linkages_la_typ lt ON lt.linkage_id = la.linkage_id
            JOIN tecdoc_passengercars pc ON pc.id = lt.passengercar_id
            LEFT JOIN tecdoc_models mo ON mo.id = pc."Model"
            LEFT JOIN tecdoc_manufacturers m ON m.id = pc."ManufacturerId"
            WHERE a.id IN :article_ids
              AND COALESCE(m."Description", '') <> ''
              AND COALESCE(mo."Description", '') <> ''
            LIMIT :lim
            """,
        ),
        (
            {"tecdoc_link_art", "tecdoc_link_la_typ"},
            """
            SELECT DISTINCT
                COALESCE(m."Description", '') AS brand,
                COALESCE(mo."Description", '') AS model,
                COALESCE(pc."FullDescription", pc."Description", '') AS generation
            FROM tecdoc_articles a
            JOIN tecdoc_link_art la ON la.article_id = a.id
            JOIN tecdoc_link_la_typ lt ON lt.link_id = la.link_id
            JOIN tecdoc_passengercars pc ON pc.id = lt.passengercar_id
            LEFT JOIN tecdoc_models mo ON mo.id = pc."Model"
            LEFT JOIN tecdoc_manufacturers m ON m.id = pc."ManufacturerId"
            WHERE a.id IN :article_ids
              AND COALESCE(m."Description", '') <> ''
              AND COALESCE(mo."Description", '') <> ''
            LIMIT :lim
            """,
        ),
    ):
        if required.issubset(tables):
            return sql.strip()
    return None


def _find_supplier_ids(db: Session, brand: str) -> set[int]:
    mapped = map_tecdoc_brand_to_rossko(brand)
    terms = {_normalize_token(brand).casefold(), _normalize_token(mapped).casefold()}
    terms.discard("")
    if not terms:
        return set()

    supplier_ids: set[int] = set()
    rows = db.query(
        TecdocSupplier.id,
        TecdocSupplier.internalID,
        TecdocSupplier.Description,
        TecdocSupplier.MatchCode,
    ).all()
    for sid, internal_id, description, matchcode in rows:
        hay = " ".join(part for part in (description, matchcode) if part).casefold()
        if any(term in hay for term in terms):
            if sid is not None:
                supplier_ids.add(int(sid))
            if internal_id is not None:
                supplier_ids.add(int(internal_id))
    return supplier_ids


def _find_article_ids(db: Session, brand: str, article: str) -> list[int]:
    article_text = _normalize_token(article)
    if not article_text:
        return []

    supplier_ids = _find_supplier_ids(db, brand)
    norm = _norm_article(article_text)
    query = db.query(TecdocArticle.id).filter(TecdocArticle.DataSupplierArticleNumber.isnot(None))

    if supplier_ids:
        query = query.filter(TecdocArticle.Supplier.in_(list(supplier_ids)))

    if norm:
        query = query.filter(
            or_(
                TecdocArticle.DataSupplierArticleNumber.ilike(article_text),
                _sql_norm(TecdocArticle.DataSupplierArticleNumber) == norm,
            )
        )
    else:
        query = query.filter(TecdocArticle.DataSupplierArticleNumber.ilike(article_text))

    return [int(row[0]) for row in query.limit(30).all()]


def get_tecdoc_article_fitment_vehicles(
    db: Session,
    *,
    brand: str,
    article: str,
    limit: int = 24,
) -> list[ReferenceFitmentVehicle]:
    from app.services.product_reference_fitment_service import ReferenceFitmentVehicle

    brand_text = _normalize_token(brand)
    article_text = _normalize_token(article)
    if not brand_text or not article_text:
        return []

    article_ids = _find_article_ids(db, brand_text, article_text)
    if not article_ids:
        return []

    link_sql = _resolve_link_query_sql(db)
    if not link_sql:
        return []

    try:
        rows = db.execute(
            text(link_sql),
            {"article_ids": tuple(article_ids), "lim": limit},
        ).mappings().all()
    except Exception:
        return []

    vehicles: list[ReferenceFitmentVehicle] = []
    seen: set[str] = set()
    for row in rows:
        brand_name = _normalize_token(row.get("brand"))
        model_name = _normalize_token(row.get("model"))
        generation = _normalize_token(row.get("generation"))
        if not brand_name or not model_name:
            continue
        key = "|".join(part.casefold() for part in (brand_name, model_name, generation))
        if key in seen:
            continue
        seen.add(key)
        vehicles.append(
            ReferenceFitmentVehicle(
                brand=brand_name,
                model=model_name,
                generation=generation,
                source="tecdoc",
            )
        )
        if len(vehicles) >= limit:
            break
    return vehicles
