from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, Request, Response
from sqlalchemy.orm import Session, selectinload

from app.core.auth import get_current_user_optional
from app.db.database import get_db
from app.models.carts import (
    Cart,
    GuestNewPartsBasket,
    GuestNewPartsCart,
    GuestUsedPartsCart,
    NewPartsBasket,
    NewPartsCart,
    UsedPartsCart,
)
from app.models.client import Client as ClientModel
from app.models.organization import Organization
from app.models.product import Product
from app.models.user import User
from app.schemas.carts import (
    CartItemResponse,
    CartResponse,
    CreateBasketRequest,
    NewPartsBasketResponse,
    NewPartsCartItem,
    RenameBasketRequest,
    UpdateQuantityRequest,
    UsedPartsCartItem,
)
from app.utils.cart_baskets import (
    create_guest_basket,
    create_user_basket,
    get_or_create_default_guest_basket,
    get_or_create_default_user_basket,
    list_guest_baskets,
    list_user_baskets,
    rename_guest_basket,
    rename_user_basket,
    delete_guest_basket,
    delete_user_basket,
    maybe_delete_empty_non_default_guest_basket,
    maybe_delete_empty_non_default_user_basket,
    resolve_guest_basket,
    resolve_user_basket,
)
from app.utils.guest_cart import (
    get_or_create_guest_cart,
    get_guest_token_from_request,
    load_guest_cart_with_items,
    touch_guest_cart,
    get_or_create_user_cart,
)
from app.utils.phone import normalize_to_storage_format
from app.utils.product_price import display_product_price

router = APIRouter(prefix="/cart", tags=["Cart"])


def _normalize_max_quantity(value: int | None) -> int | None:
    if value is None:
        return None
    try:
        parsed = int(value)
    except (TypeError, ValueError):
        return None
    return parsed if parsed > 0 else None


def _merge_new_parts_max(existing_max: int | None, incoming_max: int | None) -> int | None:
    if incoming_max is None:
        return existing_max
    if existing_max is None:
        return incoming_max
    return max(existing_max, incoming_max)


def _cap_to_max(quantity: int, max_qty: int | None) -> int:
    if max_qty is None or max_qty < 1:
        return quantity
    return min(quantity, max_qty)


def _product_max_quantity(product: Product | None) -> int:
    if not product:
        return 1
    qty = int(product.quantity or 0) - int(getattr(product, "reserved_qty", 0) or 0)
    if qty < 1:
        return 0
    return qty


def _new_parts_cart_item_response(cart_item) -> CartItemResponse:
    return CartItemResponse(
        id=cart_item.id,
        brand=cart_item.brand,
        partnumber=cart_item.partnumber,
        name=cart_item.name,
        delivery=cart_item.delivery,
        delivery_start=getattr(cart_item, "delivery_start", None),
        delivery_end=getattr(cart_item, "delivery_end", None),
        quantity=cart_item.quantity,
        max_quantity=cart_item.max_quantity,
        price=float(cart_item.price) if cart_item.price is not None else None,
        purchase_price=float(cart_item.purchase_price)
        if getattr(cart_item, "purchase_price", None) is not None
        else None,
        stock_id=cart_item.stock_id,
        seller=cart_item.seller,
        created_at=cart_item.created_at,
        basket_id=getattr(cart_item, "basket_id", None),
    )


def _build_new_parts_basket_response(basket, items) -> NewPartsBasketResponse:
    mapped_items = [_new_parts_cart_item_response(item) for item in items]
    item_count = sum(item.quantity for item in mapped_items)
    total_price = sum((item.price or 0) * item.quantity for item in mapped_items)
    return NewPartsBasketResponse(
        id=basket.id,
        name=basket.name,
        is_default=bool(basket.is_default),
        items=mapped_items,
        item_count=item_count,
        total_price=float(total_price),
    )


def _build_user_cart_response(cart, db: Session) -> CartResponse:
    baskets = list_user_baskets(db, cart.id, cart.user_id)
    items_by_basket: dict[int, list[NewPartsCart]] = {b.id: [] for b in baskets}
    for item in cart.new_parts_items:
        if item.basket_id and item.basket_id in items_by_basket:
            items_by_basket[item.basket_id].append(item)
        else:
            default_basket = next((b for b in baskets if b.is_default), baskets[0] if baskets else None)
            if default_basket:
                items_by_basket.setdefault(default_basket.id, []).append(item)

    basket_views = [
        _build_new_parts_basket_response(basket, items_by_basket.get(basket.id, []))
        for basket in baskets
    ]
    all_new_items = [_new_parts_cart_item_response(i) for i in cart.new_parts_items]
    return CartResponse(
        id=cart.id,
        user_id=cart.user_id,
        new_parts_baskets=basket_views,
        new_parts_items=all_new_items,
        used_parts_items=[
            _used_parts_cart_item_response(i, i.product, db) for i in cart.used_parts_items
        ],
    )


def _build_guest_cart_response(guest_cart, db: Session) -> CartResponse:
    baskets = list_guest_baskets(db, guest_cart.id)
    items_by_basket: dict[int, list[GuestNewPartsCart]] = {b.id: [] for b in baskets}
    for item in guest_cart.new_parts_items:
        if item.basket_id and item.basket_id in items_by_basket:
            items_by_basket[item.basket_id].append(item)
        else:
            default_basket = next((b for b in baskets if b.is_default), baskets[0] if baskets else None)
            if default_basket:
                items_by_basket.setdefault(default_basket.id, []).append(item)

    basket_views = [
        _build_new_parts_basket_response(basket, items_by_basket.get(basket.id, []))
        for basket in baskets
    ]
    all_new_items = [_new_parts_cart_item_response(i) for i in guest_cart.new_parts_items]
    return CartResponse(
        id=guest_cart.id,
        user_id=None,
        new_parts_baskets=basket_views,
        new_parts_items=all_new_items,
        used_parts_items=[
            _used_parts_cart_item_response(i, i.product, db) for i in guest_cart.used_parts_items
        ],
    )


def _used_parts_cart_item_response(cart_item, product: Product | None, db: Session) -> CartItemResponse:
    max_qty = _product_max_quantity(product)
    raw_price = float(product.price) if product and product.price else (float(cart_item.price) if cart_item.price else 0)
    return CartItemResponse(
        id=cart_item.id,
        brand=product.brand if product else cart_item.brand,
        partnumber=product.article if product else cart_item.partnumber,
        name=product.name if product else "Б/У запчасть",
        quantity=cart_item.quantity,
        max_quantity=max_qty,
        price=display_product_price(raw_price, db=db) or 0,
        product_id=cart_item.product_id,
        seller=cart_item.seller,
        created_at=cart_item.created_at,
    )


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

    incoming_max = _normalize_max_quantity(item.max_quantity)

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

        basket = resolve_user_basket(db, cart.id, current_user.id, item.basket_id)

        existing_item = db.query(NewPartsCart).filter(
            NewPartsCart.cart_id == cart.id,
            NewPartsCart.basket_id == basket.id,
            NewPartsCart.stock_id == item.stock_id,
            NewPartsCart.brand == item.brand,
            NewPartsCart.partnumber == item.partnumber
        ).first()
        if existing_item:
            merged_max = _merge_new_parts_max(existing_item.max_quantity, incoming_max)
            existing_item.max_quantity = merged_max
            existing_item.quantity = _cap_to_max(existing_item.quantity + item.quantity, merged_max)
            existing_item.price = item.price
            if item.purchase_price is not None:
                existing_item.purchase_price = item.purchase_price
            if delivery_str is not None:
                existing_item.delivery = delivery_str
            if item.delivery_start is not None:
                existing_item.delivery_start = item.delivery_start
            if item.delivery_end is not None:
                existing_item.delivery_end = item.delivery_end
            existing_item.updated_at = datetime.utcnow()
            db.commit()
            db.refresh(existing_item)
            return _new_parts_cart_item_response(existing_item)

        cart_item = NewPartsCart(
            cart_id=cart.id,
            user_id=current_user.id,
            basket_id=basket.id,
            brand=item.brand,
            partnumber=item.partnumber,
            name=item.name,
            delivery=delivery_str,
            quantity=_cap_to_max(item.quantity, incoming_max),
            price=item.price,
            purchase_price=item.purchase_price,
            stock_id=item.stock_id,
            max_quantity=incoming_max,
            guid=item.guid,
            delivery_start=item.delivery_start,
            delivery_end=item.delivery_end,
        )
    else:
        guest_cart = get_or_create_guest_cart(db, request, response)
        basket = resolve_guest_basket(db, guest_cart.id, item.basket_id)

        existing_item = db.query(GuestNewPartsCart).filter(
            GuestNewPartsCart.guest_cart_id == guest_cart.id,
            GuestNewPartsCart.basket_id == basket.id,
            GuestNewPartsCart.stock_id == item.stock_id,
            GuestNewPartsCart.brand == item.brand,
            GuestNewPartsCart.partnumber == item.partnumber
        ).first()
        if existing_item:
            merged_max = _merge_new_parts_max(existing_item.max_quantity, incoming_max)
            existing_item.max_quantity = merged_max
            existing_item.quantity = _cap_to_max(existing_item.quantity + item.quantity, merged_max)
            existing_item.price = item.price
            if item.purchase_price is not None:
                existing_item.purchase_price = item.purchase_price
            if delivery_str is not None:
                existing_item.delivery = delivery_str
            if item.delivery_start is not None:
                existing_item.delivery_start = item.delivery_start
            if item.delivery_end is not None:
                existing_item.delivery_end = item.delivery_end
            existing_item.updated_at = datetime.utcnow()
            db.commit()
            touch_guest_cart(db, guest_cart)
            db.refresh(existing_item)
            return _new_parts_cart_item_response(existing_item)

        cart_item = GuestNewPartsCart(
            guest_cart_id=guest_cart.id,
            basket_id=basket.id,
            brand=item.brand,
            partnumber=item.partnumber,
            name=item.name,
            delivery=delivery_str,
            quantity=_cap_to_max(item.quantity, incoming_max),
            price=item.price,
            purchase_price=item.purchase_price,
            stock_id=item.stock_id,
            max_quantity=incoming_max,
            guid=item.guid,
            delivery_start=item.delivery_start,
            delivery_end=item.delivery_end,
        )

    db.add(cart_item)
    db.commit()
    db.refresh(cart_item)
    if not current_user:
        touch_guest_cart(db, guest_cart)

    return _new_parts_cart_item_response(cart_item)

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

    max_qty = _product_max_quantity(product)
    if item.quantity > max_qty:
        raise HTTPException(
            status_code=400,
            detail=f"Доступно не более {max_qty} шт.",
        )

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
            existing_item.quantity = _cap_to_max(existing_item.quantity + item.quantity, max_qty)
            existing_item.updated_at = datetime.utcnow()
            db.commit()
            db.refresh(existing_item)
            return _used_parts_cart_item_response(existing_item, product, db)

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
            existing_item.quantity = _cap_to_max(existing_item.quantity + item.quantity, max_qty)
            existing_item.updated_at = datetime.utcnow()
            db.commit()
            touch_guest_cart(db, guest_cart)
            db.refresh(existing_item)
            return _used_parts_cart_item_response(existing_item, product, db)
        cart_item = GuestUsedPartsCart(
            guest_cart_id=guest_cart.id, product_id=product.id, quantity=item.quantity,
            brand=product.brand, partnumber=product.article, price=product.price
        )

    db.add(cart_item)
    db.commit()
    db.refresh(cart_item)
    if not current_user:
        touch_guest_cart(db, guest_cart)
    return _used_parts_cart_item_response(cart_item, product, db)

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
            cart = get_or_create_user_cart(db, current_user.id)
            get_or_create_default_user_basket(db, cart.id, current_user.id)
            db.commit()
            cart = db.query(Cart).options(
                selectinload(Cart.new_parts_items),
                selectinload(Cart.used_parts_items).selectinload(UsedPartsCart.product).selectinload(Product.organization)
            ).filter(Cart.user_id == current_user.id).first()
        else:
            get_or_create_default_user_basket(db, cart.id, current_user.id)
        return _build_user_cart_response(cart, db)

    guest_token = get_guest_token_from_request(request)
    guest_cart = load_guest_cart_with_items(db, guest_token) if guest_token else None
    if not guest_cart:
        guest_cart = get_or_create_guest_cart(db, request, response)
    get_or_create_default_guest_basket(db, guest_cart.id)
    return _build_guest_cart_response(guest_cart, db)

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

    basket_id = cart_item.basket_id
    if current_user:
        cart_id = cart_item.cart_id
        user_id = cart_item.user_id
    else:
        guest_cart_id = cart_item.guest_cart_id

    db.delete(cart_item)
    if current_user:
        maybe_delete_empty_non_default_user_basket(db, cart_id, user_id, basket_id)
    else:
        maybe_delete_empty_non_default_guest_basket(db, guest_cart_id, basket_id)
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

    max_qty = cart_item.max_quantity
    if max_qty is not None and quantity_data.quantity > max_qty:
        raise HTTPException(
            status_code=400,
            detail=f"Доступно не более {max_qty} шт.",
        )

    cart_item.quantity = quantity_data.quantity
    cart_item.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(cart_item)
    if not current_user:
        touch_guest_cart(db, guest_cart)

    return _new_parts_cart_item_response(cart_item)

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
    max_qty = _product_max_quantity(product)
    if quantity_data.quantity > max_qty:
        raise HTTPException(
            status_code=400,
            detail=f"Доступно не более {max_qty} шт.",
        )

    cart_item.quantity = quantity_data.quantity
    cart_item.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(cart_item)
    if not current_user:
        touch_guest_cart(db, guest_cart)

    return _used_parts_cart_item_response(cart_item, product, db)


@router.get("/new-parts/baskets", response_model=list[NewPartsBasketResponse])
def list_new_parts_baskets(
    request: Request,
    response: Response,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user_optional),
):
    if current_user:
        cart = get_or_create_user_cart(db, current_user.id)
        baskets = list_user_baskets(db, cart.id, current_user.id)
        items = (
            db.query(NewPartsCart)
            .filter(NewPartsCart.cart_id == cart.id, NewPartsCart.user_id == current_user.id)
            .all()
        )
        items_by_basket: dict[int, list[NewPartsCart]] = {b.id: [] for b in baskets}
        for item in items:
            if item.basket_id and item.basket_id in items_by_basket:
                items_by_basket[item.basket_id].append(item)
        return [
            _build_new_parts_basket_response(basket, items_by_basket.get(basket.id, []))
            for basket in baskets
        ]

    guest_cart = get_or_create_guest_cart(db, request, response)
    baskets = list_guest_baskets(db, guest_cart.id)
    items = (
        db.query(GuestNewPartsCart)
        .filter(GuestNewPartsCart.guest_cart_id == guest_cart.id)
        .all()
    )
    items_by_basket: dict[int, list[GuestNewPartsCart]] = {b.id: [] for b in baskets}
    for item in items:
        if item.basket_id and item.basket_id in items_by_basket:
            items_by_basket[item.basket_id].append(item)
    return [
        _build_new_parts_basket_response(basket, items_by_basket.get(basket.id, []))
        for basket in baskets
    ]


@router.post("/new-parts/baskets", response_model=NewPartsBasketResponse)
def create_new_parts_basket(
    payload: CreateBasketRequest,
    request: Request,
    response: Response,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user_optional),
):
    if current_user:
        cart = get_or_create_user_cart(db, current_user.id)
        basket = create_user_basket(db, cart.id, current_user.id, payload.name)
        db.commit()
        db.refresh(basket)
        return _build_new_parts_basket_response(basket, [])

    guest_cart = get_or_create_guest_cart(db, request, response)
    basket = create_guest_basket(db, guest_cart.id, payload.name)
    touch_guest_cart(db, guest_cart)
    db.commit()
    db.refresh(basket)
    return _build_new_parts_basket_response(basket, [])


@router.patch("/new-parts/baskets/{basket_id}", response_model=NewPartsBasketResponse)
def rename_new_parts_basket(
    basket_id: int,
    payload: RenameBasketRequest,
    request: Request,
    response: Response,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user_optional),
):
    if current_user:
        cart = get_or_create_user_cart(db, current_user.id)
        basket = rename_user_basket(db, cart.id, current_user.id, basket_id, payload.name)
        items = (
            db.query(NewPartsCart)
            .filter(
                NewPartsCart.cart_id == cart.id,
                NewPartsCart.user_id == current_user.id,
                NewPartsCart.basket_id == basket.id,
            )
            .all()
        )
        db.commit()
        db.refresh(basket)
        return _build_new_parts_basket_response(basket, items)

    guest_cart = get_or_create_guest_cart(db, request, response)
    basket = rename_guest_basket(db, guest_cart.id, basket_id, payload.name)
    items = (
        db.query(GuestNewPartsCart)
        .filter(
            GuestNewPartsCart.guest_cart_id == guest_cart.id,
            GuestNewPartsCart.basket_id == basket.id,
        )
        .all()
    )
    touch_guest_cart(db, guest_cart)
    db.commit()
    db.refresh(basket)
    return _build_new_parts_basket_response(basket, items)


@router.delete("/new-parts/baskets/{basket_id}", status_code=204)
def delete_new_parts_basket(
    basket_id: int,
    request: Request,
    response: Response,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user_optional),
):
    """Удалить именованную пустую корзину новых запчастей."""
    if current_user:
        cart = get_or_create_user_cart(db, current_user.id)
        delete_user_basket(db, cart.id, current_user.id, basket_id)
        db.commit()
        return

    guest_cart = get_or_create_guest_cart(db, request, response)
    delete_guest_basket(db, guest_cart.id, basket_id)
    touch_guest_cart(db, guest_cart)
    db.commit()
    return
