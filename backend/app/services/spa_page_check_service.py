from __future__ import annotations

import re
from urllib.parse import unquote, urlparse

from sqlalchemy.orm import Session

from app.models.organization import Organization as OrganizationModel
from app.models.product import Product as ProductModel

PART_PATH_RE = re.compile(r"^/part/(?P<product_id>\d+)(?:[-/]|$)")
ORG_DETAIL_PATH_RE = re.compile(r"^/organizations/(?P<org_id>[A-Za-z0-9_-]+)$")

SPA_ROUTE_PREFIXES = (
    "/auth",
    "/autoparts",
    "/catalog",
    "/organizations",
    "/about",
    "/delivery",
    "/reviews",
    "/payment",
    "/autoservice",
    "/cart",
    "/order-reg",
    "/my-parts",
    "/part/",
    "/product-not-found",
    "/dashboard",
    "/profile",
    "/clients",
    "/vehicles",
    "/purchases",
    "/sales",
    "/stock-in",
    "/stock-out",
    "/warehouse-sales",
    "/finance",
    "/settings",
    "/chats",
    "/moderation",
    "/sellers",
    "/admin-settings",
    "/admin",
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


def _matches_spa_route(path: str) -> bool:
    if path == "/":
        return True
    return any(path == prefix.rstrip("/") or path.startswith(prefix) for prefix in SPA_ROUTE_PREFIXES)


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


def is_spa_page_available(db: Session, raw_path: str) -> bool:
    path = _normalize_path(raw_path)

    if not _matches_spa_route(path):
        return False

    part_match = PART_PATH_RE.match(path)
    if part_match:
        product_id = int(part_match.group("product_id"))
        return _product_exists(db, product_id)

    org_match = ORG_DETAIL_PATH_RE.match(path)
    if org_match:
        return _organization_exists(db, org_match.group("org_id"))

    return True
