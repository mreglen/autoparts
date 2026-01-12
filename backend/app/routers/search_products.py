from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import or_, func
from sqlalchemy.orm import Session
import re
from app.models.product import Product as ProductModel
from app.schemas.product import Product as ProductSchema
from app.db.database import get_db
from app.models.user import User
from app.routers.rossko_api.rossko_api import rossko_search, rossko_delivery_id, rossko_address_id
from app.schemas.rossko import SearchRequest

router = APIRouter(prefix="/search-products", tags=["Search-Products"])


def normalize_partnumber(pn):
    """
    Нормализует артикул для поиска:
    - Убирает все разделители (пробелы, дефисы, точки, слэши)
    - Приводит к верхнему регистру
    - Оставляет только буквы и цифры
    """
    if not pn:
        return ""
    # Убираем все не буквенно-цифровые символы и приводим к верхнему регистру
    normalized = re.sub(r'[^A-Za-z0-9]', '', pn).upper()
    return normalized


def get_partnumber_variants(pn):
    """
    Генерирует различные варианты артикула для поиска
    """
    if not pn:
        return []

    variants = set()

    # Оригинальный артикул
    variants.add(pn.upper())
    variants.add(pn.lower())

    # Нормализованный (без разделителей)
    normalized = normalize_partnumber(pn)
    variants.add(normalized)

    # С пробелами между буквами и цифрами
    spaced = re.sub(r'([A-Za-z]+)([0-9]+)', r'\1 \2', pn)
    if spaced != pn:
        variants.add(spaced.upper())

    # С пробелами между группами цифр
    spaced_groups = re.sub(r'([A-Za-z]+)([0-9]{2})([0-9]{3})', r'\1 \2 \3', pn)
    if spaced_groups != pn:
        variants.add(spaced_groups.upper())

    # Без пробелов
    no_spaces = pn.replace(" ", "")
    variants.add(no_spaces.upper())

    # С дефисами вместо пробелов
    with_dashes = pn.replace(" ", "-")
    variants.add(with_dashes.upper())

    # С точками вместо пробелов
    with_dots = pn.replace(" ", ".")
    variants.add(with_dots.upper())

    return list(variants)

@router.get("/search", response_model=list[ProductSchema])
def search_products(
    q: str,
    db: Session = Depends(get_db)
):
    query = db.query(ProductModel)

    if q:
        trimmed_q = q.strip()
        search_term = f"%{trimmed_q.lower()}%"

        # Обычный поиск
        conditions = [
            ProductModel.article.ilike(search_term),
            ProductModel.name.ilike(search_term)
        ]

        # Поиск по нормализованным артикулам
        normalized_q = normalize_partnumber(trimmed_q)
        if normalized_q:
            # Добавляем поиск по нормализованным артикулам
            normalized_condition = func.replace(func.replace(func.replace(func.upper(ProductModel.article), '-', ''), ' ', ''), '.', '') == normalized_q
            conditions.append(normalized_condition)

            # И частичное совпадение
            conditions.append(
                func.replace(func.replace(func.replace(func.upper(ProductModel.article), '-', ''), ' ', ''), '.', '').ilike(f"%{normalized_q}%")
            )

        query = query.filter(or_(*conditions))

    products = query.filter(ProductModel.quantity > 0).all()
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
    products = db.query(ProductModel).filter(or_(*filters)).filter(ProductModel.quantity > 0).all()
    return products


@router.get("/search-combined")
async def search_combined(
    q: str,
    db: Session = Depends(get_db)
):
    """
    Поиск запчастей только по данным из ROSSKO API.
    Возвращает запчасти из внутренней базы, соответствующие артикулам из ROSSKO (прямые + аналоги).
    """
    trimmed_query = q.strip()
    if not trimmed_query:
        return {
            "direct": [],
            "analogs": [],
            "rossko_data": None
        }

    # Получаем данные из Росско (один вызов)
    rossko_request = SearchRequest(
        text=trimmed_query,
        delivery_id=rossko_delivery_id,
        address_id=rossko_address_id
    )

    rossko_response = None
    try:
        rossko_response = await rossko_search(rossko_request, db)
    except Exception as e:
        print(f"ROSSKO search error: {str(e)}")
        return {
            "direct": [],
            "analogs": [],
            "rossko_data": None,
            "error": "Ошибка поиска в ROSSKO"
        }

    # Извлекаем все артикулы из ROSSKO (прямые + аналоги)
    partnumbers = set()

    def extract_partnumbers(parts):
        if not parts:
            return
        for part in parts:
            pn = (part.get("partnumber") or "").strip()
            if pn:
                partnumbers.add(pn.upper())
            crosses = part.get("crosses") or {}
            cross_parts = crosses.get("Part") or []
            if not isinstance(cross_parts, list):
                cross_parts = [cross_parts]
            extract_partnumbers(cross_parts)

    parts_list = (
        rossko_response
        .get("PartsList", {})
        .get("Part", [])
    )
    if not isinstance(parts_list, list):
        parts_list = [parts_list]

    extract_partnumbers(parts_list)
    partnumbers.add(trimmed_query.upper())  # Добавляем оригинальный запрос

    if not partnumbers:
        return {
            "direct": [],
            "analogs": [],
            "rossko_data": rossko_response
        }

    # Ищем запчасти в нашей базе только по артикулам из ROSSKO
    filters = [ProductModel.article.ilike(f"%{pn}%") for pn in partnumbers]
    all_products = db.query(ProductModel).filter(or_(*filters)).filter(ProductModel.quantity > 0).all()

    # Разделяем на прямые совпадения и аналоги
    direct_products = []
    analog_products = []

    # Определяем какие артикулы являются прямыми совпадениями
    direct_partnumbers = set()
    for part in parts_list:
        pn = (part.get("partnumber") or "").strip()
        if pn:
            direct_partnumbers.add(pn.upper())

    for product in all_products:
        # Проверяем, является ли артикул продукта прямым совпадением
        product_article = product.article.upper()
        if any(product_article.find(direct_pn) >= 0 for direct_pn in direct_partnumbers):
            direct_products.append(product)
        else:
            # Проверяем, есть ли этот артикул в аналогах
            found_in_analogs = False
            for part in parts_list:
                crosses = part.get("crosses") or {}
                cross_parts = crosses.get("Part") or []
                if not isinstance(cross_parts, list):
                    cross_parts = [cross_parts]

                for cross_part in cross_parts:
                    cross_pn = (cross_part.get("partnumber") or "").strip()
                    if cross_pn and product_article.find(cross_pn.upper()) >= 0:
                        analog_products.append(product)
                        found_in_analogs = True
                        break
                if found_in_analogs:
                    break

            # Если не нашли ни в прямых, ни в аналогах, добавляем в аналоги
            if not found_in_analogs:
                analog_products.append(product)

    return {
        "direct": direct_products,
        "analogs": analog_products,
        "rossko_data": rossko_response
    }


@router.get("/search-used-parts")
async def search_used_parts(
    q: str,
    debug: bool = False,  # Параметр для отладки без фильтров
    db: Session = Depends(get_db)
):
    """
    Комплексный поиск б/у запчастей:
    1. Сначала через ROSSKO API (артикулы + аналоги)
    2. Прямой поиск по артикулу и названию в базе данных
    3. Нормализация пробелов для гибкого поиска
    """
    trimmed_query = q.strip()
    if not trimmed_query:
        return {
            "available_parts": [],
            "analog_parts": [],
            "rossko_data": None
        }

    from sqlalchemy import func

    # Нормализуем поисковый запрос (убираем пробелы)
    normalized_query = trimmed_query.replace(" ", "").lower()

    # === ШАГ 1: Поиск через ROSSKO API ===
    rossko_response = None
    rossko_partnumbers = set()
    rossko_names = set()
    direct_partnumbers = set()
    analog_partnumbers = set()

    try:
        rossko_request = SearchRequest(
            text=trimmed_query,
            delivery_id=rossko_delivery_id,
            address_id=rossko_address_id
        )
        rossko_response = await rossko_search(rossko_request, db)

        # Извлекаем артикулы и названия из ROSSKO
        def extract_from_rossko(parts):
            if not parts:
                return
            for part in parts:
                pn = (part.get("partnumber") or "").strip()
                if pn:
                    rossko_partnumbers.add(pn.upper())

                name = (part.get("name") or "").strip()
                if name:
                    rossko_names.add(name)

                crosses = part.get("crosses") or {}
                cross_parts = crosses.get("Part") or []
                if not isinstance(cross_parts, list):
                    cross_parts = [cross_parts]
                extract_from_rossko(cross_parts)

        parts_list = (
            rossko_response
            .get("PartsList", {})
            .get("Part", [])
        )
        if not isinstance(parts_list, list):
            parts_list = [parts_list]

        extract_from_rossko(parts_list)

        # Определяем прямые совпадения и аналоги
        for part in parts_list:
            pn = (part.get("partnumber") or "").strip()
            if pn:
                direct_partnumbers.add(pn.upper())

            crosses = part.get("crosses") or {}
            cross_parts = crosses.get("Part") or []
            if not isinstance(cross_parts, list):
                cross_parts = [cross_parts]
            for cross_part in cross_parts:
                cross_pn = (cross_part.get("partnumber") or "").strip()
                if cross_pn:
                    analog_partnumbers.add(cross_pn.upper())

    except Exception as e:
        print(f"ROSSKO search error: {str(e)}")
        # Продолжаем без ROSSKO данных

    # === ШАГ 2: Прямой поиск в базе данных ===
    all_search_terms = set()
    all_search_terms.add(trimmed_query.upper())  # Оригинальный запрос
    all_search_terms.add(normalized_query.upper())  # Без пробелов

    # Добавляем все варианты артикулов из ROSSKO
    for pn in rossko_partnumbers:
        all_search_terms.update(get_partnumber_variants(pn))

    # Также добавляем варианты от оригинального запроса
    all_search_terms.update(get_partnumber_variants(trimmed_query))

    # Добавляем нормализованные версии для расширенного поиска
    query_normalized = normalize_partnumber(trimmed_query)
    if query_normalized:
        all_search_terms.add(query_normalized)

    # 🔍 ПРОСТОЙ И НАДЕЖНЫЙ ПОИСК: Пошаговый подход с отладкой
    from sqlalchemy import or_, and_

    # Отладка: найдем все запчасти с похожими артикулами (и новые, и б/у)
    debug_similar_articles = db.query(ProductModel).filter(
        or_(
            ProductModel.article.ilike("%P85020%"),
            ProductModel.article.ilike("%P 85020%"),
            ProductModel.article.ilike("%P 85 020%"),
            ProductModel.article.ilike("%P%85%020%")
        )
    ).limit(20).all()

    debug_similar_list = [{"id": p.id, "article": p.article, "name": p.name, "quantity": p.quantity, "is_new": p.is_new} for p in debug_similar_articles]

    # ШАГ 1: Простой поиск по артикулам (все варианты)
    article_conditions = []
    for term in all_search_terms:
        if term and len(term.strip()) > 0:
            article_conditions.append(ProductModel.article == term)
            article_conditions.append(ProductModel.article.ilike(f"%{term}%"))

    # Добавляем поиск по нормализованным артикулам
    if query_normalized:
        # Создаем условие для поиска по нормализованным артикулам в базе
        # Используем функцию замены для имитации нормализации в SQL
        normalized_condition = func.replace(func.replace(func.replace(func.upper(ProductModel.article), '-', ''), ' ', ''), '.', '') == query_normalized
        article_conditions.append(normalized_condition)

        # Также ищем частичное совпадение нормализованных артикулов
        article_conditions.append(
            func.replace(func.replace(func.replace(func.upper(ProductModel.article), '-', ''), ' ', ''), '.', '').ilike(f"%{query_normalized}%")
        )

    # СНАЧАЛА ИЩЕМ БЕЗ ФИЛЬТРОВ, чтобы увидеть все запчасти
    all_article_products = []
    if article_conditions:
        all_article_products = db.query(ProductModel).filter(
            or_(*article_conditions)
        ).limit(10).all()  # Ограничиваем для отладки

        print(f"DEBUG: Found {len(all_article_products)} total products by article (before filters)")
        for p in all_article_products[:3]:
            print(f"  - ID:{p.id} Article:'{p.article}' Name:'{p.name}' is_new:{p.is_new} quantity:{p.quantity}")

    # Теперь с фильтрами (или без них для отладки)
    article_products = []
    if article_conditions:
        query = db.query(ProductModel).filter(or_(*article_conditions))
        if not debug:  # Если не отладка, применяем фильтры
            query = query.filter(
                ProductModel.quantity > 0,
                ProductModel.is_new == False
            )
        article_products = query.all()

    print(f"DEBUG: Found {len(article_products)} products by article search (after filters)")

    # ШАГ 2: Простой поиск по названиям
    name_conditions = []

    # Добавляем поиск ТОЛЬКО по запросу пользователя (самое важное!)
    name_conditions.append(ProductModel.name.ilike(f"%{trimmed_query}%"))
    name_conditions.append(ProductModel.name.ilike(f"%{normalized_query}%"))
    name_conditions.append(func.replace(func.lower(ProductModel.name), " ", "").ilike(f"%{normalized_query}%"))

    # Также ищем по названиям из ROSSKO
    name_search_terms = []
    for rossko_name in rossko_names:
        if rossko_name:
            name_search_terms.extend([
                rossko_name,
                rossko_name.replace(" ", "").lower()
            ])

    for name_term in name_search_terms:
        if name_term and len(name_term.strip()) > 1:
            name_conditions.append(ProductModel.name.ilike(f"%{name_term}%"))
            # Поиск по нормализованным названиям
            name_conditions.append(
                func.replace(func.lower(ProductModel.name), " ", "").ilike(f"%{name_term}%")
            )

    print(f"DEBUG: Searching by names: {[trimmed_query, normalized_query] + name_search_terms}")

    # СНАЧАЛА ИЩЕМ БЕЗ ФИЛЬТРОВ
    all_name_products = []
    if name_conditions:
        all_name_products = db.query(ProductModel).filter(
            or_(*name_conditions)
        ).limit(10).all()

        print(f"DEBUG: Found {len(all_name_products)} total products by name (before filters)")
        for p in all_name_products[:3]:
            print(f"  - ID:{p.id} Article:'{p.article}' Name:'{p.name}' is_new:{p.is_new} quantity:{p.quantity}")

    # Теперь с фильтрами (или без них для отладки)
    name_products = []
    if name_conditions:
        query = db.query(ProductModel).filter(or_(*name_conditions))
        if not debug:  # Если не отладка, применяем фильтры
            query = query.filter(
                ProductModel.quantity > 0,
                ProductModel.is_new == False
            )
        name_products = query.all()

    print(f"DEBUG: Found {len(name_products)} products by name search (after filters)")

    # ШАГ 3: Объединяем результаты без дубликатов
    all_used_products = []
    seen_ids = set()

    # Сначала добавляем результаты поиска по артикулам (высокий приоритет)
    for product in article_products:
        if product.id not in seen_ids:
            all_used_products.append(product)
            seen_ids.add(product.id)

    # Затем добавляем результаты поиска по названиям (низкий приоритет)
    for product in name_products:
        if product.id not in seen_ids:
            all_used_products.append(product)
            seen_ids.add(product.id)

    print(f"DEBUG: Total unique products found: {len(all_used_products)}")

    # === ШАГ 3: Разделяем на "В наличии" и "Аналоги" ===
    def normalize_for_comparison(pn):
        """Нормализует артикул для сравнения (убирает пробелы, uppercase)"""
        return pn.replace(" ", "").upper() if pn else ""

    available_parts = []
    analog_parts = []

    # Нормализуем артикулы для сравнения
    normalized_direct = {normalize_for_comparison(pn) for pn in direct_partnumbers}
    normalized_analog = {normalize_for_comparison(pn) for pn in analog_partnumbers}

    for product in all_used_products:
        product_article_normalized = normalize_for_comparison(product.article)

        # Проверяем приоритет по ROSSKO данным (с нормализацией)
        if normalized_direct and product_article_normalized in normalized_direct:
            available_parts.append(product)
        elif normalized_analog and product_article_normalized in normalized_analog:
            analog_parts.append(product)
        else:
            # Если не нашли в ROSSKO, добавляем в "В наличии" (прямой поиск)
            available_parts.append(product)

    # Отладочная информация
    debug_info = {
        "original_query": trimmed_query,
        "normalized_query": normalized_query,
        "debug_mode": debug,
        "rossko_partnumbers": list(rossko_partnumbers),
        "all_search_terms": list(all_search_terms),
        "article_products_found": len(article_products),
        "name_products_found": len(name_products),
        "total_products_found": len(all_used_products),
        "available_parts_count": len(available_parts),
        "analog_parts_count": len(analog_parts),
        "similar_articles_in_db": debug_similar_list
    }

    print(f"DEBUG search_used_parts: {debug_info}")
    print(f"DEBUG article products: {[(p.id, p.article, p.name) for p in article_products[:3]]}")
    print(f"DEBUG name products: {[(p.id, p.article, p.name) for p in name_products[:3]]}")
    print(f"DEBUG final products: {[(p.id, p.article, p.name) for p in all_used_products[:5]]}")

    return {
        "available_parts": available_parts,
        "analog_parts": analog_parts,
        "rossko_data": rossko_response,
        "debug_info": debug_info
    }