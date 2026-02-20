from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session, selectinload, joinedload
from sqlalchemy import func, cast, Integer
from app.db.database import get_db
from app.core.auth import get_current_user, get_current_admin_user
from app.models.user import User
from app.models.orders import Order, NewPartsOrder, OrderStatus, OrderItem, OrderItemStatus, RosskoStatus
from app.models.product import Product
from app.models.carts import Cart, NewPartsCart, UsedPartsCart
from app.schemas.orders import OrderCreate, OrderResponse, OrderStatusResponse, OrderItemResponse, NewPartsOrderResponse
from app.schemas.storage_location import StorageLocation
from app.models.product_storage_cell import ProductStorageCell as ProductStorageCellModel
from app.schemas.storage_cell import ProductStorageCell as ProductStorageCellSchema
from datetime import datetime
import random
import string

router = APIRouter(prefix="/orders", tags=["Orders"])

def generate_order_number(db: Session):
    """Генерирует уникальный номер заказа в формате 9-значного числа с ведущими нулями"""
    # Находим максимальный номер заказа в базе данных
    # Предполагаем, что номера заказов могут быть представлены как числа
    max_order_number = db.query(func.max(cast(func.nullif(Order.order_number, ''), Integer))).scalar()
    if max_order_number is None:
        # Если нет существующих заказов, начать с 1
        next_number = 1
    else:
        # Иначе использовать следующий номер
        next_number = max_order_number + 1
    
    # Форматируем номер как 9-значное число с ведущими нулями
    return f"{next_number:09d}"

def order_to_response(order: Order, db_session=None) -> OrderResponse:
    """Конвертирует SQLAlchemy объект Order в Pydantic OrderResponse"""
    items_response = []
    for item in order.items:
        # Find product by brand and partnumber since there's no direct relationship in the model
        storage_location = None
        if db_session:
            # Query product by brand and partnumber (article in Product model)
            from sqlalchemy import and_
            product = db_session.query(Product).filter(
                and_(
                    Product.brand == item.brand,
                    Product.article == item.partnumber
                )
            ).first()
            
            if product and product.storage_location:
                storage_location = StorageLocation.from_orm(product.storage_location)
        
        # Fetch product storage cells if product_id exists
        product_storage_cells = []
        if item.product_id:
            storage_cells = db_session.query(ProductStorageCellModel).filter(
                ProductStorageCellModel.product_id == item.product_id
            ).all()
            
            # Convert to response format
            product_storage_cells = [
                {
                    "id": cell.id,
                    "product_id": cell.product_id,
                    "storage_cell_id": cell.storage_cell_id,
                    "value": cell.value
                }
                for cell in storage_cells
            ]
        
        items_response.append(OrderItemResponse(
            id=item.id,
            name=item.name,
            brand=item.brand,
            partnumber=item.partnumber,
            quantity=item.quantity,
            price=item.price,
            status=item.status,
            storage_location=storage_location,
            product_id=item.product_id,
            product_storage_cells=product_storage_cells
        ))

    new_parts_order_response = None
    if order.new_parts_order:
        # Проверяем, является ли new_parts_order списком или одиночным объектом
        if isinstance(order.new_parts_order, list):
            # Если список, берем первый элемент (должен быть только один)
            if order.new_parts_order:
                new_parts_order_obj = order.new_parts_order[0]
                new_parts_order_response = NewPartsOrderResponse(
                    id=new_parts_order_obj.id,
                    seller=new_parts_order_obj.seller,
                    deliver_in_parts=new_parts_order_obj.deliver_in_parts
                )
        else:
            # Если одиночный объект
            new_parts_order_response = NewPartsOrderResponse(
                id=order.new_parts_order.id,
                seller=order.new_parts_order.seller,
                deliver_in_parts=order.new_parts_order.deliver_in_parts
            )

    return OrderResponse(
        id=order.id,
        order_number=order.order_number,
        recipient_name=order.recipient_name,
        recipient_phone=order.recipient_phone,
        recipient_email=order.recipient_email,
        delivery_type=order.delivery_type,
        delivery_address=order.delivery_address,
        transport_company=order.transport_company,
        pickup_address=order.pickup_address,
        total_amount=order.total_amount,
        is_paid=order.is_paid,
        status=order.status,
        created_at=order.created_at,
        items=items_response,
        new_parts_order=new_parts_order_response
    )

def init_order_statuses(db: Session):
    """Инициализация статусов заказов"""
    statuses = [
        {"name": "В ожидании", "code": "pending"},
        {"name": "Подтверждён", "code": "confirmed"},
        {"name": "Не подтверждён", "code": "rejected"},
        {"name": "Сформирован", "code": "assembled"},
        {"name": "Передан в доставку", "code": "shipped"},
        {"name": "Получен", "code": "delivered"},
        {"name": "Закрыт", "code": "closed"}
    ]

    for status_data in statuses:
        existing = db.query(OrderStatus).filter(OrderStatus.code == status_data["code"]).first()
        if not existing:
            status = OrderStatus(name=status_data["name"], code=status_data["code"])
            db.add(status)

    db.commit()

def init_order_item_statuses(db: Session):
    """Инициализация статусов элементов заказа"""
    statuses = [
        {"name": "В ожидании", "code": "pending"},
        {"name": "Подтверждён", "code": "confirmed"},
        {"name": "Не подтверждён", "code": "rejected"},
        {"name": "Сформирован", "code": "assembled"},
        {"name": "Передан в доставку", "code": "shipped"},
        {"name": "Получен", "code": "delivered"},
        {"name": "Закрыт", "code": "closed"}
    ]

    for status_data in statuses:
        existing = db.query(OrderItemStatus).filter(OrderItemStatus.code == status_data["code"]).first()
        if not existing:
            status = OrderItemStatus(name=status_data["name"], code=status_data["code"])
            db.add(status)

    db.commit()

def init_rossko_statuses(db: Session):
    """Инициализация статусов Росско"""
    statuses = [
        {"code": 0, "name": "Ждёт подтверждения", "description": "Заказ ожидает подтверждения от поставщика"},
        {"code": 1, "name": "Комплектуется", "description": "Заказ комплектуется на складе"},
        {"code": 2, "name": "Отгружено", "description": "Заказ отгружен со склада"},
        {"code": 3, "name": "Готово к отгрузке", "description": "Заказ готов к отгрузке"},
        {"code": 5, "name": "Ожидаем поступление", "description": "Ожидаем поступление товара на склад"},
        {"code": 6, "name": "На складе филиала", "description": "Товар находится на складе филиала"},
        {"code": 7, "name": "Нет в наличии", "description": "Товар отсутствует в наличии"},
        {"code": 8, "name": "Отменён клиентом", "description": "Заказ отменён клиентом"},
        {"code": 9, "name": "Просрочен", "description": "Заказ просрочен"},
        {"code": 31, "name": "Ожидаем товар на складе", "description": "Ожидаем поступление товара на склад"},
        {"code": 32, "name": "Возврат на согласовании", "description": "Возврат товара находится на согласовании"},
        {"code": 33, "name": "Товар на экспертизе", "description": "Товар проходит экспертизу"},
        {"code": 34, "name": "Возврат отклонён", "description": "Возврат товара отклонён"},
        {"code": 35, "name": "Возврат частично отклонён", "description": "Возврат товара частично отклонён"},
        {"code": 36, "name": "Товар возвращён", "description": "Товар успешно возвращён"}
    ]

    for status_data in statuses:
        existing = db.query(RosskoStatus).filter(RosskoStatus.code == status_data["code"]).first()
        if not existing:
            status = RosskoStatus(
                code=status_data["code"],
                name=status_data["name"],
                description=status_data["description"]
            )
            db.add(status)

    db.commit()

@router.post("/", response_model=OrderResponse)
async def create_order(
    order_data: OrderCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Создание нового заказа"""
    try:
        # Получаем или создаем статус "В ожидании" для заказов
        pending_status = db.query(OrderStatus).filter(OrderStatus.code == "pending").first()
        if not pending_status:
            pending_status = OrderStatus(name="В ожидании", code="pending")
            db.add(pending_status)
            db.commit()
            db.refresh(pending_status)

        # Получаем или создаем статус "В ожидании" для элементов заказа
        pending_item_status = db.query(OrderItemStatus).filter(OrderItemStatus.code == "pending").first()
        if not pending_item_status:
            pending_item_status = OrderItemStatus(name="В ожидании", code="pending")
            db.add(pending_item_status)
            db.commit()
            db.refresh(pending_item_status)

        # Создаем заказ
        order = Order(
            order_number=generate_order_number(db),
            user_id=current_user.id,
            recipient_name=order_data.recipient_name,
            recipient_phone=order_data.recipient_phone,
            recipient_email=order_data.recipient_email,
            delivery_type=order_data.delivery_type,
            delivery_address=order_data.delivery_address,
            transport_company=order_data.transport_company,
            pickup_address=order_data.pickup_address,
            total_amount=order_data.total_amount,
            is_paid=False,  # Пока всегда не оплачено
            status_id=pending_status.id
        )

        db.add(order)
        # Делаем flush, чтобы получить order.id
        db.flush()

        # Создаем элементы заказа
        # Создаем элементы заказа только из переданных данных, без повторного добавления из корзины
        # так как все необходимые элементы уже содержатся в order_data.items
        added_product_ids = set()
        
        for item_data in order_data.items:
            # Ensure the name field contains only the product name, not brand + partnumber
            # Also make sure product_id is properly preserved
            order_item = OrderItem(
                order_id=order.id,
                name=item_data.name if item_data.name and item_data.name.strip() else f"{item_data.brand} {item_data.partnumber}",
                brand=item_data.brand,
                partnumber=item_data.partnumber,
                quantity=item_data.quantity,
                price=item_data.price,
                status_id=pending_item_status.id,
                product_id=item_data.product_id  # Сохраняем ID конкретной запчасти
            )
            db.add(order_item)
            if item_data.product_id:
                added_product_ids.add(item_data.product_id)

        # Создаем запись для новых запчастей
        new_parts_order = NewPartsOrder(
            order_id=order.id,
            seller=order_data.new_parts_order.seller,
            deliver_in_parts=order_data.new_parts_order.deliver_in_parts
        )
        db.add(new_parts_order)
        db.flush()

        # Удаляем товары из корзины пользователя после успешного создания заказа
        user_cart = db.query(Cart).filter(Cart.user_id == current_user.id).first()
        if user_cart:
            # Удаляем новые запчасти
            if order_data.cart_item_ids:
                db.query(NewPartsCart).filter(
                    NewPartsCart.cart_id == user_cart.id,
                    NewPartsCart.id.in_(order_data.cart_item_ids)
                ).delete(synchronize_session=False)

            # Удаляем б/у запчасти
            if order_data.used_cart_item_ids:
                db.query(UsedPartsCart).filter(
                    UsedPartsCart.cart_id == user_cart.id,
                    UsedPartsCart.id.in_(order_data.used_cart_item_ids)
                ).delete(synchronize_session=False)

        # Коммитим все изменения (заказ, элементы заказа, new_parts_order, удаление из корзины)
        db.commit()

        # Загружаем полный заказ с отношениями
        order_with_relations = db.query(Order).options(
            joinedload(Order.status),
            selectinload(Order.items).joinedload(OrderItem.status),
            joinedload(Order.new_parts_order)
        ).filter(Order.id == order.id).first()


        return order_to_response(order_with_relations, db)

    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=500,
            detail=f"Ошибка при создании заказа: {str(e)}"
        )

@router.get("/", response_model=list[OrderResponse])
async def get_orders(
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_admin_user)  # Только для админов
):
    """Получение списка всех заказов (только для админов)"""
    orders = db.query(Order).options(
        joinedload(Order.status),
        selectinload(Order.items).joinedload(OrderItem.status)
    ).offset(skip).limit(limit).all()

    return [order_to_response(order, db) for order in orders]

@router.get("/my", response_model=list[OrderResponse])
async def get_my_orders(
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Получение заказов текущего пользователя"""
    orders = db.query(Order).options(
        joinedload(Order.status),
        selectinload(Order.items).joinedload(OrderItem.status)
    ).filter(Order.user_id == current_user.id).offset(skip).limit(limit).all()

    return [order_to_response(order, db) for order in orders]


@router.get("/organization/my", response_model=list[OrderResponse])
async def get_organization_orders(
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Получение заказов организации текущего пользователя (для сотрудников и директоров)"""
    # Проверяем, что пользователь привязан к организации
    if not current_user.organization_id:
        return []

    # Получаем всех пользователей организации
    from app.models.user import User
    org_user_ids = db.query(User.id).filter(
        User.organization_id == current_user.organization_id
    ).all()
    org_user_ids = [user_id for (user_id,) in org_user_ids]

    # Получаем заказы всех пользователей организации
    orders = db.query(Order).options(
        joinedload(Order.status),
        selectinload(Order.items).joinedload(OrderItem.status)
    ).filter(Order.user_id.in_(org_user_ids)).offset(skip).limit(limit).all()

    return [order_to_response(order, db) for order in orders]

@router.get("/{order_id}", response_model=OrderResponse)
async def get_order(
    order_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Получение конкретного заказа"""
    order = db.query(Order).options(
        joinedload(Order.status),
        selectinload(Order.items).joinedload(OrderItem.status)
    ).filter(Order.id == order_id).first()
    if not order:
        raise HTTPException(status_code=404, detail="Заказ не найден")

    # Проверяем, что заказ принадлежит текущему пользователю или пользователь админ
    if order.user_id != current_user.id and not current_user.is_admin:
        raise HTTPException(status_code=403, detail="Недостаточно прав для просмотра заказа")

    return order_to_response(order, db)

@router.get("/statuses/", response_model=list[OrderStatusResponse])
async def get_order_statuses(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Получение списка всех статусов заказов"""
    statuses = db.query(OrderStatus).all()
    return statuses

@router.post("/init-statuses")
async def initialize_order_statuses(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_admin_user)  # Только для админов
):
    """Инициализация статусов заказов (только для админов)"""
    try:
        # Инициализируем статусы
        init_order_statuses(db)
        init_order_item_statuses(db)
        init_rossko_statuses(db)

        return {"message": "Все статусы заказов успешно инициализированы"}

    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Ошибка инициализации статусов: {str(e)}"
        )

@router.post("/init-rossko-statuses")
async def initialize_rossko_statuses(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_admin_user)  # Только для админов
):
    """Инициализация статусов Росско (только для админов)"""
    try:
        # Инициализируем статусы Росско
        init_rossko_statuses(db)

        return {"message": "Статусы Росско успешно инициализированы"}

    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Ошибка инициализации статусов Росско: {str(e)}"
        )

@router.put("/{order_id}/status")
async def update_order_status(
    order_id: int,
    status_data: dict,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_admin_user)  # Только для админов
):
    """Обновление статуса заказа (только для админов)"""
    try:
        # Находим заказ
        order = db.query(Order).filter(Order.id == order_id).first()
        if not order:
            raise HTTPException(status_code=404, detail="Заказ не найден")

        # Находим новый статус
        new_status = db.query(OrderStatus).filter(OrderStatus.code == status_data.get("status_code")).first()
        if not new_status:
            raise HTTPException(status_code=400, detail="Неверный код статуса")

        # Обновляем статус
        order.status_id = new_status.id
        db.commit()
        db.refresh(order)

        return {"message": "Статус заказа успешно обновлен", "new_status": new_status.name}

    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=500,
            detail=f"Ошибка обновления статуса заказа: {str(e)}"
        )

@router.put("/items/{item_id}/status")
async def update_order_item_status(
    item_id: int,
    status_data: dict,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_admin_user)  # Только для админов
):
    """Обновление статуса элемента заказа (только для админов)"""
    try:
        # Находим элемент заказа
        item = db.query(OrderItem).filter(OrderItem.id == item_id).first()
        if not item:
            raise HTTPException(status_code=404, detail="Элемент заказа не найден")

        # Находим новый статус
        new_status = db.query(OrderItemStatus).filter(OrderItemStatus.code == status_data.get("status_code")).first()
        if not new_status:
            raise HTTPException(status_code=400, detail="Неверный код статуса")

        # Обновляем статус
        item.status_id = new_status.id
        db.commit()
        db.refresh(item)

        return {"message": "Статус элемента заказа успешно обновлен", "new_status": new_status.name}

    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=500,
            detail=f"Ошибка обновления статуса элемента заказа: {str(e)}"
        )
