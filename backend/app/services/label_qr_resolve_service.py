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

    # Durable mapping table (pending + product for the same code)
    try:
        from app.services.label_qr_link_service import get_link_by_internal_code

        link = get_link_by_internal_code(
            db,
            internal_code=internal_code,
            organization_id=organization_id,
        )
        if link and link.product_id:
            product = db.query(Product).filter(Product.id == link.product_id).first()
            if product:
                return _product_payload(product, source_pending_id=link.pending_product_id)
        if link and link.pending_product_id:
            pending = db.query(PendingProduct).filter(PendingProduct.id == link.pending_product_id).first()
            if pending:
                return _pending_payload(pending)
        if link and link.rejected_product_id:
            rejected = db.query(RejectedProduct).filter(RejectedProduct.id == link.rejected_product_id).first()
            if rejected:
                return _rejected_payload(rejected)
    except Exception:
        logger.exception("label_qr_links lookup by code failed")

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


def _parse_event_details(raw) -> dict | None:
    if not raw:
        return None
    try:
        details = json.loads(raw) if isinstance(raw, str) else raw
    except Exception:
        return None
    return details if isinstance(details, dict) else None


def _event_log_pending_id_filters(pending_id: int):
    """SQL LIKE variants for JSON details containing pending_product_id."""
    needle = int(pending_id)
    return [
        f'"pending_product_id": {needle}',
        f'"pending_product_id":{needle}',
        f'"pending_product_id": "{needle}"',
        f'"pending_product_id":"{needle}"',
    ]


def _find_product_id_from_approval_audit(db: Session, pending_id: int) -> int | None:
    """Look up product_id from product_moderation_approved audit details."""
    needle = int(pending_id)
    query = db.query(EventLog).filter(EventLog.event_type == "product_moderation_approved")
    narrowed = None
    for fragment in _event_log_pending_id_filters(needle):
        candidate = query.filter(EventLog.details.contains(fragment)).order_by(desc(EventLog.id)).first()
        if candidate:
            narrowed = candidate
            break

    rows = [narrowed] if narrowed else (
        query.order_by(desc(EventLog.id)).limit(1000).all()
    )

    for row in rows:
        details = _parse_event_details(row.details)
        if not details:
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


def _find_internal_code_from_pending_audit(db: Session, pending_id: int) -> str | None:
    """Recover internal_code from pending_product_created / updated audit."""
    needle = int(pending_id)
    event_types = (
        "pending_product_created",
        "pending_product_updated",
        "product_moderation_approved",
    )
    query = db.query(EventLog).filter(EventLog.event_type.in_(event_types))

    rows = []
    for fragment in _event_log_pending_id_filters(needle):
        rows = (
            query.filter(EventLog.details.contains(fragment))
            .order_by(desc(EventLog.id))
            .limit(20)
            .all()
        )
        if rows:
            break

    if not rows:
        rows = (
            query.filter(
                EventLog.entity_type == "pending_product",
                EventLog.entity_id == str(needle),
            )
            .order_by(desc(EventLog.id))
            .limit(20)
            .all()
        )

    for row in rows:
        details = _parse_event_details(row.details)
        if not details:
            continue
        try:
            logged_pending = details.get("pending_product_id")
            if logged_pending is not None and int(logged_pending) != needle:
                continue
        except (TypeError, ValueError):
            continue
        code = normalize_label_internal_code(details.get("internal_code"))
        if code:
            return code
    return None


def resolve_approved_product_by_pending_id(
    db: Session,
    *,
    organization_id: str | None,
    pending_id: int,
) -> dict | None:
    if not pending_id:
        return None

    # 0) Durable label_qr_links table
    try:
        from app.services.label_qr_link_service import get_link_by_pending_id, upsert_label_qr_link

        link = get_link_by_pending_id(db, pending_id)
        if link and link.product_id:
            product = db.query(Product).filter(Product.id == link.product_id).first()
            if product:
                return _product_payload(product, source_pending_id=pending_id)
    except Exception:
        logger.exception("label_qr_links lookup by pending_id failed")
        link = None

    product_q = db.query(Product).filter(Product.source_pending_id == pending_id)
    if organization_id:
        product = product_q.filter(Product.organization_id == organization_id).first()
        if not product:
            product = product_q.first()
    else:
        product = product_q.first()
    if product:
        try:
            from app.services.label_qr_link_service import upsert_label_qr_link

            upsert_label_qr_link(
                db,
                organization_id=product.organization_id,
                internal_code=product.internal_code,
                pending_product_id=pending_id,
                product_id=product.id,
                commit=True,
            )
        except Exception:
            logger.exception("failed to persist label_qr_link from source_pending_id")
        return _product_payload(product, source_pending_id=pending_id)

    audited_product_id = _find_product_id_from_approval_audit(db, pending_id)
    if audited_product_id:
        product = db.query(Product).filter(Product.id == audited_product_id).first()
        if product:
            try:
                from app.services.label_qr_link_service import upsert_label_qr_link

                upsert_label_qr_link(
                    db,
                    organization_id=product.organization_id,
                    internal_code=product.internal_code,
                    pending_product_id=pending_id,
                    product_id=product.id,
                    commit=True,
                )
                if not getattr(product, "source_pending_id", None):
                    product.source_pending_id = pending_id
                    db.commit()
            except Exception:
                logger.exception("failed to persist label_qr_link from approve audit")
            return _product_payload(product, source_pending_id=pending_id)

    # Legacy: pending deleted before source_pending_id / approve audit details —
    # recover via internal_code from create/update audit.
    legacy_code = _find_internal_code_from_pending_audit(db, pending_id)
    if not legacy_code and link is not None:
        legacy_code = normalize_label_internal_code(getattr(link, "internal_code", None))
    if legacy_code:
        resolved = resolve_label_internal_code(
            db,
            organization_id=organization_id,
            internal_code=legacy_code,
        )
        if resolved and resolved.get("type") == "product":
            resolved = dict(resolved)
            resolved["source_pending_id"] = pending_id
            try:
                from app.services.label_qr_link_service import upsert_label_qr_link

                product = db.query(Product).filter(Product.id == resolved["product_id"]).first()
                if product:
                    upsert_label_qr_link(
                        db,
                        organization_id=product.organization_id,
                        internal_code=legacy_code,
                        pending_product_id=pending_id,
                        product_id=product.id,
                        commit=True,
                    )
                    if not getattr(product, "source_pending_id", None):
                        product.source_pending_id = pending_id
                        db.commit()
            except Exception:
                logger.exception("failed to persist label_qr_link from legacy code")
            return resolved

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

    try:
        from app.services.label_qr_link_service import get_link_by_pending_id

        link = get_link_by_pending_id(db, pending_id)
        if link and link.rejected_product_id and not link.product_id:
            rejected = (
                db.query(RejectedProduct)
                .filter(RejectedProduct.id == link.rejected_product_id)
                .first()
            )
            if rejected:
                return _rejected_payload(rejected)
    except Exception:
        logger.exception("label_qr_links rejected lookup failed")

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
