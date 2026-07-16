"""Resolve warehouse label QR codes to in-app routes."""
from __future__ import annotations

from sqlalchemy.orm import Session

from app.models.pending_product import PendingProduct
from app.models.product import Product
from app.models.rejected_product import RejectedProduct


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


def resolve_label_internal_code(
    db: Session,
    *,
    organization_id: str | None,
    internal_code: str,
) -> dict | None:
    variants = _code_lookup_variants(internal_code)
    if not variants or not organization_id:
        return None

    product = (
        db.query(Product)
        .filter(
            Product.organization_id == organization_id,
            Product.internal_code.in_(variants),
        )
        .first()
    )
    if product:
        return {
            "type": "product",
            "path": f"/seller/part-card/{product.id}",
            "product_id": product.id,
            "internal_code": product.internal_code,
        }

    pending = (
        db.query(PendingProduct)
        .filter(
            PendingProduct.organization_id == organization_id,
            PendingProduct.internal_code.in_(variants),
        )
        .first()
    )
    if pending:
        return {
            "type": "pending",
            "path": f"/my-parts/edit-pending/{pending.id}",
            "pending_product_id": pending.id,
            "internal_code": pending.internal_code,
        }

    rejected = (
        db.query(RejectedProduct)
        .filter(
            RejectedProduct.organization_id == organization_id,
            RejectedProduct.internal_code.in_(variants),
        )
        .first()
    )
    if rejected:
        return {
            "type": "rejected",
            "path": f"/my-parts/resubmit/{rejected.id}",
            "rejected_product_id": rejected.id,
            "internal_code": rejected.internal_code,
        }

    return None


def resolve_approved_product_by_pending_id(
    db: Session,
    *,
    organization_id: str | None,
    pending_id: int,
) -> dict | None:
    if not organization_id or not pending_id:
        return None
    product = (
        db.query(Product)
        .filter(
            Product.organization_id == organization_id,
            Product.source_pending_id == pending_id,
        )
        .first()
    )
    if not product:
        return None
    return {
        "type": "product",
        "path": f"/seller/part-card/{product.id}",
        "product_id": product.id,
        "internal_code": product.internal_code,
        "source_pending_id": pending_id,
    }


def build_label_qr_path(internal_code: str) -> str:
    code = normalize_label_internal_code(internal_code)
    if not code:
        return ""
    return f"/qr/label/{code}"
