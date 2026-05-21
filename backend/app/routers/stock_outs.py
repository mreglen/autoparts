from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session, joinedload
from datetime import date
from app.core.auth import get_current_user
from app.models.product import Product
from app.models.stock_out import StockOut as StockOutModel
from app.models.user import User
from app.schemas.stock_out import StockOut as StockOutSchema, StockOutCreate, ReturnCreate
from app.db.database import get_db
from app.services.stock_out_sales import list_warehouse_sales
from app.services.stock_sale_fulfillment import (
    FulfillStockOutRequest,
    StockOutSourceKind,
    fulfill_stock_out,
)

router = APIRouter(prefix="/stock-outs", tags=["Stock Out"])

@router.post("/", response_model=StockOutSchema)
def create_stock_out(
    stock_out: StockOutCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)  # ← добавь аутентификацию!
):
    # Проверка доступа
    if not current_user.organization_id:
        raise HTTPException(status_code=403, detail="Организация не указана")

    sale_price = float(stock_out.sale_price or 0)
    is_sale = sale_price > 0
    result = fulfill_stock_out(
        db,
        FulfillStockOutRequest(
            organization_id=current_user.organization_id,
            product_id=stock_out.product_id,
            quantity=stock_out.quantity,
            storage_location_id=stock_out.storage_location_id,
            acquired_product_id=stock_out.acquired_product_id,
            user_id=stock_out.user_id,
            movement_date=stock_out.movement_date,
            sale_price=sale_price,
            reason=stock_out.reason,
            sale_channel=stock_out.sale_channel or ("warehouse" if is_sale else None),
            source_kind=StockOutSourceKind.WAREHOUSE_MANUAL if is_sale else StockOutSourceKind.WRITEOFF,
        ),
    )
    return result.stock_out

@router.get("/sales", response_model=list[StockOutSchema])
def get_warehouse_sales(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Фактические продажи: sale_price > 0, продажи Авито (в т.ч. с восстановленной ценой из заказа).
    """
    if not current_user.organization_id:
        raise HTTPException(status_code=403, detail="Организация не указана")

    return list_warehouse_sales(db, current_user.organization_id)

@router.get("/{stock_out_id}", response_model=StockOutSchema)
def read_stock_out(stock_out_id: int, db: Session = Depends(get_db)):
    stock_out = db.query(StockOutModel).filter(StockOutModel.id == stock_out_id).first()
    if not stock_out:
        raise HTTPException(status_code=404, detail="Stock out record not found")
    return stock_out

@router.put("/{stock_out_id}", response_model=StockOutSchema)
def update_stock_out(stock_out_id: int, stock_out: StockOutCreate, db: Session = Depends(get_db)):
    db_stock_out = db.query(StockOutModel).filter(StockOutModel.id == stock_out_id).first()
    if not db_stock_out:
        raise HTTPException(status_code=404, detail="Stock out record not found")

    for key, value in stock_out.dict().items():
        setattr(db_stock_out, key, value)

    db.commit()
    db.refresh(db_stock_out)
    return db_stock_out

@router.delete("/{stock_out_id}", status_code=204)
def delete_stock_out(stock_out_id: int, db: Session = Depends(get_db)):
    db_stock_out = db.query(StockOutModel).filter(StockOutModel.id == stock_out_id).first()
    if not db_stock_out:
        raise HTTPException(status_code=404, detail="Stock out record not found")

    db.delete(db_stock_out)
    db.commit()
    return

@router.get("/", response_model=list[StockOutSchema])
def get_stocks_outs(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    if not current_user.organization_id:
        raise HTTPException(status_code=403, detail="Организация не указана")
    
    stock_outs = (
        db.query(StockOutModel)
        .options(
            joinedload(StockOutModel.product),
            joinedload(StockOutModel.storage_location),
            joinedload(StockOutModel.user)
        )
        .filter(StockOutModel.organization_id == current_user.organization_id)
        .all()
    )
    return stock_outs


@router.post("/returns", status_code=200)
def create_return(
    return_data: ReturnCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Возврат запчастей: уменьшает количество в существующей записи расхода или удаляет запись полностью
    Создает новую запись в поступлениях (stock_in) для возвращенных запчастей
    """
    if not current_user.organization_id:
        raise HTTPException(status_code=403, detail="Организация не указана")

    processed_returns = []
    created_stock_ins = []

    for item in return_data.items:
        # Находим запись расхода
        stock_out = db.query(StockOutModel).filter(
            StockOutModel.id == item.stockOutId,
            StockOutModel.organization_id == current_user.organization_id
        ).first()

        if not stock_out:
            raise HTTPException(status_code=404, detail=f"Запись расхода {item.stockOutId} не найдена")

        # Проверяем, что количество возврата не превышает списанное
        if item.quantity > stock_out.quantity:
            raise HTTPException(
                status_code=400,
                detail=f"Невозможно вернуть {item.quantity} шт. для записи {item.stockOutId}, доступно {stock_out.quantity} шт."
            )

        # Находим продукт
        product = db.query(Product).filter(
            Product.id == item.productId,
            Product.organization_id == current_user.organization_id
        ).first()

        if not product:
            raise HTTPException(status_code=404, detail=f"Продукт {item.productId} не найден")

        # Возвращаем количество в продукт
        product.quantity += item.quantity

        # Создаем новую запись в поступлениях (stock_in)
        from app.models.stock_in import StockIn as StockInModel
        
        new_stock_in = StockInModel(
            quantity=item.quantity,
            sale_price=item.returnPrice,
            organization_id=current_user.organization_id,
            storage_location_id=stock_out.storage_location_id,
            product_id=item.productId,
            acquired_product_id=stock_out.acquired_product_id,
            created_by=current_user.id
        )
        db.add(new_stock_in)
        created_stock_ins.append(new_stock_in)

        # Обновляем оригинальную запись stock_out (уменьшаем количество)
        stock_out.quantity -= item.quantity

        # Если количество стало 0 или меньше, удаляем запись stock_out
        if stock_out.quantity <= 0:
            db.delete(stock_out)

        processed_returns.append({
            "stock_out_id": item.stockOutId,
            "product_id": item.productId,
            "returned_quantity": item.quantity,
            "return_price": item.returnPrice
        })

    db.commit()

    # Refresh для получения ID новых записей
    for stock_in in created_stock_ins:
        db.refresh(stock_in)

    return {
        "message": f"Успешно возвращено {len(processed_returns)} позиций",
        "returns": processed_returns,
        "created_stock_ins": [
            {
                "id": stock_in.id,
                "quantity": stock_in.quantity,
                "sale_price": float(stock_in.sale_price),
                "product_id": stock_in.product_id,
                "storage_location_id": stock_in.storage_location_id
            }
            for stock_in in created_stock_ins
        ]
    }