from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy.orm import joinedload, selectinload
from app.models.stock_in import StockIn as StockInModel
from app.schemas.stock_in import StockIn as StockInSchema, StockInCreate
from app.db.database import get_db
from app.core.auth import get_current_user
from app.models.user import User
from app.models.product import Product as ProductModel
from app.models.vehicle import Vehicle as VehicleModel
from app.services.audit_service import log_audit
from app.services.yandex_feed_sync_service import mark_yandex_feed_dirty
from app.utils.public_catalog_cache import invalidate_public_catalog_cache

router = APIRouter(prefix="/stock-ins", tags=["Stock In"])

@router.get("/", response_model=list[StockInSchema])
def get_stock_ins(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    if not current_user.organization_id:
        raise HTTPException(status_code=403, detail="Организация не указана")
    
    stock_ins = (
        db.query(StockInModel)
        .options(
            joinedload(StockInModel.product).options(
                selectinload(ProductModel.compatible_vehicles).options(
                    selectinload(VehicleModel.vin_row),
                    selectinload(VehicleModel.mileage_row),
                ),
            ),
            joinedload(StockInModel.storage_location),
            joinedload(StockInModel.creator),
        )
        .filter(StockInModel.organization_id == current_user.organization_id)
        .all()
    )
    return stock_ins


@router.post("/", response_model=StockInSchema)
def create_stock_in(
    stock_in: StockInCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    from app.utils.org_product_access import user_can_create_stock_in

    if not user_can_create_stock_in(db, current_user):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Нет права создавать поступления",
        )

    product = db.query(ProductModel).filter(
        ProductModel.id == stock_in.product_id,
        ProductModel.organization_id == current_user.organization_id
    ).first()
    if not product:
        raise HTTPException(status_code=400, detail="Продукт не найден или не принадлежит вашей организации")

    previous_quantity = int(product.quantity or 0)

    db_stock_in = StockInModel(
        **stock_in.dict(),
        organization_id=current_user.organization_id,
        created_by=current_user.id
    )
    db.add(db_stock_in)
    product.quantity = previous_quantity + int(stock_in.quantity or 0)
    db.commit()
    db.refresh(db_stock_in)
    db.refresh(product)
    log_audit(
        db,
        event_type="stock_in_created",
        category="warehouse",
        summary=f"Поступление: product #{db_stock_in.product_id}, {db_stock_in.quantity} шт.",
        user=current_user,
        organization_id=current_user.organization_id,
        details={
            "stock_in_id": db_stock_in.id,
            "product_id": db_stock_in.product_id,
            "quantity": db_stock_in.quantity,
        },
        entity_type="stock_in",
        entity_id=db_stock_in.id,
    )
    if product.is_new is False:
        mark_yandex_feed_dirty(db, "stock_in_created_used")
        invalidate_public_catalog_cache()
        from app.services.search_subscription_service import maybe_notify_search_subscribers

        if int(product.quantity or 0) > 0:
            maybe_notify_search_subscribers(product.id, previous_quantity=previous_quantity)
    return db_stock_in

@router.get("/{stock_in_id}", response_model=StockInSchema)
def read_stock_in(
    stock_in_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    stock_in = db.query(StockInModel).filter(
        StockInModel.id == stock_in_id,
        StockInModel.organization_id == current_user.organization_id
    ).first()
    if not stock_in:
        raise HTTPException(status_code=404, detail="Запись поступления не найдена")
    return stock_in

@router.put("/{stock_in_id}", response_model=StockInSchema)
def update_stock_in(
    stock_in_id: int,
    stock_in: StockInCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    db_stock_in = db.query(StockInModel).filter(
        StockInModel.id == stock_in_id,
        StockInModel.organization_id == current_user.organization_id
    ).first()
    if not db_stock_in:
        raise HTTPException(status_code=404, detail="Запись поступления не найдена")

    for key, value in stock_in.dict().items():
        setattr(db_stock_in, key, value)

    db.commit()
    db.refresh(db_stock_in)
    product = db.query(ProductModel).filter(ProductModel.id == db_stock_in.product_id).first()
    if product and product.is_new is False:
        mark_yandex_feed_dirty(db, "stock_in_updated_used")
        invalidate_public_catalog_cache()
    return db_stock_in

@router.delete("/{stock_in_id}", status_code=204)
def delete_stock_in(
    stock_in_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    db_stock_in = db.query(StockInModel).filter(
        StockInModel.id == stock_in_id,
        StockInModel.organization_id == current_user.organization_id
    ).first()
    if not db_stock_in:
        raise HTTPException(status_code=404, detail="Запись поступления не найдена")

    product = db.query(ProductModel).filter(ProductModel.id == db_stock_in.product_id).first()
    db.delete(db_stock_in)
    db.commit()
    if product and product.is_new is False:
        mark_yandex_feed_dirty(db, "stock_in_deleted_used")
        invalidate_public_catalog_cache()
    return