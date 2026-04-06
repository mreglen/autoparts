import re

from fastapi import APIRouter, Depends
from sqlalchemy import func, or_
from sqlalchemy.orm import Session

from app.core.auth import get_current_user
from app.db.database import get_db
from app.models.product import Product as ProductModel
from app.models.tecdoc import (
    TecdocArticle,
    TecdocArticleCrossList,
    TecdocArticleOeNumber,
    TecdocArticleReplaceNumber,
    TecdocSupplier,
)
from app.models.user import User

router = APIRouter(prefix="/tecdoc-parts", tags=["TecDoc parts"])


_ART_CLEAN_RE = re.compile(r"[^A-Za-z0-9А-Яа-яЁё]")


def _norm_token(s: str) -> str:
    return _ART_CLEAN_RE.sub("", (s or "")).upper()


def _sql_norm(col):
    # Keep in sync with backend/app/routers/search_products.py
    expr = func.upper(col)
    for ch in ("-", " ", ".", "/", "(", ")", "_", "\\"):
        expr = func.replace(expr, ch, "")
    return expr


def _dedupe_keep_order(values: list[str], limit: int) -> list[str]:
    seen: set[str] = set()
    out: list[str] = []
    for v in values:
        if v is None:
            continue
        s = str(v).strip()
        if not s:
            continue
        k = s.casefold()
        if k in seen:
            continue
        seen.add(k)
        out.append(s)
        if len(out) >= limit:
            break
    return out


@router.get("/articles/suggest", response_model=list[str])
def suggest_articles(
    q: str = "",
    limit: int = 20,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    term = (q or "").strip()
    if not term:
        return []
    limit = max(1, min(int(limit or 20), 80))

    norm = _norm_token(term)

    tecdoc_rows: list[str] = []

    # 1) Main TecDoc article numbers (if table is populated)
    art_q = db.query(TecdocArticle.DataSupplierArticleNumber).filter(
        TecdocArticle.DataSupplierArticleNumber.isnot(None),
        or_(
            TecdocArticle.DataSupplierArticleNumber.ilike(f"%{term}%"),
            _sql_norm(TecdocArticle.DataSupplierArticleNumber).ilike(f"%{norm}%") if norm else False,
        ),
    )
    tecdoc_rows.extend([r[0] for r in art_q.limit(200).all()])

    # 2) Cross list (often populated even when tecdoc_articles is empty)
    cross_q = db.query(TecdocArticleCrossList.Article).filter(
        TecdocArticleCrossList.Article.isnot(None),
        or_(
            TecdocArticleCrossList.Article.ilike(f"%{term}%"),
            _sql_norm(TecdocArticleCrossList.Article).ilike(f"%{norm}%") if norm else False,
        ),
    )
    tecdoc_rows.extend([r[0] for r in cross_q.limit(200).all()])

    # 3) Replace numbers
    rep_q = db.query(TecdocArticleReplaceNumber.ReplaceNbr).filter(
        TecdocArticleReplaceNumber.ReplaceNbr.isnot(None),
        or_(
            TecdocArticleReplaceNumber.ReplaceNbr.ilike(f"%{term}%"),
            _sql_norm(TecdocArticleReplaceNumber.ReplaceNbr).ilike(f"%{norm}%") if norm else False,
        ),
    )
    tecdoc_rows.extend([r[0] for r in rep_q.limit(200).all()])

    # 4) OEM numbers (optional)
    oe_q = db.query(TecdocArticleOeNumber.OENbr).filter(
        TecdocArticleOeNumber.OENbr.isnot(None),
        or_(
            TecdocArticleOeNumber.OENbr.ilike(f"%{term}%"),
            _sql_norm(TecdocArticleOeNumber.OENbr).ilike(f"%{norm}%") if norm else False,
        ),
    )
    tecdoc_rows.extend([r[0] for r in oe_q.limit(200).all()])

    product_rows: list[str] = []
    if current_user.organization_id:
        prod_q = db.query(ProductModel.article).filter(
            ProductModel.organization_id == current_user.organization_id,
            ProductModel.article.isnot(None),
            or_(
                ProductModel.article.ilike(f"%{term}%"),
                _sql_norm(ProductModel.article).ilike(f"%{norm}%") if norm else False,
            ),
        )
        product_rows = [r[0] for r in prod_q.limit(200).all()]

    return _dedupe_keep_order(tecdoc_rows + product_rows, limit=limit)


@router.get("/brands/suggest", response_model=list[str])
def suggest_brands(
    q: str = "",
    article: str = "",
    limit: int = 20,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    term = (q or "").strip()
    article_term = (article or "").strip()
    article_norm = _norm_token(article_term)
    if not term and not article_term:
        return []
    limit = max(1, min(int(limit or 20), 80))

    supplier_ids: set[int] = set()
    if article_term:
        art_ids = (
            db.query(TecdocArticle.Supplier)
            .filter(
                TecdocArticle.Supplier.isnot(None),
                or_(
                    TecdocArticle.DataSupplierArticleNumber.ilike(f"%{article_term}%"),
                    _sql_norm(TecdocArticle.DataSupplierArticleNumber).ilike(f"%{article_norm}%")
                    if article_norm
                    else False,
                ),
            )
            .limit(500)
            .all()
        )
        supplier_ids.update([sid for (sid,) in art_ids if sid is not None])

        cross_ids = (
            db.query(TecdocArticleCrossList.supplier)
            .filter(
                TecdocArticleCrossList.supplier.isnot(None),
                or_(
                    TecdocArticleCrossList.Article.ilike(f"%{article_term}%"),
                    _sql_norm(TecdocArticleCrossList.Article).ilike(f"%{article_norm}%")
                    if article_norm
                    else False,
                ),
            )
            .limit(500)
            .all()
        )
        supplier_ids.update([sid for (sid,) in cross_ids if sid is not None])

        rep_ids = (
            db.query(TecdocArticleReplaceNumber.Supplier)
            .filter(
                TecdocArticleReplaceNumber.Supplier.isnot(None),
                or_(
                    TecdocArticleReplaceNumber.ReplaceNbr.ilike(f"%{article_term}%"),
                    _sql_norm(TecdocArticleReplaceNumber.ReplaceNbr).ilike(f"%{article_norm}%")
                    if article_norm
                    else False,
                ),
            )
            .limit(500)
            .all()
        )
        supplier_ids.update([sid for (sid,) in rep_ids if sid is not None])

    def _load_supplier_vals(restrict_by_article: bool) -> list[str]:
        supp_q = db.query(TecdocSupplier.Description, TecdocSupplier.MatchCode)
        if restrict_by_article and supplier_ids:
            supp_q = supp_q.filter(
                or_(
                    TecdocSupplier.id.in_(list(supplier_ids)),
                    TecdocSupplier.internalID.in_(list(supplier_ids)),
                )
            )
        if term:
            supp_q = supp_q.filter(
                or_(
                    TecdocSupplier.Description.ilike(f"%{term}%"),
                    TecdocSupplier.MatchCode.ilike(f"%{term}%"),
                )
            )
        supp_q = supp_q.limit(250)
        vals: list[str] = []
        for d, mc in supp_q.all():
            if d:
                vals.append(d)
            elif mc:
                vals.append(mc)
        return vals

    supplier_vals = _load_supplier_vals(restrict_by_article=bool(article_term))

    # Fallback: if "article + brand text" gave no matches, relax article filter and
    # still provide brand suggestions by typed text.
    if article_term and term and not supplier_vals:
        supplier_vals = _load_supplier_vals(restrict_by_article=False)

    product_vals: list[str] = []

    def _load_product_vals(restrict_by_article: bool) -> list[str]:
        if not current_user.organization_id:
            return []
        prod_q = db.query(ProductModel.brand).filter(
            ProductModel.organization_id == current_user.organization_id,
            ProductModel.brand.isnot(None),
        )
        if term:
            prod_q = prod_q.filter(ProductModel.brand.ilike(f"%{term}%"))
        if restrict_by_article and article_term:
            prod_q = prod_q.filter(
                or_(
                    ProductModel.article.ilike(f"%{article_term}%"),
                    _sql_norm(ProductModel.article).ilike(f"%{article_norm}%") if article_norm else False,
                )
            )
        prod_q = prod_q.distinct().limit(250)
        return [r[0] for r in prod_q.all()]

    product_vals = _load_product_vals(restrict_by_article=bool(article_term))

    if article_term and term and not product_vals:
        product_vals = _load_product_vals(restrict_by_article=False)

    merged = _dedupe_keep_order(supplier_vals + product_vals, limit=5000)
    merged_sorted = sorted(merged, key=lambda s: s.casefold())
    return merged_sorted[:limit]

