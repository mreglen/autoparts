from fastapi import APIRouter, Depends, Query
from fastapi.encoders import jsonable_encoder
from sqlalchemy import func
from sqlalchemy.orm import Session, selectinload
import logging
from app.models.product import Product as ProductModel
from app.schemas.product import Product as ProductSchema
from app.db.database import get_db
from app.routers.rossko_api.rossko_api import rossko_search, rossko_delivery_id, rossko_address_id
from app.schemas.rossko import SearchRequest
from app.utils.search_cache import build_cache_key, get_cached_json, set_cached_json
from app.utils.json_cache_sync import get_cached_json_sync, set_cached_json_sync
from app.utils.singleflight import SingleFlight
from app.utils.product_list_item import map_product_to_list_item
from app.utils.partnumber import normalize_partnumber
from app.utils.search_query import parse_search_query
from app.services.local_product_search import (
    search_local_products_query,
    _brand_article_pair_condition,
)
from app.utils.search_sql import get_sql_normalize

router = APIRouter(prefix="/search-products", tags=["Search-Products"])
logger = logging.getLogger(__name__)
_SEARCH_CACHE_TTL_SECONDS = 120
_rossko_singleflight = SingleFlight()


def _cache_resolve_payload(cache_key: str, payload: dict) -> dict:
    encoded = jsonable_encoder(payload)
    set_cached_json_sync(cache_key, encoded, _SEARCH_CACHE_TTL_SECONDS)
    return encoded


@router.get("/search", response_model=list[ProductSchema])
def search_products(
    q: str,
    limit: int = Query(200, ge=1, le=500),
    db: Session = Depends(get_db),
):
    """Поиск по артикулу, бренду, названию и их комбинациям."""
    trimmed = (q or "").strip()
    if not trimmed:
        return []
    cache_key = build_cache_key("local", trimmed, limit=limit)
    cached = get_cached_json_sync(cache_key)
    if cached is not None:
        return cached

    results = search_local_products_query(db, trimmed, limit=limit).all()
    payload = jsonable_encoder(results)
    set_cached_json_sync(cache_key, payload, _SEARCH_CACHE_TTL_SECONDS)
    return payload


@router.get("/resolve")
def resolve_product(q: str, db: Session = Depends(get_db)):
    """
    Определяет одну карточку товара по артикулу, бренду+артикулу или названию.
    Используется для прямого перехода из адресной строки (/find?q=...) и быстрого поиска.
    """
    trimmed = q.strip()
    if not trimmed:
        return jsonable_encoder({"status": "not_found", "query": q, "match_type": None, "product": None, "products": []})

    cache_key = build_cache_key("resolve", trimmed)
    cached = get_cached_json_sync(cache_key)
    if cached is not None:
        logger.info("search cache HIT: resolve q=%r", trimmed)
        return cached

    base_query = db.query(ProductModel).options(
        selectinload(ProductModel.photos),
        selectinload(ProductModel.storage_location),
        selectinload(ProductModel.organization),
    ).filter(func.coalesce(ProductModel.quantity, 0) > 0)

    parsed = parse_search_query(trimmed)

    for brand_text, article_text in parsed.brand_article_pairs[:8]:
        by_pair = base_query.filter(_brand_article_pair_condition(brand_text, article_text)).limit(2).all()
        if len(by_pair) == 1:
            return _cache_resolve_payload(cache_key, {
                "status": "found",
                "query": trimmed,
                "match_type": "brand_article",
                "product": by_pair[0],
                "products": by_pair,
            })
        if len(by_pair) > 1:
            return _cache_resolve_payload(cache_key, {
                "status": "multiple",
                "query": trimmed,
                "match_type": "brand_article",
                "product": None,
                "products": by_pair,
            })

    normalized = normalize_partnumber(trimmed)
    if normalized:
        by_article = base_query.filter(get_sql_normalize(ProductModel.article) == normalized).limit(2).all()
        if len(by_article) == 1:
            return _cache_resolve_payload(cache_key, {
                "status": "found",
                "query": trimmed,
                "match_type": "article",
                "product": by_article[0],
                "products": by_article,
            })
        if len(by_article) > 1:
            return _cache_resolve_payload(cache_key, {
                "status": "multiple",
                "query": trimmed,
                "match_type": "article",
                "product": None,
                "products": by_article,
            })

    by_name = base_query.filter(func.lower(func.trim(ProductModel.name)) == trimmed.lower()).limit(2).all()
    if len(by_name) == 1:
        return _cache_resolve_payload(cache_key, {
            "status": "found",
            "query": trimmed,
            "match_type": "name",
            "product": by_name[0],
            "products": by_name,
        })
    if len(by_name) > 1:
        return _cache_resolve_payload(cache_key, {
            "status": "multiple",
            "query": trimmed,
            "match_type": "name",
            "product": None,
            "products": by_name,
        })

    results = search_local_products_query(db, trimmed, limit=20).all()
    if len(results) == 1:
        return _cache_resolve_payload(cache_key, {
            "status": "found",
            "query": trimmed,
            "match_type": "search",
            "product": results[0],
            "products": results,
        })
    if len(results) > 1:
        return _cache_resolve_payload(cache_key, {
            "status": "multiple",
            "query": trimmed,
            "match_type": "search",
            "product": None,
            "products": results,
        })

    return _cache_resolve_payload(cache_key, {
        "status": "not_found",
        "query": trimmed,
        "match_type": None,
        "product": None,
        "products": [],
    })


@router.get("/resolve-all")
def resolve_search_all(q: str, db: Session = Depends(get_db)):
    from app.services.search_resolve_service import resolve_search_query
    from app.services.yandex_feed_xml_service import _resolve_site_origin
    from app.utils.yandex_integration_db import get_or_create_yandex_integration

    row = get_or_create_yandex_integration(db)
    site_origin = _resolve_site_origin(row.host_url)
    result = resolve_search_query(db, q, site_origin=site_origin)
    return jsonable_encoder(
        {
            "status": result.status,
            "redirect_path": result.redirect_path,
            "redirect_url": result.redirect_url,
            "match_type": result.match_type,
            "query": (q or "").strip(),
        }
    )


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

    parsed = parse_search_query(trimmed_query)
    normalized_q = parsed.normalized_full or normalize_partnumber(trimmed_query)

    # 1. Локальный поиск — сразу, не ждём ROSSKO.
    local_products = search_local_products_query(db, trimmed_query, limit=200).all()
    local_direct_ids = {p.id for p in local_products}

    # 2. ROSSKO API (новые запчасти + аналоги).
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

        def extract_rossko_pns(parts, target_set):
            if not parts:
                return
            for part in parts:
                pn = part.get("partnumber")
                if pn:
                    target_set.add(normalize_partnumber(pn))
                
                crosses = part.get("crosses") or {}
                cross_parts = crosses.get("Part") or []
                if not isinstance(cross_parts, list):
                    cross_parts = [cross_parts]
                extract_rossko_pns(cross_parts, rossko_analogs_normalized)

        parts_list = rossko_response.get("PartsList", {}).get("Part", [])
        if not isinstance(parts_list, list):
            parts_list = [parts_list]
        extract_rossko_pns(parts_list, rossko_direct_normalized)
    except Exception as e:
        logger.warning("ROSSKO error in combined search: %s", e)

    # 3. Дополнительный локальный поиск по артикулам из ROSSKO.
    all_target_pns = rossko_direct_normalized | rossko_analogs_normalized
    if normalized_q:
        all_target_pns.add(normalized_q)

    extra_products = []
    if all_target_pns:
        extra_products = db.query(ProductModel).options(
            selectinload(ProductModel.photos),
            selectinload(ProductModel.storage_location),
            selectinload(ProductModel.organization)
        ).filter(
            get_sql_normalize(ProductModel.article).in_(list(all_target_pns)),
            func.coalesce(ProductModel.quantity, 0) > 0,
        ).limit(200).all()

    db_products = list(local_products)
    seen_ids = local_direct_ids.copy()
    for p in extra_products:
        if p.id not in seen_ids:
            db_products.append(p)
            seen_ids.add(p.id)

    direct_products = []
    analog_products = []
    seen_ids = set()
    for p in db_products:
        if p.id in seen_ids:
            continue
        p_norm = normalize_partnumber(p.article)
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

    direct_matches = search_local_products_query(db, trimmed_query, is_new=False, limit=200).all()
    
    if not only_analogs:
        available_parts = direct_matches

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
            
            analog_pns = set()
            def extract_analogs(parts):
                if not parts:
                    return
                for part in parts:
                    crosses = part.get("crosses") or {}
                    cross_parts = crosses.get("Part") or []
                    if not isinstance(cross_parts, list):
                        cross_parts = [cross_parts]
                    for cp in cross_parts:
                        pn = cp.get("partnumber")
                        if pn:
                            analog_pns.add(normalize_partnumber(pn))
            
            parts_list = rossko_response.get("PartsList", {}).get("Part", [])
            if not isinstance(parts_list, list):
                parts_list = [parts_list]
            extract_analogs(parts_list)

            if analog_pns:
                db_analogs = db.query(ProductModel).options(
                    selectinload(ProductModel.photos),
                    selectinload(ProductModel.storage_location),
                    selectinload(ProductModel.organization)
                ).filter(
                    get_sql_normalize(ProductModel.article).in_(list(analog_pns)),
                    func.coalesce(ProductModel.quantity, 0) > 0,
                    ProductModel.is_new.is_(False),
                ).limit(200).all()
                
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
