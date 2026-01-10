from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session, joinedload
from datetime import date
from app.core.auth import get_current_user
from app.models.product import Product
from app.models.stock_out import StockOut as StockOutModel
from app.models.user import User
from app.schemas.stock_out import StockOut as StockOutSchema, StockOutCreate, ReturnCreate
from app.db.database import get_db

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

    # Проверка, что продукт принадлежит организации
    product = db.query(Product).filter(
        Product.id == stock_out.product_id,
        Product.organization_id == current_user.organization_id
    ).first()
    if not product:
        raise HTTPException(status_code=400, detail="Продукт не найден или недоступен")

    # Проверка остатка
    if product.quantity < stock_out.quantity:
        raise HTTPException(status_code=400, detail="Недостаточно товара на складе")

    # Уменьшаем количество
    product.quantity -= stock_out.quantity

    # Создаём запись расхода
    db_stock_out = StockOutModel(**stock_out.dict())
    db.add(db_stock_out)
    db.commit()
    db.refresh(db_stock_out)
    return db_stock_out

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
    """
    if not current_user.organization_id:
        raise HTTPException(status_code=403, detail="Организация не указана")

    processed_returns = []

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

    return {
        "message": f"Успешно возвращено {len(processed_returns)} позиций",
        "returns": processed_returns
    }