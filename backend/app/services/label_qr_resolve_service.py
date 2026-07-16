"""Resolve warehouse label QR codes to product / pending / rejected records."""
from __future__ import annotations

import json
import logging

from sqlalchemy import desc
from sqlalchemy.orm import Session

from app.models.event_log import EventLog
from app.models.pending_product import PendingProduct
from app.models.product import Product
from app.models.rejected_product import RejectedProduct

logger = logging.getLogger(__name__)


def normalize_label_internal_code(raw: str | None) -> str:
    code = str(raw or "").strip().upper().replace(" ", "")
    if not code or code in {"—", "-", "–"}:
        return ""
    return code


def _code_lookup_variants(raw: str | None) -> list[str]:
    code = normalize_label_internal_code(raw)
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


def _product_payload(product: Product, *, source_pending_id: int | None = None) -> dict:
    return {
        "type": "product",
        "product_id": product.id,
        "organization_id": product.organization_id,
        "internal_code": product.internal_code,
        "source_pending_id": source_pending_id
        if source_pending_id is not None
        else getattr(product, "source_pending_id", None),
    }


def _pending_payload(pending: PendingProduct) -> dict:
    return {
        "type": "pending",
        "pending_product_id": pending.id,
        "organization_id": pending.organization_id,
        "internal_code": pending.internal_code,
    }


def _rejected_payload(rejected: RejectedProduct) -> dict:
    return {
        "type": "rejected",
        "rejected_product_id": rejected.id,
        "organization_id": rejected.organization_id,
        "internal_code": rejected.internal_code,
    }


def resolve_label_internal_code(
    db: Session,
    *,
    organization_id: str | None,
    internal_code: str,
) -> dict | None:
    """Resolve by internal code. Prefer caller's org, then global unique code."""
    variants = _code_lookup_variants(internal_code)
    if not variants:
        return None

    product_q = db.query(Product).filter(Product.internal_code.in_(variants))
    if organization_id:
        product = product_q.filter(Product.organization_id == organization_id).first()
        if not product:
            product = product_q.first()
    else:
        product = product_q.first()
    if product:
        return _product_payload(product)

    pending_q = db.query(PendingProduct).filter(PendingProduct.internal_code.in_(variants))
    if organization_id:
        pending = pending_q.filter(PendingProduct.organization_id == organization_id).first()
        if not pending:
            pending = pending_q.first()
    else:
        pending = pending_q.first()
    if pending:
        return _pending_payload(pending)

    rejected_q = db.query(RejectedProduct).filter(RejectedProduct.internal_code.in_(variants))
    if organization_id:
        rejected = rejected_q.filter(RejectedProduct.organization_id == organization_id).first()
        if not rejected:
            rejected = rejected_q.first()
    else:
        rejected = rejected_q.first()
    if rejected:
        return _rejected_payload(rejected)

    return None


def _find_product_id_from_approval_audit(db: Session, pending_id: int) -> int | None:
    """Look up product_id from product_moderation_approved audit details."""
    rows = (
        db.query(EventLog)
        .filter(EventLog.event_type == "product_moderation_approved")
        .order_by(desc(EventLog.id))
        .limit(500)
        .all()
    )
    needle = int(pending_id)
    for row in rows:
        if not row.details:
            continue
        try:
            details = json.loads(row.details) if isinstance(row.details, str) else row.details
        except Exception:
            continue
        if not isinstance(details, dict):
            continue
        try:
            logged_pending = details.get("pending_product_id")
            if logged_pending is None:
                continue
            if int(logged_pending) != needle:
                continue
            product_id = details.get("product_id")
            if product_id is not None:
                return int(product_id)
            if row.entity_type == "product" and row.entity_id:
                return int(row.entity_id)
        except (TypeError, ValueError):
            continue
    return None


def resolve_approved_product_by_pending_id(
    db: Session,
    *,
    organization_id: str | None,
    pending_id: int,
) -> dict | None:
    if not pending_id:
        return None

    product_q = db.query(Product).filter(Product.source_pending_id == pending_id)
    if organization_id:
        product = product_q.filter(Product.organization_id == organization_id).first()
        if not product:
            product = product_q.first()
    else:
        product = product_q.first()
    if product:
        return _product_payload(product, source_pending_id=pending_id)

    audited_product_id = _find_product_id_from_approval_audit(db, pending_id)
    if audited_product_id:
        product = db.query(Product).filter(Product.id == audited_product_id).first()
        if product:
            if organization_id and product.organization_id != organization_id:
                # Still return — frontend routes by role/org of the product
                pass
            return _product_payload(product, source_pending_id=pending_id)

    return None


def resolve_pending_label(
    db: Session,
    *,
    pending_id: int,
    organization_id: str | None = None,
) -> dict | None:
    """Resolve legacy edit-pending QR: live pending row or approved product."""
    if not pending_id:
        return None

    pending_q = db.query(PendingProduct).filter(PendingProduct.id == pending_id)
    if organization_id:
        pending = pending_q.filter(PendingProduct.organization_id == organization_id).first()
        if not pending:
            pending = pending_q.first()
    else:
        pending = pending_q.first()
    if pending:
        return _pending_payload(pending)

    return resolve_approved_product_by_pending_id(
        db,
        organization_id=organization_id,
        pending_id=pending_id,
    )


def build_label_qr_path(internal_code: str) -> str:
    code = normalize_label_internal_code(internal_code)
    if not code:
        return ""
    return f"/qr/label/{code}"
