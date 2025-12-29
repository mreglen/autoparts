from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session, joinedload
from app.core.auth import get_current_user
from app.models.product import Product
from app.models.stock_out import StockOut as StockOutModel
from app.models.user import User
from app.schemas.stock_out import StockOut as StockOutSchema, StockOutCreate
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