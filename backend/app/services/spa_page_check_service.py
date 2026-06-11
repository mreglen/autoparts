from __future__ import annotations

import html
import re
from dataclasses import dataclass
from urllib.parse import unquote, urlparse

from sqlalchemy.orm import Session

from app.models.organization import Organization as OrganizationModel
from app.models.new_parts_seo_card import NewPartsSeoCard
from app.models.product import Product as ProductModel
from app.services.public_user_profile_service import (
    get_public_buyer_profile,
    get_public_seller_profile,
    get_public_user_profile,
)

PART_PATH_RE = re.compile(r"^/part/(?P<product_id>\d+)(?:[-/]|$)")

_NUM = r"\d+"
_ID = r"[^/]+"
_ORG = r"[A-Za-z0-9_-]+"
_PUBLIC_CODE = r"[A-Za-z0-9]{1,10}"
_LEGACY_CODE = r"[A-Z]\d{6}"


@dataclass(frozen=True)
class _RouteRule:
    pattern: re.Pattern[str]
    validator: str | None = None


# Маршруты синхронизированы с frontend/my-autoparts/src/App.js
_SPA_ROUTE_RULES: tuple[_RouteRule, ...] = (
    _RouteRule(re.compile(r"^/$")),
    _RouteRule(re.compile(r"^/auth$")),
    _RouteRule(re.compile(r"^/auth/password-reset$")),
    _RouteRule(re.compile(r"^/autoparts$")),
    _RouteRule(re.compile(r"^/autoparts/new/filters$")),
    _RouteRule(re.compile(r"^/autoparts/new$")),
    _RouteRule(re.compile(r"^/autoparts/new/brand/(?P<slug>[^/]+)$"), "brand_new_landing"),
    _RouteRule(re.compile(r"^/autoparts/new/category/(?P<slug>[^/]+)$"), "category_new_landing"),
    _RouteRule(re.compile(r"^/autoparts/used/brand/(?P<slug>[^/]+)$"), "brand_used_landing"),
    _RouteRule(re.compile(r"^/autoparts/used/category/(?P<slug>[^/]+)$"), "category_used_landing"),
    _RouteRule(re.compile(r"^/autoparts/used/geo/(?P<slug>[^/]+)$"), "geo_landing"),
    _RouteRule(re.compile(rf"^/autoparts/new/part/(?P<card_id>{_NUM})(?:[-/][^/]*)?$"), "new_part_card"),
    _RouteRule(re.compile(r"^/autoparts/used/filters$")),
    _RouteRule(re.compile(r"^/autoparts/used$")),
    _RouteRule(re.compile(r"^/catalog$")),
    _RouteRule(re.compile(r"^/about$")),
    _RouteRule(re.compile(r"^/privacy$")),
    _RouteRule(re.compile(r"^/personal-data-consent$")),
    _RouteRule(re.compile(r"^/offer$")),
    _RouteRule(re.compile(r"^/cookie-policy$")),
    _RouteRule(re.compile(r"^/delivery$")),
    _RouteRule(re.compile(r"^/payment$")),
    _RouteRule(re.compile(r"^/reviews$")),
    _RouteRule(re.compile(r"^/organizations$")),
    _RouteRule(re.compile(rf"^/organizations/(?P<org_id>{_ORG})$"), "organization"),
    _RouteRule(re.compile(rf"^/seller/part-card/(?P<part_id>{_NUM})$")),
    _RouteRule(re.compile(rf"^/users/(?P<public_code>{_PUBLIC_CODE})$"), "user"),
    _RouteRule(re.compile(rf"^/seller/(?P<public_code>{_LEGACY_CODE})$"), "seller"),
    _RouteRule(re.compile(rf"^/buyer/(?P<public_code>{_LEGACY_CODE})$"), "buyer"),
    _RouteRule(re.compile(r"^/cart$")),
    _RouteRule(re.compile(r"^/order-reg$")),
    _RouteRule(re.compile(r"^/cart/new/checkout$")),
    _RouteRule(re.compile(rf"^/cart/new/pay/(?P<session_id>{_ID})$")),
    _RouteRule(re.compile(r"^/my-parts/add$")),
    _RouteRule(re.compile(rf"^/my-parts/edit/(?P<part_id>{_NUM})$")),
    _RouteRule(re.compile(rf"^/part/(?P<product_id>{_NUM})(?:[-/][^/]*)?$"), "product"),
    _RouteRule(re.compile(r"^/product-not-found$")),
    _RouteRule(re.compile(r"^/dashboard$")),
    _RouteRule(re.compile(r"^/clients$")),
    _RouteRule(re.compile(r"^/profile$")),
    _RouteRule(re.compile(r"^/my-parts$")),
    _RouteRule(re.compile(rf"^/my-parts/resubmit/(?P<part_id>{_NUM})$")),
    _RouteRule(re.compile(rf"^/my-parts/edit-pending/(?P<part_id>{_NUM})$")),
    _RouteRule(re.compile(r"^/vehicles$")),
    _RouteRule(re.compile(r"^/vehicles/add$")),
    _RouteRule(re.compile(rf"^/vehicles/edit/(?P<vehicle_id>{_NUM})$")),
    _RouteRule(re.compile(r"^/purchases/orders$")),
    _RouteRule(re.compile(r"^/purchases/returns$")),
    _RouteRule(re.compile(r"^/sales/orders$")),
    _RouteRule(re.compile(r"^/sales/returns$")),
    _RouteRule(re.compile(r"^/stock-in$")),
    _RouteRule(re.compile(r"^/stock-out$")),
    _RouteRule(re.compile(r"^/warehouse-sales$")),
    _RouteRule(re.compile(r"^/finance$")),
    _RouteRule(re.compile(r"^/settings/employees$")),
    _RouteRule(re.compile(r"^/chats$")),
    _RouteRule(re.compile(rf"^/chats/(?P<chat_id>{_ID})$")),
    _RouteRule(re.compile(r"^/settings/storage-addresses$")),
    _RouteRule(re.compile(r"^/settings/organization$")),
    _RouteRule(re.compile(r"^/settings/printers$")),
    _RouteRule(re.compile(r"^/settings/integration$")),
    _RouteRule(re.compile(r"^/settings/integration/avito$")),
    _RouteRule(re.compile(r"^/settings/integration/avito/nomenclature$")),
    _RouteRule(re.compile(r"^/settings/integration/drom$")),
    _RouteRule(re.compile(r"^/settings/integration/drom/nomenclature$")),
    _RouteRule(re.compile(r"^/moderation/pending-sellers$")),
    _RouteRule(re.compile(r"^/moderation/products$")),
    _RouteRule(re.compile(rf"^/moderation/products/(?P<organization_id>{_ORG})$")),
    _RouteRule(re.compile(r"^/sellers$")),
    _RouteRule(re.compile(rf"^/sellers/(?P<seller_id>{_NUM})/workspace$")),
    _RouteRule(re.compile(r"^/admin-settings$")),
    _RouteRule(re.compile(r"^/admin/analytics$")),
    _RouteRule(re.compile(r"^/admin/audit-log$")),
    _RouteRule(re.compile(r"^/admin/users$")),
    _RouteRule(re.compile(r"^/admin/rossko$")),
)


def _normalize_path(raw_path: str) -> str:
    value = unquote((raw_path or "").strip())
    if not value:
        return "/"
    parsed = urlparse(value)
    path = parsed.path if parsed.scheme or parsed.netloc else value
    path = path.split("?", 1)[0].split("#", 1)[0]
    if not path.startswith("/"):
        path = f"/{path}"
    if len(path) > 1 and path.endswith("/"):
        path = path.rstrip("/")
    return path or "/"


def _product_exists(db: Session, product_id: int) -> bool:
    row = (
        db.query(ProductModel.id)
        .filter(ProductModel.id == product_id, ProductModel.quantity > 0)
        .first()
    )
    return row is not None


def _organization_exists(db: Session, org_id: str) -> bool:
    row = db.query(OrganizationModel.id).filter(OrganizationModel.id == org_id).first()
    return row is not None


def _new_part_card_exists(db: Session, card_id: int) -> bool:
    row = (
        db.query(NewPartsSeoCard.id)
        .filter(NewPartsSeoCard.id == card_id, NewPartsSeoCard.is_active.is_(True))
        .first()
    )
    return row is not None


def _match_spa_route(path: str) -> tuple[_RouteRule, re.Match[str]] | None:
    for rule in _SPA_ROUTE_RULES:
        match = rule.pattern.match(path)
        if match:
            return rule, match
    return None


def _validate_route(db: Session, rule: _RouteRule, match: re.Match[str]) -> bool:
    if not rule.validator:
        return True

    if rule.validator == "product":
        return _product_exists(db, int(match.group("product_id")))
    if rule.validator == "organization":
        return _organization_exists(db, match.group("org_id"))
    if rule.validator == "seller":
        return get_public_seller_profile(db, match.group("public_code")) is not None
    if rule.validator == "buyer":
        return get_public_buyer_profile(db, match.group("public_code")) is not None
    if rule.validator == "user":
        return get_public_user_profile(db, match.group("public_code")) is not None
    if rule.validator == "new_part_card":
        return _new_part_card_exists(db, int(match.group("card_id")))
    if rule.validator == "brand_new_landing":
        from app.services.seo_landing_page_service import resolve_brand_new_landing

        return resolve_brand_new_landing(db, match.group("slug")) is not None
    if rule.validator == "category_new_landing":
        from app.services.seo_landing_page_service import resolve_category_new_landing

        return resolve_category_new_landing(db, match.group("slug")) is not None
    if rule.validator == "brand_used_landing":
        from app.services.seo_landing_page_service import resolve_brand_used_landing

        return resolve_brand_used_landing(db, match.group("slug")) is not None
    if rule.validator == "category_used_landing":
        from app.services.seo_landing_page_service import resolve_category_used_landing

        return resolve_category_used_landing(db, match.group("slug")) is not None
    if rule.validator == "geo_landing":
        from app.services.seo_landing_page_service import resolve_geo_landing

        return resolve_geo_landing(db, match.group("slug")) is not None

    return False


def is_spa_page_available(db: Session, raw_path: str) -> bool:
    path = _normalize_path(raw_path)
    matched = _match_spa_route(path)
    if matched is None:
        return False
    rule, match = matched
    return _validate_route(db, rule, match)


def render_not_found_html(*, title: str = "404 — страница не найдена | Свой Гараж") -> str:
    safe_title = html.escape(title, quote=True)
    return f"""<!DOCTYPE html>
<html lang="ru">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <meta name="robots" content="noindex, nofollow" />
  <title>{safe_title}</title>
</head>
<body>
  <main>
    <h1>404 — страница не найдена</h1>
    <p>Запрошенная страница не существует или была удалена.</p>
    <p><a href="/">На главную</a></p>
  </main>
</body>
</html>
"""
