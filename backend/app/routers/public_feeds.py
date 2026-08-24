import logging
from email.utils import format_datetime

from fastapi import APIRouter, Depends, Response
from sqlalchemy.orm import Session

from app.db.database import get_db
from app.utils.yandex_integration_db import get_or_create_yandex_integration
from app.services.yandex_feed_xml_service import generate_used_yml_feed
from app.services.sitemap_service import (
    build_fallback_sitemap_index_xml,
    build_sitemap_index_xml,
    get_new_brands_sitemap_snapshot,
    get_new_categories_sitemap_snapshot,
    get_new_parts_sitemap_page_snapshot,
    get_new_parts_sitemap_snapshot,
    get_products_sitemap_snapshot,
    get_used_brands_sitemap_snapshot,
    get_used_categories_sitemap_snapshot,
    get_used_geo_sitemap_snapshot,
    latest_sitemap_generated_at,
)
from app.services.yandex_feed_xml_service import _resolve_site_origin

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/feeds", tags=["Public feeds"])

_SITEMAP_CACHE_HEADERS = {"Cache-Control": "public, max-age=3600"}
_SITEMAP_MEDIA_TYPE = "application/xml; charset=utf-8"


def _xml_response(content: str, *, last_modified=None) -> Response:
    headers = dict(_SITEMAP_CACHE_HEADERS)
    if last_modified is not None:
        headers["Last-Modified"] = format_datetime(last_modified, usegmt=True)
    return Response(content=content, media_type=_SITEMAP_MEDIA_TYPE, headers=headers)


@router.get("/yandex/used.yml")
def public_yandex_used_feed(db: Session = Depends(get_db)):
    row = get_or_create_yandex_integration(db)
    payload = generate_used_yml_feed(
        db,
        preferred_host_url=row.host_url,
        condition_type=row.used_condition_type,
        condition_reason=row.used_condition_reason,
    )
    return Response(content=payload.xml, media_type="application/xml")


@router.get("/sitemap-products.xml")
def public_products_sitemap(db: Session = Depends(get_db)):
    try:
        row = get_or_create_yandex_integration(db)
        snapshot = get_products_sitemap_snapshot(db, preferred_host_url=row.host_url)
        return _xml_response(snapshot.xml_content, last_modified=snapshot.generated_at)
    except Exception as exc:
        logger.exception("Failed to serve products sitemap: %s", exc)
        site_origin = _resolve_site_origin(None)
        try:
            row = get_or_create_yandex_integration(db)
            site_origin = _resolve_site_origin(row.host_url)
        except Exception:
            pass
        xml = (
            '<?xml version="1.0" encoding="UTF-8"?>\n'
            '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n'
            "</urlset>\n"
        )
        return _xml_response(xml)


@router.api_route("/sitemap-new-parts.xml", methods=["GET", "HEAD"])
def public_new_parts_sitemap(db: Session = Depends(get_db)):
    try:
        row = get_or_create_yandex_integration(db)
        snapshot = get_new_parts_sitemap_snapshot(db, preferred_host_url=row.host_url)
        return _xml_response(snapshot.xml_content, last_modified=snapshot.generated_at)
    except Exception as exc:
        logger.exception("Failed to serve new parts sitemap: %s", exc)
        xml = (
            '<?xml version="1.0" encoding="UTF-8"?>\n'
            '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n'
            "</urlset>\n"
        )
        return _xml_response(xml)


@router.api_route("/sitemap-new-parts-{page}.xml", methods=["GET", "HEAD"])
def public_new_parts_sitemap_page(page: int, db: Session = Depends(get_db)):
    try:
        row = get_or_create_yandex_integration(db)
        snapshot = get_new_parts_sitemap_page_snapshot(
            db,
            page,
            preferred_host_url=row.host_url,
        )
        return _xml_response(snapshot.xml_content, last_modified=snapshot.generated_at)
    except ValueError:
        xml = (
            '<?xml version="1.0" encoding="UTF-8"?>\n'
            '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n'
            "</urlset>\n"
        )
        return _xml_response(xml)
    except Exception as exc:
        logger.exception("Failed to serve new parts sitemap page %s: %s", page, exc)
        xml = (
            '<?xml version="1.0" encoding="UTF-8"?>\n'
            '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n'
            "</urlset>\n"
        )
        return _xml_response(xml)


@router.get("/sitemap-new-brands.xml")
def public_new_brands_sitemap(db: Session = Depends(get_db)):
    try:
        row = get_or_create_yandex_integration(db)
        snapshot = get_new_brands_sitemap_snapshot(db, preferred_host_url=row.host_url)
        return _xml_response(snapshot.xml_content, last_modified=snapshot.generated_at)
    except Exception as exc:
        logger.exception("Failed to serve new brands sitemap: %s", exc)
        xml = (
            '<?xml version="1.0" encoding="UTF-8"?>\n'
            '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n'
            "</urlset>\n"
        )
        return _xml_response(xml)


@router.get("/sitemap-new-categories.xml")
def public_new_categories_sitemap(db: Session = Depends(get_db)):
    try:
        row = get_or_create_yandex_integration(db)
        snapshot = get_new_categories_sitemap_snapshot(db, preferred_host_url=row.host_url)
        return _xml_response(snapshot.xml_content, last_modified=snapshot.generated_at)
    except Exception as exc:
        logger.exception("Failed to serve new categories sitemap: %s", exc)
        xml = (
            '<?xml version="1.0" encoding="UTF-8"?>\n'
            '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n'
            "</urlset>\n"
        )
        return _xml_response(xml)


@router.get("/sitemap-used-brands.xml")
def public_used_brands_sitemap(db: Session = Depends(get_db)):
    try:
        row = get_or_create_yandex_integration(db)
        snapshot = get_used_brands_sitemap_snapshot(db, preferred_host_url=row.host_url)
        return _xml_response(snapshot.xml_content, last_modified=snapshot.generated_at)
    except Exception as exc:
        logger.exception("Failed to serve used brands sitemap: %s", exc)
        xml = (
            '<?xml version="1.0" encoding="UTF-8"?>\n'
            '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n'
            "</urlset>\n"
        )
        return _xml_response(xml)


@router.get("/sitemap-used-categories.xml")
def public_used_categories_sitemap(db: Session = Depends(get_db)):
    try:
        row = get_or_create_yandex_integration(db)
        snapshot = get_used_categories_sitemap_snapshot(db, preferred_host_url=row.host_url)
        return _xml_response(snapshot.xml_content, last_modified=snapshot.generated_at)
    except Exception as exc:
        logger.exception("Failed to serve used categories sitemap: %s", exc)
        xml = (
            '<?xml version="1.0" encoding="UTF-8"?>\n'
            '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n'
            "</urlset>\n"
        )
        return _xml_response(xml)


@router.get("/sitemap-used-geo.xml")
def public_used_geo_sitemap(db: Session = Depends(get_db)):
    try:
        row = get_or_create_yandex_integration(db)
        snapshot = get_used_geo_sitemap_snapshot(db, preferred_host_url=row.host_url)
        return _xml_response(snapshot.xml_content, last_modified=snapshot.generated_at)
    except Exception as exc:
        logger.exception("Failed to serve used geo sitemap: %s", exc)
        xml = (
            '<?xml version="1.0" encoding="UTF-8"?>\n'
            '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n'
            "</urlset>\n"
        )
        return _xml_response(xml)


@router.get("/sitemap.xml")
def public_sitemap_index(db: Session = Depends(get_db)):
    site_origin = _resolve_site_origin(None)
    try:
        row = get_or_create_yandex_integration(db)
        site_origin = _resolve_site_origin(row.host_url)
        products_snapshot = get_products_sitemap_snapshot(db, preferred_host_url=row.host_url)
        new_parts_snapshot = get_new_parts_sitemap_snapshot(db, preferred_host_url=row.host_url)
        new_brands_snapshot = get_new_brands_sitemap_snapshot(db, preferred_host_url=row.host_url)
        new_categories_snapshot = get_new_categories_sitemap_snapshot(db, preferred_host_url=row.host_url)
        used_brands_snapshot = get_used_brands_sitemap_snapshot(db, preferred_host_url=row.host_url)
        used_categories_snapshot = get_used_categories_sitemap_snapshot(db, preferred_host_url=row.host_url)
        used_geo_snapshot = get_used_geo_sitemap_snapshot(db, preferred_host_url=row.host_url)
        xml = build_sitemap_index_xml(
            site_origin,
            products_generated_at=products_snapshot.generated_at,
            new_parts_generated_at=new_parts_snapshot.generated_at,
            new_brands_generated_at=new_brands_snapshot.generated_at,
            new_categories_generated_at=new_categories_snapshot.generated_at,
            used_brands_generated_at=used_brands_snapshot.generated_at,
            used_categories_generated_at=used_categories_snapshot.generated_at,
            used_geo_generated_at=used_geo_snapshot.generated_at,
        )
        last_modified = latest_sitemap_generated_at(
            products_snapshot.generated_at,
            new_parts_snapshot.generated_at,
            new_brands_snapshot.generated_at,
            new_categories_snapshot.generated_at,
            used_brands_snapshot.generated_at,
            used_categories_snapshot.generated_at,
            used_geo_snapshot.generated_at,
        )
        return _xml_response(xml, last_modified=last_modified)
    except Exception as exc:
        logger.exception("Failed to serve sitemap index, returning fallback: %s", exc)
        xml = build_fallback_sitemap_index_xml(site_origin)
        return _xml_response(xml)
