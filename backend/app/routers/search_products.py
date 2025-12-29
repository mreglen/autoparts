from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import or_
from sqlalchemy.orm import Session
from app.models.product import Product as ProductModel
from app.schemas.product import Product as ProductSchema
from app.db.database import get_db
from app.models.user import User
from app.routers.rossko_api.rossko_api import rossko_search, rossko_delivery_id, rossko_address_id
from app.schemas.rossko import SearchRequest

router = APIRouter(prefix="/search-products", tags=["Search-Products"])

@router.get("/search", response_model=list[ProductSchema])
def search_products(
    q: str,
    db: Session = Depends(get_db)
):
    query = db.query(ProductModel)

    if q:
        search_term = f"%{q.strip().lower()}%"
        query = query.filter(
            (ProductModel.article.ilike(search_term)) |
            (ProductModel.name.ilike(search_term))
        )

    products = query.all()
    print(f"Search API called with q='{q}', returning {len(products)} products")
    if products:
        print(f"Sample product: {products[0].article} - {products[0].name}")
    return products



@router.get("/search-with-analogs", response_model=list[ProductSchema])
async def search_products_with_rossko_analogs(
    q: str,
    db: Session = Depends(get_db)
):
    rossko_request = SearchRequest(
        text=q.strip(),
        delivery_id=rossko_delivery_id,
        address_id=rossko_address_id
    )
    try:
        rossko_response = await rossko_search(rossko_request, db)  # Теперь это dict
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Ошибка при запросе к ROSSKO: {str(e)}")

    partnumbers = set()

    def extract_partnumbers(parts):
        if not parts:
            return
        for part in parts:
            # part — теперь обычный dict
            pn = (part.get("partnumber") or "").strip()
            if pn:
                partnumbers.add(pn.upper())
            # Обработка аналогов
            crosses = part.get("crosses") or {}
            cross_parts = crosses.get("Part") or []
            if not isinstance(cross_parts, list):
                cross_parts = [cross_parts]
            extract_partnumbers(cross_parts)

    # Извлекаем корневые запчасти
    parts_list = (
        rossko_response
        .get("PartsList", {})
        .get("Part", [])
    )
    if not isinstance(parts_list, list):
        parts_list = [parts_list]

    extract_partnumbers(parts_list)
    partnumbers.add(q.strip().upper())

    if not partnumbers:
        return []

    filters = [ProductModel.article.ilike(pn) for pn in partnumbers]
    products = db.query(ProductModel).filter(or_(*filters)).all()
    return products