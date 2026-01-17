from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from app.db.database import get_db
from app.core.auth import get_current_user
from app.models.user import User
from app.models.carts import Cart, NewPartsCart, UsedPartsCart
from app.models.orders import Order, NewPartsOrder, OrderStatus, OrderItem, OrderItemStatus
from app.models.client import Client as ClientModel
from app.schemas.checkout import CheckoutFromCartRequest, OrderFromCartResponse
from app.routers.rossko_api.rossko_api import rossko_checkout
from app.routers.orders import generate_order_number, order_to_response, init_order_statuses, init_order_item_statuses
from app.utils.phone import normalize_to_storage_format

router = APIRouter(prefix="/checkout", tags=["Checkout"])


@router.post("/from-cart", response_model=OrderFromCartResponse)
async def checkout_from_cart(
    checkout_data: CheckoutFromCartRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Оформление заказа из корзины"""
    try:
        # Получить корзину пользователя
        cart = db.query(Cart).filter(Cart.user_id == current_user.id).first()
        if not cart:
            raise HTTPException(
                status_code=404,
                detail="Корзина не найдена"
            )

        # Получить товары из корзины
        cart_items = db.query(NewPartsCart).filter(NewPartsCart.cart_id == cart.id).all()

        if not cart_items:
            raise HTTPException(
                status_code=400,
                detail="Корзина пуста"
            )

        # Инициализировать статусы если они не существуют
        init_order_statuses(db)
        init_order_item_statuses(db)

        # Создать или получить клиента на основе контактной информации
        # Note: Contact schema doesn't include email, using phone as primary identifier
        client_email = None  # Contact schema doesn't have email field
        client_phone = normalize_to_storage_format(checkout_data.contact.phone)
        client_name_parts = checkout_data.contact.name.split()
        
        # Parse name (assuming format: Last First Patronymic or Last First)
        last_name = client_name_parts[0] if len(client_name_parts) > 0 else ""
        first_name = client_name_parts[1] if len(client_name_parts) > 1 else ""
        patronymic = client_name_parts[2] if len(client_name_parts) > 2 else None
        
        # Check if client already exists for this organization
        # Since we don't have email, check by phone only
        existing_client = None
        if client_phone:
            existing_client = db.query(ClientModel).filter(
                ClientModel.phone == client_phone,
                ClientModel.organization_id == current_user.organization_id
            ).first()
        
        # Create client if doesn't exist
        if not existing_client:
            # Try to find organization for the parts (for new parts, it's the user's org)
            # For used parts, we could check the product's organization, but for now use user's org
            organization_id = current_user.organization_id
            
            new_client = ClientModel(
                last_name=last_name,
                first_name=first_name,
                patronymic=patronymic,
                email="",  # No email available in contact data
                phone=client_phone,
                organization_id=organization_id
            )
            db.add(new_client)
            db.flush()  # Get the client ID
            
        # Получить статусы для заказа
        pending_status = db.query(OrderStatus).filter(OrderStatus.code == "pending").first()
        if not pending_status:
            pending_status = OrderStatus(name="В ожидании", code="pending")
            db.add(pending_status)
            db.commit()
            db.refresh(pending_status)

        pending_item_status = db.query(OrderItemStatus).filter(OrderItemStatus.code == "pending").first()
        if not pending_item_status:
            pending_item_status = OrderItemStatus(name="В ожидании", code="pending")
            db.add(pending_item_status)
            db.commit()
            db.refresh(pending_item_status)

        # Рассчитать общую сумму заказа
        total_amount = sum(float(item.price) * item.quantity for item in cart_items if item.price)

        # Создать локальный заказ
        local_order = Order(
            order_number=generate_order_number(),
            user_id=current_user.id,
            recipient_name=checkout_data.contact.name,
            recipient_phone=checkout_data.contact.phone,
            recipient_email=current_user.email or "",  # Используем email пользователя
            delivery_type="transport",  # По умолчанию транспортная компания
            delivery_address="",  # Можно добавить позже
            transport_company="",  # Можно добавить позже
            total_amount=total_amount,
            is_paid=False,
            status_id=pending_status.id
        )

        db.add(local_order)
        db.flush()  # Получить order.id

        # Создать элементы заказа
        for item in cart_items:
            order_item = OrderItem(
                order_id=local_order.id,
                name=f"{item.brand} {item.partnumber}",
                brand=item.brand,
                partnumber=item.partnumber,
                quantity=item.quantity,
                price=float(item.price) if item.price else 0,
                status_id=pending_item_status.id
            )
            db.add(order_item)

        # Создать запись для новых запчастей
        new_parts_order = NewPartsOrder(
            order_id=local_order.id,
            seller="Росско",  # По умолчанию Росско как продавец
            deliver_in_parts=checkout_data.delivery_parts
        )
        db.add(new_parts_order)

        # Подготовить данные для RossKo API
        parts = []
        for item in cart_items:
            parts.append({
                "partnumber": item.partnumber,
                "brand": item.brand,
                "stock": item.stock_id or "",  # Используем stock_id как stock
                "count": item.quantity,
                "comment": f"Заказ #{local_order.order_number}"
            })

        rossko_data = {
            "delivery": {
                "delivery_id": checkout_data.delivery.delivery_id,
                "address_id": checkout_data.delivery.address_id
            },
            "payment": {
                "payment_id": checkout_data.payment.payment_id,
                "requisite_id": checkout_data.payment.requisite_id
            },
            "contact": {
                "name": checkout_data.contact.name,
                "phone": checkout_data.contact.phone,
                "comment": checkout_data.contact.comment
            },
            "delivery_parts": checkout_data.delivery_parts,
            "parts": parts
        }

        # Отправить заказ в RossKo
        try:
            rossko_response = await rossko_checkout(rossko_data)
            rossko_order_id = rossko_response.get('order_id', 'unknown') if rossko_response else 'unknown'
        except Exception as rossko_error:
            # Если заказ в Росско не удался, все равно сохраняем локальный заказ
            rossko_order_id = 'failed'
            print(f"Ошибка при отправке заказа в Росско: {str(rossko_error)}")

        # Очистить корзину после успешного оформления заказа
        db.query(NewPartsCart).filter(NewPartsCart.cart_id == cart.id).delete()
        db.query(UsedPartsCart).filter(UsedPartsCart.cart_id == cart.id).delete()

        # Сохранить все изменения
        db.commit()

        # Получить полный заказ с отношениями для ответа
        order_with_relations = db.query(Order).filter(Order.id == local_order.id).first()

        return OrderFromCartResponse(
            order_id=local_order.id,
            rossko_order_ids=[str(rossko_order_id)],
            message="Заказ успешно оформлен"
        )

    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=500,
            detail=f"Ошибка при оформлении заказа: {str(e)}"
        )
