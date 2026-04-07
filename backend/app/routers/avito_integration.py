import json
import logging
import re
import uuid
from io import BytesIO
from pathlib import Path
from typing import Any, Optional

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile, status
from openpyxl import load_workbook
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.core.auth import get_current_user
from app.core.config import settings
from app.db.database import get_db
from app.models.organization import Organization as OrganizationModel
from app.models.organization_avito_autoload_cache import OrganizationAvitoAutoloadCache
from app.models.organization_avito_integration import OrganizationAvitoIntegration
from app.models.product import Product as ProductModel, ProductPhoto, ProductVideo
from app.models.product_avito_listing_link import ProductAvitoListingLink
from app.models.stock_in import StockIn as StockInModel
from app.models.storage_location import StorageLocation as StorageLocationModel
from app.models.user import User as UserModel
from app.schemas.avito_integration import (
    AvitoAutoloadImportRequest,
    AvitoAutoloadImportResponse,
    AvitoAutoloadApplyActionRequest,
    AvitoAutoloadExportRequest,
    AvitoAutoloadExportResponse,
    AvitoAutoloadPublishResponse,
    AvitoAutoloadUploadResponse,
    AvitoCredentialsResponse,
    AvitoCredentialsUpdate,
    AvitoLastAutoloadSnapshot,
)
from app.services import avito_api as avito_api_svc
from app.services.avito_autoload_xlsx import parse_and_validate_avito_autoload, upsert_products_to_avito_autoload
from app.utils.avito_crypto import decrypt_secret, encrypt_secret

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/organizations", tags=["Avito"])

SAFE_NAME_RE = re.compile(r"[^A-Za-z0-9._-]+")
ACTION_HEADERS = ("Действие", "Action")
ACTION_VALUES = {
    "publish": "Опубликовать объявление",
    "unpublish": "Снять с публикации",
    "delete": "Удалить объявление",
}


def _remove_existing_avito_xlsx_files(base_dir: Path) -> None:
    """В каталоге организации остаётся не больше одного XLSX — старые удаляем перед новой загрузкой."""
    if not base_dir.is_dir():
        return
    for p in base_dir.iterdir():
        if p.is_file() and p.suffix.lower() == ".xlsx":
            try:
                p.unlink()
            except OSError as e:
                logger.warning("Не удалось удалить старый файл автозагрузки %s: %s", p, e)


def _ensure_org_access(user: UserModel, org_id: str) -> None:
    if user.organization_id != org_id and not user.is_admin:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Нет доступа к организации")


def _org_exists(db: Session, org_id: str) -> OrganizationModel:
    org = db.query(OrganizationModel).filter(OrganizationModel.id == org_id).first()
    if not org:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Организация не найдена")
    return org


def _json_loads(raw: Optional[str], default: Any) -> Any:
    if not raw:
        return default
    try:
        return json.loads(raw)
    except json.JSONDecodeError:
        return default


def _get_last_autoload(db: Session, org_id: str) -> Optional[AvitoLastAutoloadSnapshot]:
    cache = (
        db.query(OrganizationAvitoAutoloadCache)
        .filter(OrganizationAvitoAutoloadCache.organization_id == org_id)
        .first()
    )
    if not cache:
        return None
    return AvitoLastAutoloadSnapshot(
        saved_path=cache.saved_path,
        items=_json_loads(cache.items_json, []),
        local_validation_ok=bool(cache.local_validation_ok),
        local_errors=_json_loads(cache.local_errors_json, []),
        sheets_parsed=_json_loads(cache.sheets_parsed_json, []),
        avito_upload=_json_loads(cache.avito_upload_json, None) if cache.avito_upload_json else None,
        avito_upload_status=cache.avito_upload_status,
        avito_report=_json_loads(cache.avito_report_json, None) if cache.avito_report_json else None,
        avito_token_error=cache.avito_token_error,
        updated_at=cache.updated_at.isoformat() if cache.updated_at else None,
    )


def _save_autoload_cache(
    db: Session,
    org_id: str,
    *,
    saved_path: str,
    items: list,
    local_validation_ok: bool,
    local_errors: list,
    sheets_parsed: list,
    avito_upload: Any,
    avito_upload_status: Optional[int],
    avito_report: Any,
    avito_token_error: Optional[str],
) -> None:
    row = (
        db.query(OrganizationAvitoAutoloadCache)
        .filter(OrganizationAvitoAutoloadCache.organization_id == org_id)
        .first()
    )
    if not row:
        row = OrganizationAvitoAutoloadCache(organization_id=org_id)
        db.add(row)
    row.saved_path = saved_path
    row.items_json = json.dumps(items, ensure_ascii=False)
    row.local_validation_ok = local_validation_ok
    row.local_errors_json = json.dumps(local_errors, ensure_ascii=False)
    row.sheets_parsed_json = json.dumps(sheets_parsed, ensure_ascii=False)
    row.avito_upload_json = json.dumps(avito_upload, ensure_ascii=False) if avito_upload is not None else None
    row.avito_upload_status = avito_upload_status
    row.avito_report_json = json.dumps(avito_report, ensure_ascii=False) if avito_report is not None else None
    row.avito_token_error = avito_token_error
    db.commit()


def _next_internal_code(db: Session) -> str:
    # В модели Product internal_code уникален глобально (не по organization_id),
    # поэтому подбираем код по всей таблице products.
    existing = db.query(ProductModel.internal_code).all()
    existing_codes = {r[0] for r in existing}
    idx = 1
    while True:
        candidate = f"{idx:05d}"
        if candidate not in existing_codes:
            return candidate
        idx += 1


def _has_avito_integration(db: Session, org_id: str) -> bool:
    row = db.query(OrganizationAvitoIntegration).filter(
        OrganizationAvitoIntegration.organization_id == org_id
    ).first()
    if not row:
        return False
    return bool(row.client_id and row.client_secret_encrypted and row.avito_user_id)


def _resolve_saved_autoload_file(db: Session, org_id: str) -> tuple[Path, str]:
    cache = (
        db.query(OrganizationAvitoAutoloadCache)
        .filter(OrganizationAvitoAutoloadCache.organization_id == org_id)
        .first()
    )
    if cache and cache.saved_path:
        rel_path = cache.saved_path
        xlsx_path = Path(__file__).resolve().parents[2] / rel_path.lstrip("/")
        if xlsx_path.is_file():
            return xlsx_path, rel_path

    base_dir = Path(__file__).resolve().parents[2] / "uploads" / "avito" / org_id
    base_dir.mkdir(parents=True, exist_ok=True)
    dest_name = f"autoload_{uuid.uuid4().hex[:8]}.xlsx"
    xlsx_path = base_dir / dest_name
    rel_path = f"/uploads/avito/{org_id}/{dest_name}"
    return xlsx_path, rel_path


async def _push_file_to_avito(db: Session, org_id: str, filename: str, file_bytes: bytes) -> tuple[Any, Any, Any, Any]:
    row = db.query(OrganizationAvitoIntegration).filter(
        OrganizationAvitoIntegration.organization_id == org_id
    ).first()
    avito_upload = None
    avito_upload_status = None
    avito_report = None
    avito_token_error = None
    if not row:
        return avito_upload, avito_upload_status, avito_report, avito_token_error

    try:
        sec = decrypt_secret(row.client_secret_encrypted)
        token = await avito_api_svc.fetch_access_token(row.client_id, sec)
        avito_upload_status, avito_upload = await avito_api_svc.upload_autoload_xlsx(
            token, filename, file_bytes
        )
        if avito_upload_status in (200, 201):
            avito_report = await avito_api_svc.get_last_completed_report_v3(token)
            if avito_report is None:
                avito_report = await avito_api_svc.get_last_report_v1(
                    token, int(row.avito_user_id)
                )
    except Exception as e:
        logger.exception("Avito API error")
        avito_token_error = str(e)

    return avito_upload, avito_upload_status, avito_report, avito_token_error


@router.get("/{org_id}/avito/credentials", response_model=AvitoCredentialsResponse)
def get_avito_credentials(
    org_id: str,
    db: Session = Depends(get_db),
    current_user: UserModel = Depends(get_current_user),
):
    _ensure_org_access(current_user, org_id)
    _org_exists(db, org_id)
    row = db.query(OrganizationAvitoIntegration).filter(
        OrganizationAvitoIntegration.organization_id == org_id
    ).first()
    last = _get_last_autoload(db, org_id)
    if not row:
        return AvitoCredentialsResponse(
            client_id="",
            avito_user_id=None,
            client_secret_configured=False,
            last_autoload=last,
        )
    return AvitoCredentialsResponse(
        client_id=row.client_id,
        avito_user_id=int(row.avito_user_id),
        client_secret_configured=True,
        last_autoload=last,
    )


@router.post("/{org_id}/avito/autoload/export", response_model=AvitoAutoloadExportResponse)
async def export_products_to_avito_autoload(
    org_id: str,
    body: AvitoAutoloadExportRequest,
    db: Session = Depends(get_db),
    current_user: UserModel = Depends(get_current_user),
):
    _ensure_org_access(current_user, org_id)
    _org_exists(db, org_id)
    if not _has_avito_integration(db, org_id):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Интеграция Авито не настроена")

    requested_ids = list(dict.fromkeys(body.product_ids))
    products = (
        db.query(ProductModel)
        .filter(
            ProductModel.organization_id == org_id,
            ProductModel.id.in_(requested_ids),
        )
        .all()
    )
    by_id = {p.id: p for p in products}
    export_rows: list[dict[str, Any]] = []
    for product_id in requested_ids:
        product = by_id.get(product_id)
        if not product:
            continue
        photos = [ph.photo_url for ph in (product.photos or []) if ph.photo_url]
        avito_link = db.query(ProductAvitoListingLink).filter(
            ProductAvitoListingLink.organization_id == org_id,
            ProductAvitoListingLink.product_id == product.id,
        ).first()
        export_rows.append(
            {
                "id": product.id,
                "article": product.article,
                "brand": product.brand,
                "is_new": product.is_new,
                "price": product.price,
                "name": product.name,
                "description": product.description,
                "quantity": product.quantity,
                "photos": photos,
                "avito_id": avito_link.avito_ad_id if avito_link else "",
            }
        )
    if not export_rows:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Товары не найдены для экспорта")

    xlsx_path, rel_path = _resolve_saved_autoload_file(db, org_id)
    existing_bytes = xlsx_path.read_bytes() if xlsx_path.is_file() else None
    merged_bytes = upsert_products_to_avito_autoload(
        existing_bytes,
        export_rows,
        public_base_url=(settings.PUBLIC_BASE_URL or settings.BASE_URL or "").strip(),
    )
    xlsx_path.write_bytes(merged_bytes)
    parsed = parse_and_validate_avito_autoload(merged_bytes)
    _save_autoload_cache(
        db,
        org_id,
        saved_path=rel_path,
        items=parsed.items,
        local_validation_ok=parsed.local_ok,
        local_errors=parsed.local_errors,
        sheets_parsed=parsed.sheets_parsed,
        avito_upload=None,
        avito_upload_status=None,
        avito_report=None,
        avito_token_error=None,
    )
    return AvitoAutoloadExportResponse(
        saved_path=rel_path,
        items=parsed.items,
        local_validation_ok=parsed.local_ok,
        local_errors=parsed.local_errors,
        sheets_parsed=parsed.sheets_parsed,
        exported_count=len(export_rows),
    )


@router.post("/{org_id}/avito/autoload/export/{product_id}", response_model=AvitoAutoloadExportResponse)
async def export_single_product_to_avito_autoload(
    org_id: str,
    product_id: int,
    db: Session = Depends(get_db),
    current_user: UserModel = Depends(get_current_user),
):
    return await export_products_to_avito_autoload(
        org_id=org_id,
        body=AvitoAutoloadExportRequest(product_ids=[product_id]),
        db=db,
        current_user=current_user,
    )


@router.put("/{org_id}/avito/credentials", response_model=AvitoCredentialsResponse)
def put_avito_credentials(
    org_id: str,
    body: AvitoCredentialsUpdate,
    db: Session = Depends(get_db),
    current_user: UserModel = Depends(get_current_user),
):
    _ensure_org_access(current_user, org_id)
    _org_exists(db, org_id)

    row = db.query(OrganizationAvitoIntegration).filter(
        OrganizationAvitoIntegration.organization_id == org_id
    ).first()

    secret_in = (body.client_secret or "").strip()
    if row is None:
        if not secret_in:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="При первом сохранении укажите client_secret",
            )
        row = OrganizationAvitoIntegration(
            organization_id=org_id,
            avito_user_id=body.avito_user_id,
            client_id=body.client_id.strip(),
            client_secret_encrypted=encrypt_secret(secret_in),
        )
        db.add(row)
    else:
        row.client_id = body.client_id.strip()
        row.avito_user_id = body.avito_user_id
        if secret_in:
            row.client_secret_encrypted = encrypt_secret(secret_in)

    db.commit()
    db.refresh(row)
    last = _get_last_autoload(db, org_id)
    return AvitoCredentialsResponse(
        client_id=row.client_id,
        avito_user_id=int(row.avito_user_id),
        client_secret_configured=True,
        last_autoload=last,
    )


@router.post("/{org_id}/avito/autoload/upload", response_model=AvitoAutoloadUploadResponse)
async def upload_avito_autoload(
    org_id: str,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: UserModel = Depends(get_current_user),
):
    _ensure_org_access(current_user, org_id)
    _org_exists(db, org_id)

    if not file.filename or not file.filename.lower().endswith(".xlsx"):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Ожидается файл .xlsx")

    body = await file.read()
    if len(body) > 50 * 1024 * 1024:
        raise HTTPException(status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE, detail="Файл больше 50MB")

    base_dir = Path(__file__).resolve().parents[2] / "uploads" / "avito" / org_id
    base_dir.mkdir(parents=True, exist_ok=True)
    _remove_existing_avito_xlsx_files(base_dir)

    stem = SAFE_NAME_RE.sub("_", Path(file.filename).stem)[:80] or "autoload"
    dest_name = f"{stem}_{uuid.uuid4().hex[:8]}.xlsx"
    dest_path = base_dir / dest_name
    dest_path.write_bytes(body)

    parsed = parse_and_validate_avito_autoload(body)

    avito_upload, avito_upload_status, avito_report, avito_token_error = await _push_file_to_avito(
        db, org_id, dest_name, body
    )

    rel_path = f"/uploads/avito/{org_id}/{dest_name}"
    try:
        _save_autoload_cache(
            db,
            org_id,
            saved_path=rel_path,
            items=parsed.items,
            local_validation_ok=parsed.local_ok,
            local_errors=parsed.local_errors,
            sheets_parsed=parsed.sheets_parsed,
            avito_upload=avito_upload,
            avito_upload_status=avito_upload_status,
            avito_report=avito_report,
            avito_token_error=avito_token_error,
        )
    except Exception:
        logger.exception("Не удалось сохранить кэш автозагрузки")
        db.rollback()

    return AvitoAutoloadUploadResponse(
        saved_path=rel_path,
        items=parsed.items,
        local_validation_ok=parsed.local_ok,
        local_errors=parsed.local_errors,
        sheets_parsed=parsed.sheets_parsed,
        avito_upload=avito_upload,
        avito_upload_status=avito_upload_status,
        avito_report=avito_report,
        avito_token_error=avito_token_error,
    )


@router.post("/{org_id}/avito/autoload/import", response_model=AvitoAutoloadImportResponse)
async def import_avito_autoload_rows(
    org_id: str,
    body: AvitoAutoloadImportRequest,
    db: Session = Depends(get_db),
    current_user: UserModel = Depends(get_current_user),
):
    _ensure_org_access(current_user, org_id)
    _org_exists(db, org_id)

    if not current_user.is_seller:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Только продавцы могут импортировать товары")
    if not body.use_file_price and body.sale_price is None:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Укажите цену прихода или включите цену из файла")

    storage_location = db.query(StorageLocationModel).filter(
        StorageLocationModel.id == body.storage_location_id,
        StorageLocationModel.organization_id == org_id,
    ).first()
    if not storage_location:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Склад не найден или не принадлежит организации")

    cache = (
        db.query(OrganizationAvitoAutoloadCache)
        .filter(OrganizationAvitoAutoloadCache.organization_id == org_id)
        .first()
    )
    if not cache:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Нет данных автозагрузки для импорта")

    items = _json_loads(cache.items_json, [])
    index = {(str(i.get("sheet")), int(i.get("row"))): i for i in items if i.get("sheet") and i.get("row") is not None}
    row_keys = [(r.sheet, int(r.row)) for r in body.rows]

    created_products = 0
    updated_products = 0
    created_stock_ins = 0
    skipped_rows: list[dict[str, Any]] = []

    for key in row_keys:
        item = index.get((key[0], key[1]))
        if not item:
            skipped_rows.append({"sheet": key[0], "row": key[1], "reason": "Строка не найдена в кэше автозагрузки"})
            continue

        avito_id = str(item.get("avito_id") or "").strip()
        if not avito_id:
            skipped_rows.append(
                {
                    "sheet": key[0],
                    "row": key[1],
                    "reason": "Нет AvitoId — импорт запрещён для строк без ID объявления",
                }
            )
            continue

        link = None
        link = db.query(ProductAvitoListingLink).filter(
            ProductAvitoListingLink.organization_id == org_id,
            ProductAvitoListingLink.avito_ad_id == avito_id,
        ).first()

        file_price = None
        try:
            file_price = float(item.get("price")) if item.get("price") not in (None, "") else None
        except (TypeError, ValueError):
            file_price = None

        effective_price = file_price if body.use_file_price else body.sale_price
        if effective_price is None:
            effective_price = body.sale_price if body.sale_price is not None else 1.0

        title = str(item.get("title") or "").strip()
        part_number = str(item.get("part_number") or "").strip()
        manufacturer = str(item.get("manufacturer") or "").strip()
        description = str(item.get("description") or "").strip()
        file_quantity = None
        try:
            raw_qty = item.get("quantity")
            if raw_qty not in (None, ""):
                file_quantity = int(float(str(raw_qty).replace(",", ".").strip()))
        except (TypeError, ValueError):
            file_quantity = None
        effective_quantity = file_quantity if file_quantity and file_quantity > 0 else int(body.quantity)

        if link:
            product = db.query(ProductModel).filter(
                ProductModel.id == link.product_id,
                ProductModel.organization_id == org_id,
            ).first()
            if product is None:
                link = None
                stale_link = db.query(ProductAvitoListingLink).filter(
                    ProductAvitoListingLink.organization_id == org_id,
                    ProductAvitoListingLink.avito_ad_id == avito_id,
                ).first()
                if stale_link:
                    db.delete(stale_link)
            else:
                product.article = (part_number or avito_id or f"ROW-{key[1]}")[:30]
                product.name = (title or part_number or f"Avito row {key[1]}")[:255]
                product.brand = (manufacturer or "Unknown")[:100]
                product.price = effective_price
                product.quantity = effective_quantity
                product.storage_location_id = body.storage_location_id
                if description:
                    product.description = description
                updated_products += 1

        if link is None:
            product = ProductModel(
                article=(part_number or avito_id or f"ROW-{key[1]}")[:30],
                name=(title or part_number or f"Avito row {key[1]}")[:255],
                brand=(manufacturer or "Unknown")[:100],
                price=effective_price,
                quantity=effective_quantity,
                is_new=False,
                internal_code=_next_internal_code(db),
                description=description or f"Imported from Avito autoload (ad_id={avito_id or 'n/a'})",
                organization_id=org_id,
                storage_location_id=body.storage_location_id,
                created_by=current_user.id,
            )
            db.add(product)
            db.flush()
            created_products += 1

            try:
                with db.begin_nested():
                    db.add(
                        ProductAvitoListingLink(
                            organization_id=org_id,
                            product_id=product.id,
                            avito_ad_id=avito_id,
                        )
                    )
                    db.flush()
            except IntegrityError:
                skipped_rows.append(
                    {
                        "sheet": key[0],
                        "row": key[1],
                        "reason": f"Связь уже существует для AvitoId={avito_id}",
                    }
                )
                continue

        db.query(ProductPhoto).filter(ProductPhoto.product_id == product.id).delete()
        db.query(ProductVideo).filter(ProductVideo.product_id == product.id).delete()

        photos = item.get("photos") or []
        videos = item.get("videos") or []
        if isinstance(photos, list):
            for p in photos[:5]:
                p_url = str(p).strip()
                if not p_url:
                    continue
                db.add(
                    ProductPhoto(
                        product_id=product.id,
                        photo_url=p_url,
                        organization_id=org_id,
                        processing_status="completed",
                    )
                )
        if isinstance(videos, list):
            for v in videos[:1]:
                v_url = str(v).strip()
                if not v_url:
                    continue
                db.add(
                    ProductVideo(
                        product_id=product.id,
                        video_url=v_url,
                        organization_id=org_id,
                        processing_status="completed",
                    )
                )

        db.add(
            StockInModel(
                quantity=effective_quantity,
                sale_price=effective_price,
                organization_id=org_id,
                storage_location_id=body.storage_location_id,
                product_id=product.id,
                created_by=current_user.id,
            )
        )
        created_stock_ins += 1

    db.commit()
    return AvitoAutoloadImportResponse(
        created_products=created_products,
        updated_products=updated_products,
        created_stock_ins=created_stock_ins,
        skipped_rows=skipped_rows,
    )


@router.post("/{org_id}/avito/autoload/publish", response_model=AvitoAutoloadPublishResponse)
async def publish_avito_autoload(
    org_id: str,
    db: Session = Depends(get_db),
    current_user: UserModel = Depends(get_current_user),
):
    _ensure_org_access(current_user, org_id)
    _org_exists(db, org_id)
    if not _has_avito_integration(db, org_id):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Интеграция Авито не настроена")

    cache = (
        db.query(OrganizationAvitoAutoloadCache)
        .filter(OrganizationAvitoAutoloadCache.organization_id == org_id)
        .first()
    )
    if not cache or not cache.saved_path:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Файл автозагрузки не найден")

    rel_path = cache.saved_path
    xlsx_path = Path(__file__).resolve().parents[2] / rel_path.lstrip("/")
    if not xlsx_path.is_file():
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Файл автозагрузки на диске не найден")

    file_bytes = xlsx_path.read_bytes()
    avito_upload, avito_upload_status, avito_report, avito_token_error = await _push_file_to_avito(
        db, org_id, xlsx_path.name, file_bytes
    )
    _save_autoload_cache(
        db,
        org_id,
        saved_path=rel_path,
        items=_json_loads(cache.items_json, []),
        local_validation_ok=bool(cache.local_validation_ok),
        local_errors=_json_loads(cache.local_errors_json, []),
        sheets_parsed=_json_loads(cache.sheets_parsed_json, []),
        avito_upload=avito_upload,
        avito_upload_status=avito_upload_status,
        avito_report=avito_report,
        avito_token_error=avito_token_error,
    )
    return AvitoAutoloadPublishResponse(
        saved_path=rel_path,
        avito_upload=avito_upload,
        avito_upload_status=avito_upload_status,
        avito_report=avito_report,
        avito_token_error=avito_token_error,
    )


@router.post("/{org_id}/avito/autoload/actions", response_model=AvitoAutoloadUploadResponse)
async def apply_avito_autoload_actions(
    org_id: str,
    body: AvitoAutoloadApplyActionRequest,
    db: Session = Depends(get_db),
    current_user: UserModel = Depends(get_current_user),
):
    _ensure_org_access(current_user, org_id)
    _org_exists(db, org_id)

    cache = (
        db.query(OrganizationAvitoAutoloadCache)
        .filter(OrganizationAvitoAutoloadCache.organization_id == org_id)
        .first()
    )
    if not cache or not cache.saved_path:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Файл автозагрузки не найден")

    rel_path = cache.saved_path
    project_root = Path(__file__).resolve().parents[2]
    xlsx_path = project_root / rel_path.lstrip("/")
    if not xlsx_path.is_file():
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Файл автозагрузки на диске не найден")

    target_value = ACTION_VALUES.get(body.action)
    if not target_value:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Неизвестное действие")

    wb = load_workbook(str(xlsx_path), read_only=False)
    row_keys = {(r.sheet, int(r.row)) for r in body.rows}
    updated_rows = 0
    missing_sheets: set[str] = set()

    for sheet_name, row_no in row_keys:
        if sheet_name not in wb.sheetnames:
            missing_sheets.add(sheet_name)
            continue
        ws = wb[sheet_name]
        header = [str(v).strip() if v is not None else "" for v in ws[2]]
        action_col = None
        for idx, h in enumerate(header, start=1):
            if h in ACTION_HEADERS:
                action_col = idx
                break
        if not action_col:
            wb.close()
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"На листе '{sheet_name}' не найдена колонка 'Действие'",
            )
        ws.cell(row=row_no, column=action_col, value=target_value)
        updated_rows += 1

    if missing_sheets:
        wb.close()
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Не найдены листы: {', '.join(sorted(missing_sheets))}",
        )
    if updated_rows == 0:
        wb.close()
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Нет строк для обновления")

    out = BytesIO()
    wb.save(out)
    wb.close()
    updated_bytes = out.getvalue()
    xlsx_path.write_bytes(updated_bytes)

    parsed = parse_and_validate_avito_autoload(updated_bytes)
    avito_upload, avito_upload_status, avito_report, avito_token_error = await _push_file_to_avito(
        db, org_id, xlsx_path.name, updated_bytes
    )

    _save_autoload_cache(
        db,
        org_id,
        saved_path=rel_path,
        items=parsed.items,
        local_validation_ok=parsed.local_ok,
        local_errors=parsed.local_errors,
        sheets_parsed=parsed.sheets_parsed,
        avito_upload=avito_upload,
        avito_upload_status=avito_upload_status,
        avito_report=avito_report,
        avito_token_error=avito_token_error,
    )

    return AvitoAutoloadUploadResponse(
        saved_path=rel_path,
        items=parsed.items,
        local_validation_ok=parsed.local_ok,
        local_errors=parsed.local_errors,
        sheets_parsed=parsed.sheets_parsed,
        avito_upload=avito_upload,
        avito_upload_status=avito_upload_status,
        avito_report=avito_report,
        avito_token_error=avito_token_error,
    )
