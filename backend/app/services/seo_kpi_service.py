from __future__ import annotations

import datetime as dt
from typing import Any

from sqlalchemy.orm import Session

from app.services.google_search_console_service import (
    GoogleApiError,
    get_valid_access_token as get_google_access_token,
    list_sites,
    search_analytics_query,
)
from app.services.seo_semantics_service import classify_query_cluster
from app.services.sitemap_service import (
    count_active_brand_new_landings,
    count_active_new_part_cards,
    count_total_site_pages,
    count_working_catalog_products,
    get_new_parts_sitemap_cache_meta,
    get_products_sitemap_cache_meta,
)
from app.services.yandex_webmaster_service import (
    YandexApiError,
    get_all_search_queries_history,
    get_popular_search_queries,
    get_user,
    get_valid_access_token as get_yandex_access_token,
)
from app.utils.google_integration_db import get_or_create_google_integration
from app.utils.yandex_integration_db import get_or_create_yandex_integration


def _date_range(days: int) -> tuple[str, str]:
    end = dt.date.today()
    start = end - dt.timedelta(days=max(1, min(days, 90)))
    return start.isoformat(), end.isoformat()


def _safe_float(value: Any) -> float:
    try:
        return float(value or 0)
    except (TypeError, ValueError):
        return 0.0


def _aggregate_rows(rows: list[dict[str, Any]]) -> dict[str, float]:
    impressions = clicks = position_sum = 0.0
    position_count = 0
    for row in rows:
        impressions += _safe_float(row.get("impressions"))
        clicks += _safe_float(row.get("clicks"))
        pos = row.get("position")
        if pos is not None:
            position_sum += _safe_float(pos)
            position_count += 1
    ctr = (clicks / impressions * 100.0) if impressions > 0 else 0.0
    position = (position_sum / position_count) if position_count > 0 else 0.0
    return {
        "impressions": impressions,
        "clicks": clicks,
        "ctr": round(ctr, 2),
        "position": round(position, 1),
        "query_count": len(rows),
    }


def _normalize_gsc_rows(payload: dict) -> list[dict[str, Any]]:
    rows: list[dict[str, Any]] = []
    for row in payload.get("rows") or []:
        keys = row.get("keys") or []
        query_text = str(keys[0] if keys else "").strip()
        if not query_text:
            continue
        impressions = _safe_float(row.get("impressions"))
        clicks = _safe_float(row.get("clicks"))
        position = _safe_float(row.get("position"))
        ctr = (clicks / impressions * 100.0) if impressions > 0 else 0.0
        rows.append(
            {
                "query": query_text,
                "cluster": classify_query_cluster(query_text),
                "impressions": impressions,
                "clicks": clicks,
                "ctr": round(ctr, 2),
                "position": round(position, 1),
            }
        )
    return rows


def _normalize_yandex_rows(payload: dict) -> list[dict[str, Any]]:
    rows: list[dict[str, Any]] = []
    for item in payload.get("queries") or []:
        query_text = str(item.get("query_text") or "").strip()
        if not query_text:
            continue
        indicators = item.get("indicators") or {}
        impressions = _safe_float(indicators.get("TOTAL_SHOWS"))
        clicks = _safe_float(indicators.get("TOTAL_CLICKS"))
        position = _safe_float(indicators.get("AVG_SHOW_POSITION"))
        ctr = (clicks / impressions * 100.0) if impressions > 0 else 0.0
        rows.append(
            {
                "query": query_text,
                "cluster": classify_query_cluster(query_text),
                "impressions": impressions,
                "clicks": clicks,
                "ctr": round(ctr, 2),
                "position": round(position, 1),
            }
        )
    return rows


def _cluster_summary(rows: list[dict[str, Any]]) -> dict[str, dict[str, float]]:
    buckets: dict[str, list[dict[str, Any]]] = {"A": [], "B": [], "C": [], "D": [], "unknown": []}
    for row in rows:
        cluster = row.get("cluster") or "unknown"
        buckets.setdefault(cluster, []).append(row)
    return {cluster: _aggregate_rows(items) for cluster, items in buckets.items() if items}


def _pick_gsc_site_url(sites_payload: dict, preferred_host: str | None) -> str | None:
    entries = sites_payload.get("siteEntry") or []
    preferred = (preferred_host or "").strip().rstrip("/")
    if preferred and not preferred.startswith("http"):
        preferred = f"https://{preferred.lstrip('/')}"
    preferred_host_only = preferred.replace("https://", "").replace("http://", "").strip("/")
    for entry in entries:
        site_url = str(entry.get("siteUrl") or "").strip()
        if not site_url:
            continue
        if preferred and (
            site_url.rstrip("/") == preferred.rstrip("/")
            or preferred_host_only in site_url
        ):
            return site_url
    for entry in entries:
        permission = str(entry.get("permissionLevel") or "").lower()
        if permission in {"siteowner", "sitefulluser", "siterestricteduser"}:
            site_url = str(entry.get("siteUrl") or "").strip()
            if site_url:
                return site_url
    if entries:
        return str(entries[0].get("siteUrl") or "").strip() or None
    return None


def _sitemap_indexation_summary(db: Session) -> dict[str, object]:
    products_meta = get_products_sitemap_cache_meta(db)
    new_parts_meta = get_new_parts_sitemap_cache_meta(db)
    return {
        "total_pages": count_total_site_pages(db),
        "products_urls": int(products_meta.get("url_count") or 0),
        "new_parts_urls": int(new_parts_meta.get("url_count") or 0),
        "brand_landings": count_active_brand_new_landings(db),
        "working_products": count_working_catalog_products(db),
        "active_new_part_cards": count_active_new_part_cards(db),
        "note": "Indexed count доступен после подключения GSC/Вебмастера; здесь — URL в sitemap.",
    }


def build_seo_kpi_dashboard(db: Session, *, days: int = 14) -> dict[str, object]:
    start_date, end_date = _date_range(days)
    yandex_row = get_or_create_yandex_integration(db)
    google_row = get_or_create_google_integration(db)
    site_origin = (yandex_row.host_url or google_row.site_url or "https://svoygarage.ru").rstrip("/")

    result: dict[str, object] = {
        "period": {"start": start_date, "end": end_date, "days": days},
        "site_origin": site_origin,
        "sitemap": _sitemap_indexation_summary(db),
        "yandex": {"connected": bool(yandex_row.access_token_encrypted), "error": None, "totals": None, "clusters": {}, "top_queries": []},
        "google": {"connected": bool(google_row.access_token_encrypted), "error": None, "totals": None, "clusters": {}, "top_queries": []},
    }

    if yandex_row.access_token_encrypted and yandex_row.host_id:
        try:
            token = get_yandex_access_token(db, yandex_row)
            user_payload = get_user(token)
            user_id = int(user_payload.get("user_id"))
            popular = get_popular_search_queries(
                user_id,
                yandex_row.host_id,
                token,
                date_from=start_date,
                date_to=end_date,
                limit=500,
            )
            rows = _normalize_yandex_rows(popular)
            result["yandex"]["top_queries"] = sorted(rows, key=lambda r: r["impressions"], reverse=True)[:20]
            result["yandex"]["clusters"] = _cluster_summary(rows)
            result["yandex"]["totals"] = _aggregate_rows(rows)
        except YandexApiError as exc:
            result["yandex"]["error"] = str(exc)
    elif yandex_row.access_token_encrypted:
        result["yandex"]["error"] = "Не привязан host_id в Яндекс Вебмастере"

    if google_row.access_token_encrypted:
        try:
            token = get_google_access_token(db, google_row)
            sites_payload = list_sites(token)
            site_url = google_row.site_url or _pick_gsc_site_url(sites_payload, site_origin)
            if not site_url:
                raise GoogleApiError("Не найден сайт в Google Search Console")
            if google_row.site_url != site_url:
                google_row.site_url = site_url
                db.add(google_row)
                db.commit()
            payload = search_analytics_query(
                token,
                site_url,
                start_date=start_date,
                end_date=end_date,
                dimensions=["query"],
                row_limit=500,
            )
            rows = _normalize_gsc_rows(payload)
            result["google"]["site_url"] = site_url
            result["google"]["top_queries"] = sorted(rows, key=lambda r: r["impressions"], reverse=True)[:20]
            result["google"]["clusters"] = _cluster_summary(rows)
            result["google"]["totals"] = _aggregate_rows(rows)
        except GoogleApiError as exc:
            result["google"]["error"] = str(exc)

    return result
