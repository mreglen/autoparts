from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.auth import get_current_user
from app.db.database import get_db
from app.models.product_draft import ProductDraft as ProductDraftModel
from app.models.user import User
from app.schemas.product_draft import ProductDraft, ProductDraftCreate, ProductDraftSubmitRequest, ProductDraftUpdate
from app.services.audit_service import log_audit
from app.services.pending_product_storage_cell_service import attach_storage_cells_to_pending_product
from app.services.product_draft_service import (
    apply_draft_payload,
    build_pending_payload,
    cleanup_draft_temp_media,
    draft_has_content,
    dump_storage_cells,
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
    payload: ProductDraftSubmitRequest | None = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    from app.routers.pending_products import create_pending_product

    draft = get_owned_draft(db, draft_id, current_user)

    if payload and payload.storage_cells is not None:
        storage_cells = [
            {"storage_cell_id": item.storage_cell_id, "value": item.value}
            for item in payload.storage_cells
        ]
        draft.storage_cells_json = dump_storage_cells(storage_cells)
        db.commit()
        db.refresh(draft)
    else:
        storage_cells = parse_storage_cells(draft.storage_cells_json)

    pending_payload = build_pending_payload(draft)

    pending_product = create_pending_product(
        product_data=pending_payload,
        db=db,
        current_user=current_user,
    )

    if storage_cells:
        attach_storage_cells_to_pending_product(
            db,
            pending_product_id=int(pending_product["id"]),
            organization_id=current_user.organization_id,
            storage_cells=storage_cells,
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
