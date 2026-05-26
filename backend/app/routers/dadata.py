from __future__ import annotations

from fastapi import APIRouter

from app.schemas.dadata import DadataSuggestAddressIn, DadataSuggestAddressOut
from app.services.dadata_service import suggest_address

router = APIRouter(tags=["DaData"])


@router.post("/public/dadata/suggest/address", response_model=DadataSuggestAddressOut)
async def public_suggest_address(payload: DadataSuggestAddressIn) -> DadataSuggestAddressOut:
    """Подсказки адреса для оформления заказа (прокси DaData)."""
    suggestions = await suggest_address(
        payload.query,
        count=payload.count,
        locations=payload.locations,
    )
    return DadataSuggestAddressOut(suggestions=suggestions)
