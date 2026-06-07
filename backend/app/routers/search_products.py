from fastapi import APIRouter, Depends
from fastapi.encoders import jsonable_encoder
from sqlalchemy import or_, func
from sqlalchemy.orm import Session, selectinload
import re
import logging
from app.models.product import Product as ProductModel
from app.schemas.product import Product as ProductSchema
from app.db.database import get_db
from app.routers.rossko_api.rossko_api import rossko_search, rossko_delivery_id, rossko_address_id
from app.schemas.rossko import SearchRequest
from app.utils.search_cache import build_cache_key, get_cached_json, set_cached_json
from app.utils.singleflight import SingleFlight
from app.utils.product_list_item import map_product_to_list_item
from app.utils.partnumber import normalize_partnumber

router = APIRouter(prefix="/search-products", tags=["Search-Products"])
logger = logging.getLogger(__name__)
_SEARCH_CACHE_TTL_SECONDS = 120
_rossko_singleflight = SingleFlight()

def get_sql_normalize(col):
    """
    SQL-выражение для нормализации артикула в базе данных.
    """
    # Цепочка замен для удаления распространенных разделителей
    return func.replace(func.replace(func.replace(func.replace(func.replace(func.replace(func.replace(func.upper(col), 
        '-', ''), ' ', ''), '.', ''), '/', ''), '(', ''), ')', ''), '_', '')

def search_local_products_query(db: Session, q: str, is_new: bool = None):
    """
    Базовая логика поиска в локальной БД по артикулу (нормализованному) или названию.
    """
    trimmed_q = q.strip()
    normalized_q = normalize_partnumber(trimmed_q)
    
    conditions = [
        ProductModel.article.ilike(f"%{trimmed_q}%"),
        ProductModel.name.ilike(f"%{trimmed_q}%")
    ]
    
    if normalized_q:
        # Поиск по нормализованному артикулу в БД
        conditions.append(get_sql_normalize(ProductModel.article).ilike(f"%{normalized_q}%"))
        # Поиск по нормализованному названию (только пробелы)
        conditions.append(func.replace(ProductModel.name, ' ', '').ilike(f"%{normalized_q}%"))

    query = db.query(ProductModel).options(
        selectinload(ProductModel.photos),
        selectinload(ProductModel.storage_location),
        selectinload(ProductModel.organization)
    ).filter(or_(*conditions), func.coalesce(ProductModel.quantity, 0) > 0)
    
    if is_new is not None:
        query = query.filter(ProductModel.is_new == is_new)
        
    return query

@router.get("/search", response_model=list[ProductSchema])
def search_products(q: str, db: Session = Depends(get_db)):
    """Простой поиск (универсальный)"""
    return search_local_products_query(db, q).all()


@router.get("/resolve")
def resolve_product(q: str, db: Session = Depends(get_db)):
    """
    Определяет одну карточку товара по артикулу или названию.
    Используется для прямого перехода из адресной строки (/find?q=...) и быстрого поиска.
    """
    trimmed = q.strip()
    if not trimmed:
        return jsonable_encoder({"status": "not_found", "query": q, "match_type": None, "product": None, "products": []})

    normalized = normalize_partnumber(trimmed)

    base_query = db.query(ProductModel).options(
        selectinload(ProductModel.photos),
        selectinload(ProductModel.storage_location),
        selectinload(ProductModel.organization),
    ).filter(func.coalesce(ProductModel.quantity, 0) > 0)

    if normalized:
        by_article = base_query.filter(get_sql_normalize(ProductModel.article) == normalized).all()
        if len(by_article) == 1:
            return jsonable_encoder({
                "status": "found",
                "query": trimmed,
                "match_type": "article",
                "product": by_article[0],
                "products": by_article,
            })
        if len(by_article) > 1:
            return jsonable_encoder({
                "status": "multiple",
                "query": trimmed,
                "match_type": "article",
                "product": None,
                "products": by_article,
            })

    by_name = base_query.filter(func.lower(func.trim(ProductModel.name)) == trimmed.lower()).all()
    if len(by_name) == 1:
        return jsonable_encoder({
            "status": "found",
            "query": trimmed,
            "match_type": "name",
            "product": by_name[0],
            "products": by_name,
        })
    if len(by_name) > 1:
        return jsonable_encoder({
            "status": "multiple",
            "query": trimmed,
            "match_type": "name",
            "product": None,
            "products": by_name,
        })

    results = search_local_products_query(db, trimmed).limit(20).all()
    if len(results) == 1:
        return jsonable_encoder({
            "status": "found",
            "query": trimmed,
            "match_type": "search",
            "product": results[0],
            "products": results,
        })
    if len(results) > 1:
        return jsonable_encoder({
            "status": "multiple",
            "query": trimmed,
            "match_type": "search",
            "product": None,
            "products": results,
        })

    return jsonable_encoder({
        "status": "not_found",
        "query": trimmed,
        "match_type": None,
        "product": None,
        "products": [],
    })

@router.get("/search-combined")
async def search_combined(q: str, db: Session = Depends(get_db)):
    """
    Поиск новых и б/у запчастей. 
    Новые запчасти дополняются данными из ROSSKO API.
    """
    trimmed_query = q.strip()
    if not trimmed_query:
        return {"direct": [], "analogs": [], "rossko_data": None}
    cache_key = build_cache_key("combined", trimmed_query)
    cached_payload = await get_cached_json(cache_key)
    if cached_payload is not None:
        return cached_payload

    # 1. Запрос к ROSSKO API (основной источник для новых запчастей)
    rossko_response = None
    rossko_direct_normalized = set()
    rossko_analogs_normalized = set()
    
    try:
        async def rossko_call():
            rossko_request = SearchRequest(
                text=trimmed_query,
                delivery_id=rossko_delivery_id,
                address_id=rossko_address_id
            )
            return await rossko_search(rossko_request, db)

        rossko_response = await _rossko_singleflight.do(f"rossko:combined:{trimmed_query.lower()}", rossko_call)

        def extract_rossko_pns(parts, target_set, is_analog=False):
            if not parts: return
            for part in parts:
                pn = part.get("partnumber")
                if pn: target_set.add(normalize_partnumber(pn))
                
                crosses = part.get("crosses") or {}
                cross_parts = crosses.get("Part") or []
                if not isinstance(cross_parts, list): cross_parts = [cross_parts]
                extract_rossko_pns(cross_parts, rossko_analogs_normalized, is_analog=True)

        parts_list = rossko_response.get("PartsList", {}).get("Part", [])
        if not isinstance(parts_list, list): parts_list = [parts_list]
        extract_rossko_pns(parts_list, rossko_direct_normalized)
    except Exception as e:
        logger.warning("ROSSKO error in combined search: %s", e)

    # 2. Поиск в локальной базе (учитываем всё: и новые, и б/у)
    normalized_q = normalize_partnumber(trimmed_query)
    
    # Собираем все артикулы, которые нас интересуют
    all_target_pns = rossko_direct_normalized | rossko_analogs_normalized
    if normalized_q:
        all_target_pns.add(normalized_q)

    # Ищем в базе: по нормализованному запросу ИЛИ по артикулам из ROSSKO
    db_products = db.query(ProductModel).options(
        selectinload(ProductModel.photos),
        selectinload(ProductModel.storage_location),
        selectinload(ProductModel.organization)
    ).filter(
        or_(
            get_sql_normalize(ProductModel.article).in_(list(all_target_pns)),
            get_sql_normalize(ProductModel.article).ilike(f"%{normalized_q}%") if normalized_q else False,
            ProductModel.name.ilike(f"%{trimmed_query}%")
        ),
        func.coalesce(ProductModel.quantity, 0) > 0
    ).all()

    # 3. Разделение результатов
    direct_products = []
    analog_products = []
    
    seen_ids = set()
    for p in db_products:
        if p.id in seen_ids: continue
        
        p_norm = normalize_partnumber(p.article)
        # Если артикул совпадает с запросом или с прямым ответом ROSSKO
        if p_norm == normalized_q or p_norm in rossko_direct_normalized:
            direct_products.append(p)
        else:
            analog_products.append(p)
        seen_ids.add(p.id)

    payload = jsonable_encoder({
        "direct": direct_products,
        "analogs": analog_products,
        "rossko_data": rossko_response
    })
    await set_cached_json(cache_key, payload, _SEARCH_CACHE_TTL_SECONDS)
    return payload

@router.get("/search-used-parts")
async def search_used_parts(
    q: str,
    only_in_stock: bool = False,
    only_analogs: bool = False,
    db: Session = Depends(get_db)
):
    """
    Поиск б/у запчастей. Приоритет - наличие в базе.
    """
    trimmed_query = q.strip()
    if not trimmed_query:
        return {"available_parts": [], "analog_parts": [], "rossko_data": None}
    cache_key = build_cache_key(
        "used",
        trimmed_query,
        only_in_stock=int(only_in_stock),
        only_analogs=int(only_analogs),
    )
    cached_payload = await get_cached_json(cache_key)
    if cached_payload is not None:
        return cached_payload

    available_parts = []
    analog_parts = []
    rossko_response = None

    # --- ШАГ 1: Быстрый поиск в наличии (всё локальное наличие считаем "в наличии" для этой вкладки) ---
    # Получаем прямые соответствия запросу для отображения или для исключения из аналогов
    direct_matches = search_local_products_query(db, trimmed_query).all()
    
    if not only_analogs:
        available_parts = direct_matches

    # --- ШАГ 2: Поиск аналогов (через ROSSKO) ---
    if not only_in_stock:
        try:
            async def rossko_call():
                rossko_request = SearchRequest(
                    text=trimmed_query,
                    delivery_id=rossko_delivery_id,
                    address_id=rossko_address_id
                )
                return await rossko_search(rossko_request, db)

            rossko_response = await _rossko_singleflight.do(
                f"rossko:used:{trimmed_query.lower()}",
                rossko_call,
            )
            
            # Извлекаем аналоги из ROSSKO
            analog_pns = set()
            def extract_analogs(parts):
                if not parts: return
                for part in parts:
                    crosses = part.get("crosses") or {}
                    cross_parts = crosses.get("Part") or []
                    if not isinstance(cross_parts, list): cross_parts = [cross_parts]
                    for cp in cross_parts:
                        pn = cp.get("partnumber")
                        if pn: analog_pns.add(normalize_partnumber(pn))
            
            parts_list = rossko_response.get("PartsList", {}).get("Part", [])
            if not isinstance(parts_list, list): parts_list = [parts_list]
            extract_analogs(parts_list)

            if analog_pns:
                # Ищем б/у аналоги в нашей базе (показываем всё наличие, подходящее под аналоги)
                db_analogs = db.query(ProductModel).options(
                    selectinload(ProductModel.photos),
                    selectinload(ProductModel.storage_location),
                    selectinload(ProductModel.organization)
                ).filter(
                    get_sql_normalize(ProductModel.article).in_(list(analog_pns)),
                    func.coalesce(ProductModel.quantity, 0) > 0,
                ).all()
                
                # Исключаем те, что уже найдены как прямые соответствия
                seen_ids = {p.id for p in direct_matches}
                for a in db_analogs:
                    if a.id not in seen_ids:
                        analog_parts.append(a)
                        seen_ids.add(a.id)
        except Exception as e:
            logger.warning("ROSSKO error in used search: %s", e)

    payload = jsonable_encoder({
        "available_parts": [map_product_to_list_item(p) for p in available_parts],
        "analog_parts": [map_product_to_list_item(p) for p in analog_parts],
        "rossko_data": rossko_response
    })
    await set_cached_json(cache_key, payload, _SEARCH_CACHE_TTL_SECONDS)
    return payload
