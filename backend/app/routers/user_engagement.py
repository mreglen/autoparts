from fastapi import APIRouter, Depends, HTTPException, Query, status
from fastapi.responses import HTMLResponse
from sqlalchemy.orm import Session

from app.core.auth import get_current_user
from app.db.database import get_db
from app.models.user import User
from app.schemas.user_engagement import (
    FavoriteStatusOut,
    FavoritesListOut,
    ProductViewsListOut,
    RosskoFavoriteCreateIn,
    SearchSubscriptionCreateIn,
    SearchSubscriptionOut,
    SearchSubscriptionsListOut,
)
from app.services import user_engagement_service as engagement
from app.services import search_subscription_service as subscriptions

router = APIRouter(tags=["User Engagement"])


@router.get("/user/favorites", response_model=FavoritesListOut)
def list_favorites(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return FavoritesListOut(items=engagement.list_favorites(db, current_user.id))


@router.post("/user/favorites/rossko", status_code=status.HTTP_204_NO_CONTENT)
def add_rossko_favorite(
    payload: RosskoFavoriteCreateIn,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    engagement.add_rossko_favorite(db, current_user.id, payload)
    return None


@router.delete("/user/favorites/rossko", status_code=status.HTTP_204_NO_CONTENT)
def remove_rossko_favorite(
    brand: str = Query(..., min_length=1, max_length=100),
    partnumber: str = Query(..., min_length=1, max_length=64),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    engagement.remove_rossko_favorite(db, current_user.id, brand, partnumber)
    return None


@router.get("/user/favorites/rossko/status", response_model=FavoriteStatusOut)
def rossko_favorite_status(
    brand: str = Query(..., min_length=1, max_length=100),
    partnumber: str = Query(..., min_length=1, max_length=64),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return FavoriteStatusOut(
        is_favorite=engagement.is_rossko_favorite(db, current_user.id, brand, partnumber)
    )


@router.post("/user/favorites/{product_id}", status_code=status.HTTP_204_NO_CONTENT)
def add_favorite(
    product_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    engagement.add_favorite(db, current_user.id, product_id)
    return None


@router.delete("/user/favorites/{product_id}", status_code=status.HTTP_204_NO_CONTENT)
def remove_favorite(
    product_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    engagement.remove_favorite(db, current_user.id, product_id)
    return None


@router.get("/user/favorites/{product_id}/status", response_model=FavoriteStatusOut)
def favorite_status(
    product_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return FavoriteStatusOut(is_favorite=engagement.is_favorite(db, current_user.id, product_id))


@router.post("/user/product-views/{product_id}", status_code=status.HTTP_204_NO_CONTENT)
def record_product_view(
    product_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    engagement.record_product_view(db, current_user.id, product_id)
    return None


@router.get("/user/product-views", response_model=ProductViewsListOut)
def list_product_views(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return ProductViewsListOut(items=engagement.list_view_history(db, current_user.id))


@router.delete("/user/product-views", status_code=status.HTTP_204_NO_CONTENT)
def clear_product_views(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    engagement.clear_view_history(db, current_user.id)
    return None


@router.get("/user/search-subscriptions", response_model=SearchSubscriptionsListOut)
def list_search_subscriptions(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    rows = subscriptions.list_search_subscriptions(db, current_user.id)
    return SearchSubscriptionsListOut(items=[SearchSubscriptionOut.model_validate(r) for r in rows])


@router.post("/user/search-subscriptions", response_model=SearchSubscriptionOut, status_code=status.HTTP_201_CREATED)
def create_search_subscription(
    payload: SearchSubscriptionCreateIn,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    row = subscriptions.create_search_subscription(db, current_user.id, payload.query)
    return SearchSubscriptionOut.model_validate(row)


@router.delete("/user/search-subscriptions/{subscription_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_search_subscription(
    subscription_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    subscriptions.delete_search_subscription(db, current_user.id, subscription_id)
    return None


@router.get("/public/search-subscriptions/unsubscribe", response_class=HTMLResponse)
def unsubscribe_search_subscription(
    token: str = Query(..., min_length=8),
    db: Session = Depends(get_db),
):
    ok = subscriptions.deactivate_subscription_by_token(db, token)
    if not ok:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Подписка не найдена")
    return HTMLResponse(
        content=(
            "<!DOCTYPE html><html lang='ru'><head><meta charset='utf-8'>"
            "<title>Отписка</title></head><body>"
            "<h1>Вы отписались от уведомлений по этому поисковому запросу.</h1>"
            "<p><a href='/'>На главную</a></p>"
            "</body></html>"
        ),
        status_code=200,
    )
