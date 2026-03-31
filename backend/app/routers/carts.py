from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, Request, Response
from sqlalchemy.orm import Session, selectinload

from app.core.auth import get_current_user_optional
from app.db.database import get_db
from app.models.carts import Cart, NewPartsCart, UsedPartsCart, GuestNewPartsCart, GuestUsedPartsCart
from app.models.client import Client as ClientModel
from app.models.organization import Organization
from app.models.product import Product
from app.models.user import User
from app.schemas.carts import NewPartsCartItem, UsedPartsCartItem, CartItemResponse, CartResponse, UpdateQuantityRequest
from app.utils.guest_cart import get_or_create_guest_cart, get_guest_cart_by_token, get_guest_token_from_request, touch_guest_cart, get_or_create_user_cart
from app.utils.phone import normalize_to_storage_format

router = APIRouter(prefix="/cart", tags=["Cart"])

@router.post("/new-parts", response_model=CartItemResponse)
async def add_new_parts_to_cart(
    item: NewPartsCartItem,
    request: Request,
    response: Response,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user_optional)
):
    """Добавить новые запчасти в корзину пользователя или гостя."""
    if not item.brand or not item.brand.strip():
        raise HTTPException(status_code=422, detail="Brand is required and cannot be empty")
    if not item.partnumber or not item.partnumber.strip():
        raise HTTPException(status_code=422, detail="Part number is required and cannot be empty")
    if not item.stock_id or not item.stock_id.strip():
        raise HTTPException(status_code=422, detail="Stock ID is required and cannot be empty")
    if item.price is None or item.price <= 0:
        raise HTTPException(status_code=422, detail="Price is required and must be greater than 0")
    if item.quantity <= 0:
        raise HTTPException(status_code=422, detail="Quantity must be greater than 0")

    delivery_str = None
    if item.delivery is not None:
        if isinstance(item.delivery, dict):
            delivery_str = str(item.delivery) if str(item.delivery) != '{}' else None
        elif hasattr(item.delivery, '__dict__'):
            delivery_str = str(item.delivery)
        else:
            delivery_str = str(item.delivery) if item.delivery else None

    if current_user:
        cart = get_or_create_user_cart(db, current_user.id)
        client_phone = normalize_to_storage_format(current_user.phone) if current_user.phone else ""
        admin_user = db.query(User).filter(User.is_admin == True).first()
        admin_organization_id = admin_user.organization_id if admin_user else current_user.organization_id

        existing_client = db.query(ClientModel).filter(
            ClientModel.phone == client_phone,
            ClientModel.organization_id == admin_organization_id
        ).first()
        if not existing_client and client_phone:
            db.add(ClientModel(
                last_name=current_user.last_name or "",
                first_name=current_user.first_name or "",
                patronymic=current_user.patronymic,
                email=current_user.email or "",
                phone=client_phone,
                organization_id=admin_organization_id
            ))
            db.flush()

        existing_item = db.query(NewPartsCart).filter(
            NewPartsCart.cart_id == cart.id,
            NewPartsCart.stock_id == item.stock_id,
            NewPartsCart.brand == item.brand,
            NewPartsCart.partnumber == item.partnumber
        ).first()
        if existing_item:
            existing_item.quantity += item.quantity
            if delivery_str is not None:
                existing_item.delivery = delivery_str
            existing_item.updated_at = datetime.utcnow()
            db.commit()
            db.refresh(existing_item)
            return CartItemResponse(
                id=existing_item.id, brand=existing_item.brand, partnumber=existing_item.partnumber,
                name=existing_item.name, delivery=existing_item.delivery, quantity=existing_item.quantity,
                price=existing_item.price, stock_id=existing_item.stock_id, seller=existing_item.seller,
                created_at=existing_item.created_at
            )

        cart_item = NewPartsCart(
            cart_id=cart.id, user_id=current_user.id, brand=item.brand, partnumber=item.partnumber, name=item.name,
            delivery=delivery_str, quantity=item.quantity, price=item.price, stock_id=item.stock_id, guid=item.guid,
            delivery_start=item.delivery_start, delivery_end=item.delivery_end
        )
    else:
        guest_cart = get_or_create_guest_cart(db, request, response)
        existing_item = db.query(GuestNewPartsCart).filter(
            GuestNewPartsCart.guest_cart_id == guest_cart.id,
            GuestNewPartsCart.stock_id == item.stock_id,
            GuestNewPartsCart.brand == item.brand,
            GuestNewPartsCart.partnumber == item.partnumber
        ).first()
        if existing_item:
            existing_item.quantity += item.quantity
            if delivery_str is not None:
                existing_item.delivery = delivery_str
            existing_item.updated_at = datetime.utcnow()
            db.commit()
            touch_guest_cart(db, guest_cart)
            db.refresh(existing_item)
            return CartItemResponse(
                id=existing_item.id, brand=existing_item.brand, partnumber=existing_item.partnumber,
                name=existing_item.name, delivery=existing_item.delivery, quantity=existing_item.quantity,
                price=existing_item.price, stock_id=existing_item.stock_id, seller=existing_item.seller,
                created_at=existing_item.created_at
            )

        cart_item = GuestNewPartsCart(
            guest_cart_id=guest_cart.id, brand=item.brand, partnumber=item.partnumber, name=item.name, delivery=delivery_str,
            quantity=item.quantity, price=item.price, stock_id=item.stock_id, guid=item.guid,
            delivery_start=item.delivery_start, delivery_end=item.delivery_end
        )

    db.add(cart_item)
    db.commit()
    db.refresh(cart_item)
    if not current_user:
        touch_guest_cart(db, guest_cart)

    return CartItemResponse(
        id=cart_item.id, brand=cart_item.brand, partnumber=cart_item.partnumber, name=cart_item.name,
        delivery=cart_item.delivery, quantity=cart_item.quantity, price=cart_item.price, stock_id=cart_item.stock_id,
        seller=cart_item.seller, created_at=cart_item.created_at
    )

@router.post("/used-parts", response_model=CartItemResponse)
def add_used_parts_to_cart(
    item: UsedPartsCartItem,
    request: Request,
    response: Response,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user_optional)
):
    """Добавить б/у запчасти в корзину пользователя или гостя."""

    # Найти продукт
    product = db.query(Product).filter(Product.id == item.product_id).first()
    if not product:
        raise HTTPException(status_code=404, detail="Товар не найден")
    
    if current_user:
        cart = get_or_create_user_cart(db, current_user.id)
        client_phone = normalize_to_storage_format(current_user.phone) if current_user.phone else ""
        existing_client = db.query(ClientModel).filter(
            ClientModel.phone == client_phone,
            ClientModel.organization_id == product.organization_id
        ).first()
        if not existing_client and client_phone:
            db.add(ClientModel(
                last_name=current_user.last_name or "",
                first_name=current_user.first_name or "",
                patronymic=current_user.patronymic,
                email=current_user.email or "",
                phone=client_phone,
                organization_id=product.organization_id
            ))
            db.flush()

        existing_item = db.query(UsedPartsCart).filter(
            UsedPartsCart.cart_id == cart.id,
            UsedPartsCart.product_id == item.product_id
        ).first()
        if existing_item:
            existing_item.quantity += item.quantity
            existing_item.updated_at = datetime.utcnow()
            db.commit()
            db.refresh(existing_item)
            return CartItemResponse(
                id=existing_item.id, brand=product.brand, partnumber=product.article, name=product.name,
                quantity=existing_item.quantity, price=float(product.price) if product.price else 0,
                product_id=product.id, seller=existing_item.seller, created_at=existing_item.created_at
            )

        cart_item = UsedPartsCart(
            cart_id=cart.id, user_id=current_user.id, product_id=product.id, quantity=item.quantity,
            brand=product.brand, partnumber=product.article, price=product.price
        )
    else:
        guest_cart = get_or_create_guest_cart(db, request, response)
        existing_item = db.query(GuestUsedPartsCart).filter(
            GuestUsedPartsCart.guest_cart_id == guest_cart.id,
            GuestUsedPartsCart.product_id == item.product_id
        ).first()
        if existing_item:
            existing_item.quantity += item.quantity
            existing_item.updated_at = datetime.utcnow()
            db.commit()
            touch_guest_cart(db, guest_cart)
            db.refresh(existing_item)
            return CartItemResponse(
                id=existing_item.id, brand=product.brand, partnumber=product.article, name=product.name,
                quantity=existing_item.quantity, price=float(product.price) if product.price else 0,
                product_id=product.id, seller=existing_item.seller, created_at=existing_item.created_at
            )
        cart_item = GuestUsedPartsCart(
            guest_cart_id=guest_cart.id, product_id=product.id, quantity=item.quantity,
            brand=product.brand, partnumber=product.article, price=product.price
        )

    db.add(cart_item)
    db.commit()
    db.refresh(cart_item)
    if not current_user:
        touch_guest_cart(db, guest_cart)
    return CartItemResponse(
        id=cart_item.id, brand=product.brand, partnumber=product.article, name=product.name,
        quantity=cart_item.quantity, price=float(product.price) if product.price else 0,
        product_id=product.id, seller=cart_item.seller, created_at=cart_item.created_at
    )

@router.get("/admin-org-address")
def get_admin_org_address(db: Session = Depends(get_db)):
    """Получить адрес организации админа для самовывоза"""
    admin = db.query(User).filter(User.is_admin == True).first()
    if not admin or not admin.organization_id:
        raise HTTPException(status_code=404, detail="Администратор или его организация не найдены")

    admin_organization = db.query(Organization).filter(Organization.id == admin.organization_id).first()
    if not admin_organization or not admin_organization.address:
        raise HTTPException(status_code=404, detail="Адрес организации админа не найден")

    return {"address": admin_organization.address}

@router.get("/", response_model=CartResponse)
def get_cart(
    request: Request,
    response: Response,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user_optional)
):
    """Получить содержимое корзины пользователя или гостя."""
    if current_user:
        cart = db.query(Cart).options(
            selectinload(Cart.new_parts_items),
            selectinload(Cart.used_parts_items).selectinload(UsedPartsCart.product).selectinload(Product.organization)
        ).filter(Cart.user_id == current_user.id).first()
        if not cart:
            return CartResponse(id=0, user_id=current_user.id, new_parts_items=[], used_parts_items=[])
        return CartResponse(
            id=cart.id,
            user_id=cart.user_id,
            new_parts_items=[
                CartItemResponse(
                    id=i.id, brand=i.brand, partnumber=i.partnumber, name=i.name, delivery=i.delivery, quantity=i.quantity,
                    price=i.price, stock_id=i.stock_id, seller=i.seller, created_at=i.created_at
                ) for i in cart.new_parts_items
            ],
            used_parts_items=[
                CartItemResponse(
                    id=i.id, brand=i.product.brand if i.product else i.brand,
                    partnumber=i.product.article if i.product else i.partnumber,
                    name=i.product.name if i.product else "Б/У запчасть", quantity=i.quantity,
                    price=float(i.product.price) if i.product and i.product.price else (float(i.price) if i.price else 0),
                    product_id=i.product_id, seller=i.seller, created_at=i.created_at
                ) for i in cart.used_parts_items
            ]
        )

    guest_token = get_guest_token_from_request(request)
    guest_cart = get_guest_cart_by_token(db, guest_token) if guest_token else None
    if not guest_cart:
        guest_cart = get_or_create_guest_cart(db, request, response)
    return CartResponse(
        id=guest_cart.id,
        user_id=None,
        new_parts_items=[
            CartItemResponse(
                id=i.id, brand=i.brand, partnumber=i.partnumber, name=i.name, delivery=i.delivery, quantity=i.quantity,
                price=i.price, stock_id=i.stock_id, seller=i.seller, created_at=i.created_at
            ) for i in guest_cart.new_parts_items
        ],
        used_parts_items=[
            CartItemResponse(
                id=i.id, brand=i.product.brand if i.product else i.brand,
                partnumber=i.product.article if i.product else i.partnumber,
                name=i.product.name if i.product else "Б/У запчасть", quantity=i.quantity,
                price=float(i.product.price) if i.product and i.product.price else (float(i.price) if i.price else 0),
                product_id=i.product_id, seller=i.seller, created_at=i.created_at
            ) for i in guest_cart.used_parts_items
        ]
    )

@router.delete("/new-parts/{item_id}", status_code=204)
def remove_new_parts_from_cart(
    item_id: int,
    request: Request,
    response: Response,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user_optional)
):
    """Удалить новые запчасти из корзины пользователя или гостя."""
    if current_user:
        cart_item = db.query(NewPartsCart).filter(
            NewPartsCart.id == item_id,
            NewPartsCart.user_id == current_user.id
        ).first()
    else:
        guest_cart = get_or_create_guest_cart(db, request, response)
        cart_item = db.query(GuestNewPartsCart).filter(
            GuestNewPartsCart.id == item_id,
            GuestNewPartsCart.guest_cart_id == guest_cart.id
        ).first()

    if not cart_item:
        raise HTTPException(
            status_code=404,
            detail="Товар не найден в корзине"
        )

    db.delete(cart_item)
    db.commit()
    if not current_user:
        touch_guest_cart(db, guest_cart)
    return

@router.put("/new-parts/{item_id}/quantity", response_model=CartItemResponse)
def update_new_parts_quantity(
    item_id: int,
    quantity_data: UpdateQuantityRequest,
    request: Request,
    response: Response,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user_optional)
):
    """Обновить количество новых запчастей в корзине пользователя или гостя."""
    if quantity_data.quantity <= 0:
        raise HTTPException(
            status_code=400,
            detail="Количество должно быть больше 0"
        )

    if current_user:
        cart_item = db.query(NewPartsCart).filter(
            NewPartsCart.id == item_id,
            NewPartsCart.user_id == current_user.id
        ).first()
    else:
        guest_cart = get_or_create_guest_cart(db, request, response)
        cart_item = db.query(GuestNewPartsCart).filter(
            GuestNewPartsCart.id == item_id,
            GuestNewPartsCart.guest_cart_id == guest_cart.id
        ).first()

    if not cart_item:
        raise HTTPException(
            status_code=404,
            detail="Товар не найден в корзине"
        )

    cart_item.quantity = quantity_data.quantity
    cart_item.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(cart_item)
    if not current_user:
        touch_guest_cart(db, guest_cart)

    return CartItemResponse(
        id=cart_item.id, brand=cart_item.brand, partnumber=cart_item.partnumber, name=cart_item.name,
        delivery=cart_item.delivery, quantity=cart_item.quantity, price=cart_item.price, stock_id=cart_item.stock_id,
        seller=cart_item.seller, created_at=cart_item.created_at
    )

@router.delete("/used-parts/{item_id}", status_code=204)
def remove_used_parts_from_cart(
    item_id: int,
    request: Request,
    response: Response,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user_optional)
):
    """Удалить б/у запчасти из корзины пользователя или гостя."""
    if current_user:
        cart_item = db.query(UsedPartsCart).filter(
            UsedPartsCart.id == item_id,
            UsedPartsCart.user_id == current_user.id
        ).first()
    else:
        guest_cart = get_or_create_guest_cart(db, request, response)
        cart_item = db.query(GuestUsedPartsCart).filter(
            GuestUsedPartsCart.id == item_id,
            GuestUsedPartsCart.guest_cart_id == guest_cart.id
        ).first()

    if not cart_item:
        raise HTTPException(status_code=404, detail="Товар не найден в корзине")

    db.delete(cart_item)
    db.commit()
    if not current_user:
        touch_guest_cart(db, guest_cart)
    return

@router.put("/used-parts/{item_id}/quantity", response_model=CartItemResponse)
def update_used_parts_quantity(
    item_id: int,
    quantity_data: UpdateQuantityRequest,
    request: Request,
    response: Response,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user_optional)
):
    """Обновить количество б/у запчастей в корзине пользователя или гостя."""
    if quantity_data.quantity <= 0:
        raise HTTPException(status_code=400, detail="Количество должно быть больше 0")

    if current_user:
        cart_item = db.query(UsedPartsCart).filter(
            UsedPartsCart.id == item_id,
            UsedPartsCart.user_id == current_user.id
        ).first()
    else:
        guest_cart = get_or_create_guest_cart(db, request, response)
        cart_item = db.query(GuestUsedPartsCart).filter(
            GuestUsedPartsCart.id == item_id,
            GuestUsedPartsCart.guest_cart_id == guest_cart.id
        ).first()

    if not cart_item:
        raise HTTPException(status_code=404, detail="Товар не найден в корзине")

    product = db.query(Product).filter(Product.id == cart_item.product_id).first() if cart_item.product_id else None

    cart_item.quantity = quantity_data.quantity
    cart_item.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(cart_item)
    if not current_user:
        touch_guest_cart(db, guest_cart)

    return CartItemResponse(
        id=cart_item.id, brand=product.brand if product else cart_item.brand,
        partnumber=product.article if product else cart_item.partnumber,
        name=product.name if product else "Б/У запчасть", quantity=cart_item.quantity,
        price=float(product.price) if product and product.price else (float(cart_item.price) if cart_item.price else 0),
        product_id=cart_item.product_id, seller=cart_item.seller, created_at=cart_item.created_at
    )
