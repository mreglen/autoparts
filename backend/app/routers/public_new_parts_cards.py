from __future__ import annotations

from pydantic import BaseModel, Field
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.db.database import get_db
from app.models.new_parts_seo_card import NewPartsSeoCard
from app.services.new_parts_seo_card_service import (
    _payload_from_raw,
    _stocks_from_card,
    build_new_part_card_path,
    create_or_get_new_part_card,
    get_new_part_card,
)

router = APIRouter(tags=["Public new parts cards"])


class NewPartStockIn(BaseModel):
    stock_id: str = Field(..., min_length=1, max_length=128)
    price: float | int | str | None = None
    available_count: int | None = 0
    delivery_start: str | None = None
    delivery_end: str | None = None


class NewPartCardCreateIn(BaseModel):
    source: str = Field(default="rossko", max_length=32)
    supplier_stock_id: str | None = Field(default=None, max_length=128)
    brand: str = Field(..., min_length=1, max_length=120)
    article: str = Field(..., min_length=1, max_length=120)
    name: str | None = Field(default=None, max_length=512)
    description: str | None = None
    price: float | int | str | None = None
    currency: str = Field(default="RUB", max_length=8)
    stock_count: int | None = None
    delivery_start: str | None = None
    delivery_end: str | None = None
    image_url: str | None = None
    guid: str | None = Field(default=None, max_length=128)
    stocks: list[NewPartStockIn] | None = None


class NewPartStockOut(BaseModel):
    stock_id: str
    price: float | None = None
    available_count: int = 0
    delivery_start: str | None = None
    delivery_end: str | None = None


class NewPartCardOut(BaseModel):
    id: int
    source: str
    brand: str
    article: str
    name: str | None = None
    description: str | None = None
    price: float | None = None
    currency: str
    stock_count: int | None = None
    delivery_start: str | None = None
    delivery_end: str | None = None
    image_url: str | None = None
    guid: str | None = None
    supplier_stock_id: str | None = None
    stocks: list[NewPartStockOut] = Field(default_factory=list)
    canonical_url: str


def _card_to_out(card: NewPartsSeoCard) -> NewPartCardOut:
    payload = _payload_from_raw(card)
    stocks = [
        NewPartStockOut(
            stock_id=row["stock_id"],
            price=row.get("price"),
            available_count=int(row.get("available_count") or 0),
            delivery_start=row.get("delivery_start"),
            delivery_end=row.get("delivery_end"),
        )
        for row in _stocks_from_card(card)
    ]
    return NewPartCardOut(
        id=card.id,
        source=card.source,
        brand=card.brand,
        article=card.article,
        name=card.name,
        description=card.description,
        price=float(card.price) if card.price is not None else None,
        currency=card.currency or "RUB",
        stock_count=card.stock_count,
        delivery_start=card.delivery_start.isoformat() if card.delivery_start else None,
        delivery_end=card.delivery_end.isoformat() if card.delivery_end else None,
        image_url=card.image_url,
        guid=payload.get("guid") if isinstance(payload.get("guid"), str) else None,
        supplier_stock_id=payload.get("supplier_stock_id")
        if isinstance(payload.get("supplier_stock_id"), str)
        else None,
        stocks=stocks,
        canonical_url=build_new_part_card_path(card.id, card.brand, card.article),
    )


@router.post("/public/new-parts/cards/create-or-get", response_model=NewPartCardOut)
def public_create_or_get_new_part_card(payload: NewPartCardCreateIn, db: Session = Depends(get_db)):
    card = create_or_get_new_part_card(db, payload.model_dump())
    return _card_to_out(card)


@router.get("/public/new-parts/cards/{card_id}", response_model=NewPartCardOut)
def public_get_new_part_card(card_id: int, db: Session = Depends(get_db)):
    card = get_new_part_card(db, card_id)
    if card is None:
        raise HTTPException(status_code=404, detail="Card not found")
    return _card_to_out(card)
