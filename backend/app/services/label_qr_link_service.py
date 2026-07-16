"""Register and backfill label QR links (pending ↔ product ↔ internal_code)."""
from __future__ import annotations

import json
import logging

from sqlalchemy import desc
from sqlalchemy.orm import Session

from app.models.event_log import EventLog
from app.models.label_qr_link import LabelQrLink
from app.models.pending_product import PendingProduct
from app.models.product import Product
from app.models.rejected_product import RejectedProduct

logger = logging.getLogger(__name__)


def _norm_code(raw: str | None) -> str:
    code = str(raw or "").strip().upper().replace(" ", "")
    if not code or code in {"—", "-", "–"}:
        return ""
    return code


def _parse_details(raw) -> dict | None:
    if not raw:
        return None
    try:
        details = json.loads(raw) if isinstance(raw, str) else raw
    except Exception:
        return None
    return details if isinstance(details, dict) else None


def _code_variants(raw: str | None) -> list[str]:
    code = _norm_code(raw)
    if not code:
        return []
    variants = [code]
    compact = "".join(ch for ch in code if ch.isalnum())
    if compact and compact not in variants:
        variants.append(compact)
    if len(compact) >= 9:
        with_hyphen = f"{compact[:4]}-{compact[4:]}"
        if with_hyphen not in variants:
            variants.append(with_hyphen)
    return variants


def upsert_label_qr_link(
    db: Session,
    *,
    organization_id: str,
    internal_code: str | None,
    pending_product_id: int | None = None,
    product_id: int | None = None,
    rejected_product_id: int | None = None,
    commit: bool = False,
) -> LabelQrLink | None:
    """Create or update a durable label QR mapping. Prefer lookup by pending_id, then product_id, then code."""
    code = _norm_code(internal_code)
    if not organization_id:
        return None
    if not code and pending_product_id is None and product_id is None:
        return None

    link: LabelQrLink | None = None
    if pending_product_id is not None:
        link = (
            db.query(LabelQrLink)
            .filter(LabelQrLink.pending_product_id == int(pending_product_id))
            .first()
        )
    if link is None and product_id is not None:
        link = (
            db.query(LabelQrLink)
            .filter(LabelQrLink.product_id == int(product_id))
            .first()
        )
    if link is None and code:
        variants = _code_variants(code)
        link = (
            db.query(LabelQrLink)
            .filter(
                LabelQrLink.organization_id == organization_id,
                LabelQrLink.internal_code.in_(variants),
            )
            .order_by(desc(LabelQrLink.id))
            .first()
        )

    if link is None:
        if not code:
            return None
        link = LabelQrLink(
            organization_id=organization_id,
            internal_code=code,
        )
        db.add(link)

    link.organization_id = organization_id
    if code:
        link.internal_code = code
    if pending_product_id is not None:
        link.pending_product_id = int(pending_product_id)
    if product_id is not None:
        link.product_id = int(product_id)
    if rejected_product_id is not None:
        link.rejected_product_id = int(rejected_product_id)

    if commit:
        db.commit()
        db.refresh(link)
    else:
        db.flush()
    return link


def get_link_by_pending_id(db: Session, pending_id: int) -> LabelQrLink | None:
    if not pending_id:
        return None
    return (
        db.query(LabelQrLink)
        .filter(LabelQrLink.pending_product_id == int(pending_id))
        .first()
    )


def get_link_by_internal_code(
    db: Session,
    *,
    internal_code: str,
    organization_id: str | None = None,
) -> LabelQrLink | None:
    variants = _code_variants(internal_code)
    if not variants:
        return None
    q = db.query(LabelQrLink).filter(LabelQrLink.internal_code.in_(variants))
    if organization_id:
        link = q.filter(LabelQrLink.organization_id == organization_id).order_by(desc(LabelQrLink.id)).first()
        if link:
            return link
    return q.order_by(desc(LabelQrLink.id)).first()


def sync_product_source_pending_id(db: Session, product: Product, pending_id: int | None) -> None:
    if not product or not pending_id:
        return
    if getattr(product, "source_pending_id", None):
        return
    product.source_pending_id = int(pending_id)


def backfill_label_qr_links(db: Session) -> dict:
    """Idempotent recovery of pending↔product links for legacy printed labels."""
    stats = {
        "from_source_pending_id": 0,
        "from_approve_audit": 0,
        "from_create_audit": 0,
        "from_live_pending": 0,
        "from_live_rejected": 0,
        "products_source_filled": 0,
        "errors": 0,
    }

    # 1) Products that already have source_pending_id
    for product in db.query(Product).filter(Product.source_pending_id.isnot(None)).all():
        try:
            upsert_label_qr_link(
                db,
                organization_id=product.organization_id,
                internal_code=product.internal_code,
                pending_product_id=product.source_pending_id,
                product_id=product.id,
            )
            stats["from_source_pending_id"] += 1
        except Exception:
            stats["errors"] += 1
            logger.exception("label_qr backfill source_pending_id product=%s", product.id)

    # 2) Approve audit rows with both ids
    approve_rows = (
        db.query(EventLog)
        .filter(EventLog.event_type == "product_moderation_approved")
        .order_by(desc(EventLog.id))
        .limit(20000)
        .all()
    )
    for row in approve_rows:
        details = _parse_details(row.details)
        if not details:
            continue
        try:
            pending_id = details.get("pending_product_id")
            product_id = details.get("product_id") or (
                int(row.entity_id) if row.entity_type == "product" and row.entity_id else None
            )
            if pending_id is None or product_id is None:
                continue
            pending_id = int(pending_id)
            product_id = int(product_id)
            product = db.query(Product).filter(Product.id == product_id).first()
            if not product:
                continue
            code = _norm_code(details.get("internal_code")) or _norm_code(product.internal_code)
            upsert_label_qr_link(
                db,
                organization_id=product.organization_id,
                internal_code=code,
                pending_product_id=pending_id,
                product_id=product_id,
            )
            sync_product_source_pending_id(db, product, pending_id)
            stats["from_approve_audit"] += 1
        except Exception:
            stats["errors"] += 1
            logger.exception("label_qr backfill approve audit id=%s", row.id)

    # 3) Create-audit internal_code → unique product in same org
    create_rows = (
        db.query(EventLog)
        .filter(EventLog.event_type.in_(("pending_product_created", "pending_product_updated")))
        .order_by(desc(EventLog.id))
        .limit(30000)
        .all()
    )
    seen_pending: set[int] = set()
    for row in create_rows:
        details = _parse_details(row.details)
        if not details:
            continue
        try:
            pending_id = details.get("pending_product_id")
            if pending_id is None and row.entity_type == "pending_product" and row.entity_id:
                pending_id = row.entity_id
            if pending_id is None:
                continue
            pending_id = int(pending_id)
            if pending_id in seen_pending:
                continue
            seen_pending.add(pending_id)

            existing = get_link_by_pending_id(db, pending_id)
            if existing and existing.product_id:
                continue

            code = _norm_code(details.get("internal_code"))
            org_id = row.organization_id
            if not code or not org_id:
                continue

            variants = _code_variants(code)
            matches = (
                db.query(Product)
                .filter(
                    Product.organization_id == org_id,
                    Product.internal_code.in_(variants),
                )
                .all()
            )
            product = matches[0] if len(matches) == 1 else None
            if product is None:
                # Still register pending-only link for live/legacy pending resolve
                upsert_label_qr_link(
                    db,
                    organization_id=org_id,
                    internal_code=code,
                    pending_product_id=pending_id,
                    product_id=existing.product_id if existing else None,
                )
                stats["from_create_audit"] += 1
                continue

            upsert_label_qr_link(
                db,
                organization_id=org_id,
                internal_code=code,
                pending_product_id=pending_id,
                product_id=product.id,
            )
            sync_product_source_pending_id(db, product, pending_id)
            stats["from_create_audit"] += 1
        except Exception:
            stats["errors"] += 1
            logger.exception("label_qr backfill create audit id=%s", row.id)

    # 4) Live pending rows
    for pending in db.query(PendingProduct).all():
        try:
            upsert_label_qr_link(
                db,
                organization_id=pending.organization_id,
                internal_code=pending.internal_code,
                pending_product_id=pending.id,
            )
            stats["from_live_pending"] += 1
        except Exception:
            stats["errors"] += 1

    # 5) Live rejected rows (best-effort)
    for rejected in db.query(RejectedProduct).all():
        try:
            upsert_label_qr_link(
                db,
                organization_id=rejected.organization_id,
                internal_code=rejected.internal_code,
                rejected_product_id=rejected.id,
            )
            stats["from_live_rejected"] += 1
        except Exception:
            stats["errors"] += 1

    # 6) Mirror links → products.source_pending_id
    for link in db.query(LabelQrLink).filter(
        LabelQrLink.product_id.isnot(None),
        LabelQrLink.pending_product_id.isnot(None),
    ).all():
        product = db.query(Product).filter(Product.id == link.product_id).first()
        if not product:
            continue
        before = product.source_pending_id
        sync_product_source_pending_id(db, product, link.pending_product_id)
        if product.source_pending_id and product.source_pending_id != before:
            stats["products_source_filled"] += 1

    db.commit()
    logger.info("label_qr_links backfill done: %s", stats)
    return stats
