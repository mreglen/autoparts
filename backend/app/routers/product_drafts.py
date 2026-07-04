from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.auth import get_current_user
from app.db.database import get_db
from app.models.product_draft import ProductDraft as ProductDraftModel
from app.models.user import User
from app.schemas.product_draft import ProductDraft, ProductDraftCreate, ProductDraftUpdate
from app.services.audit_service import log_audit
from app.services.product_draft_service import (
    apply_draft_payload,
    build_pending_payload,
    cleanup_draft_temp_media,
    draft_has_content,
    get_owned_draft,
    parse_storage_cells,
    require_organization,
    serialize_draft,
)

router = APIRouter(prefix="/product-drafts", tags=["Product Drafts"])


@router.get("/my", response_model=list[ProductDraft])
def get_my_product_drafts(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    require_organization(current_user)
    drafts = (
        db.query(ProductDraftModel)
        .filter(
            ProductDraftModel.organization_id == current_user.organization_id,
            ProductDraftModel.created_by == current_user.id,
        )
        .order_by(ProductDraftModel.updated_at.desc())
        .all()
    )
    return [serialize_draft(draft) for draft in drafts]


@router.post("/", response_model=ProductDraft, status_code=status.HTTP_201_CREATED)
def create_product_draft(
    payload: ProductDraftCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    require_organization(current_user)
    if not draft_has_content(payload):
        raise HTTPException(status_code=400, detail="Черновик пустой")

    draft = ProductDraftModel(
        organization_id=current_user.organization_id,
        created_by=current_user.id,
    )
    apply_draft_payload(draft, payload)
    db.add(draft)
    db.commit()
    db.refresh(draft)
    log_audit(
        db,
        event_type="product_draft_created",
        category="products",
        summary=f"Черновик запчасти #{draft.id}",
        user=current_user,
        organization_id=current_user.organization_id,
        details={"draft_id": draft.id},
        entity_type="product_draft",
        entity_id=draft.id,
    )
    return serialize_draft(draft)


@router.get("/{draft_id}", response_model=ProductDraft)
def get_product_draft(
    draft_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    draft = get_owned_draft(db, draft_id, current_user)
    return serialize_draft(draft)


@router.patch("/{draft_id}", response_model=ProductDraft)
def update_product_draft(
    draft_id: int,
    payload: ProductDraftUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    draft = get_owned_draft(db, draft_id, current_user)
    apply_draft_payload(draft, payload)
    db.commit()
    db.refresh(draft)
    return serialize_draft(draft)


@router.delete("/{draft_id}")
def delete_product_draft(
    draft_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    draft = get_owned_draft(db, draft_id, current_user)
    cleanup_draft_temp_media(draft)
    db.delete(draft)
    db.commit()
    log_audit(
        db,
        event_type="product_draft_deleted",
        category="products",
        summary=f"Черновик запчасти #{draft_id} удалён",
        user=current_user,
        organization_id=current_user.organization_id,
        details={"draft_id": draft_id},
        entity_type="product_draft",
        entity_id=draft_id,
    )
    return {"message": "Черновик удалён"}


@router.post("/{draft_id}/submit")
def submit_product_draft(
    draft_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    from app.routers.pending_product_storage_cells import (
        PendingProductStorageCellCreate,
        create_pending_product_storage_cells_batch,
    )
    from app.routers.pending_products import create_pending_product

    draft = get_owned_draft(db, draft_id, current_user)
    pending_payload = build_pending_payload(draft)

    pending_product = create_pending_product(
        product_data=pending_payload,
        db=db,
        current_user=current_user,
    )

    storage_cells = parse_storage_cells(draft.storage_cells_json)
    if storage_cells:
        cells_payload = [
            PendingProductStorageCellCreate(
                pending_product_id=pending_product["id"],
                storage_cell_id=int(item["storage_cell_id"]),
                value=str(item.get("value") or ""),
            )
            for item in storage_cells
            if item.get("storage_cell_id") is not None and str(item.get("value") or "").strip()
        ]
        if cells_payload:
            create_pending_product_storage_cells_batch(
                cells_data=cells_payload,
                db=db,
                current_user=current_user,
            )

    draft_id_value = draft.id
    db.delete(draft)
    db.commit()

    log_audit(
        db,
        event_type="product_draft_submitted",
        category="products",
        summary=f"Черновик #{draft_id_value} отправлен на модерацию",
        user=current_user,
        organization_id=current_user.organization_id,
        details={"draft_id": draft_id_value, "pending_product_id": pending_product["id"]},
        entity_type="pending_product",
        entity_id=pending_product["id"],
    )

    return {
        "message": "Черновик отправлен на модерацию",
        "pending_product": pending_product,
    }
