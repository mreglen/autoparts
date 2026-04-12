import json
import logging
from pathlib import Path
from typing import Any, Optional

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile, status
from sqlalchemy.orm import Session

from app.core.auth import get_current_user
from app.core.config import settings
from app.db.database import get_db
from app.models.organization import Organization as OrganizationModel
from app.models.organization_drom_autoload_cache import OrganizationDromAutoloadCache
from app.models.organization_drom_integration import OrganizationDromIntegration
from app.models.product import Product as ProductModel
from app.models.product_drom_listing_link import ProductDromListingLink
from app.models.storage_location import StorageLocation as StorageLocationModel
from app.models.user import User as UserModel
from app.schemas.drom_integration import (
    DromAutoloadExportRequest,
    DromAutoloadExportResponse,
    DromAutoloadUploadResponse,
    DromAutoloadPublishResponse,
    DromCredentialsResponse,
    DromCredentialsUpdate,
    DromLastAutoloadSnapshot,
)
from app.services.drom_autoload_xlsx import parse_and_validate_drom_autoload, upsert_products_to_drom_autoload

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/organizations", tags=["Drom"])


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


def _resolve_saved_drom_file(db: Session, org_id: str) -> tuple[Path, str]:
    """Получить путь к файлу Drom для организации (один файл на организацию)"""
    base_dir = Path(__file__).resolve().parents[2] / "uploads" / "drom" / org_id
    base_dir.mkdir(parents=True, exist_ok=True)
    dest_name = "export.xlsx"
    xlsx_path = base_dir / dest_name
    rel_path = f"/uploads/drom/{org_id}/{dest_name}"
    return xlsx_path, rel_path


def _get_last_autoload(db: Session, org_id: str) -> Optional[DromLastAutoloadSnapshot]:
    cache = (
        db.query(OrganizationDromAutoloadCache)
        .filter(OrganizationDromAutoloadCache.organization_id == org_id)
        .first()
    )
    if not cache:
        return None

    return DromLastAutoloadSnapshot(
        saved_path=cache.saved_path,
        items=_json_loads(cache.items_json, []),
        local_validation_ok=bool(cache.local_validation_ok),
        local_errors=_json_loads(cache.local_errors_json, []),
        drom_upload_response=_json_loads(cache.drom_upload_response_json, None),
        drom_upload_status=cache.drom_upload_status,
        drom_token_error=cache.drom_token_error,
        updated_at=cache.updated_at.isoformat() if cache.updated_at else None,
        warnings=_json_loads(cache.warnings_json, []),
    )


def _save_autoload_cache(
    db: Session,
    org_id: str,
    *,
    saved_path: str,
    items: list,
    local_validation_ok: bool,
    local_errors: list,
    drom_upload_response: Any = None,
    drom_upload_status: Optional[int] = None,
    drom_token_error: Optional[str] = None,
    warnings: Optional[list] = None,
) -> None:
    row = (
        db.query(OrganizationDromAutoloadCache)
        .filter(OrganizationDromAutoloadCache.organization_id == org_id)
        .first()
    )
    if not row:
        row = OrganizationDromAutoloadCache(organization_id=org_id)
        db.add(row)
    
    row.saved_path = saved_path
    row.items_json = json.dumps(items, ensure_ascii=False)
    row.local_validation_ok = local_validation_ok
    row.local_errors_json = json.dumps(local_errors, ensure_ascii=False)
    row.drom_upload_response_json = json.dumps(drom_upload_response, ensure_ascii=False) if drom_upload_response else None
    row.drom_upload_status = drom_upload_status
    row.drom_token_error = drom_token_error
    row.warnings_json = json.dumps(warnings, ensure_ascii=False) if warnings else None
    db.commit()


@router.get("/{org_id}/drom/credentials", response_model=DromCredentialsResponse)
def get_drom_credentials(
    org_id: str,
    db: Session = Depends(get_db),
    current_user: UserModel = Depends(get_current_user),
):
    """Получить статус интеграции с Drom"""
    _ensure_org_access(current_user, org_id)
    _org_exists(db, org_id)
    
    row = db.query(OrganizationDromIntegration).filter(
        OrganizationDromIntegration.organization_id == org_id
    ).first()
    
    last = _get_last_autoload(db, org_id)
    
    if not row:
        return DromCredentialsResponse(
            is_enabled=False,
            last_autoload=last,
        )
    
    return DromCredentialsResponse(
        is_enabled=row.is_enabled,
        last_autoload=last,
    )


@router.put("/{org_id}/drom/credentials", response_model=DromCredentialsResponse)
def put_drom_credentials(
    org_id: str,
    body: DromCredentialsUpdate,
    db: Session = Depends(get_db),
    current_user: UserModel = Depends(get_current_user),
):
    """Обновить настройки интеграции с Drom (вкл/выкл)"""
    _ensure_org_access(current_user, org_id)
    _org_exists(db, org_id)
    
    row = db.query(OrganizationDromIntegration).filter(
        OrganizationDromIntegration.organization_id == org_id
    ).first()
    
    if row is None:
        row = OrganizationDromIntegration(
            organization_id=org_id,
            is_enabled=body.is_enabled,
        )
        db.add(row)
    else:
        row.is_enabled = body.is_enabled
    
    db.commit()
    db.refresh(row)
    
    last = _get_last_autoload(db, org_id)
    
    return DromCredentialsResponse(
        is_enabled=row.is_enabled,
        last_autoload=last,
    )


@router.post("/{org_id}/drom/autoload/export", response_model=DromAutoloadExportResponse)
async def export_products_to_drom_autoload(
    org_id: str,
    body: DromAutoloadExportRequest,
    db: Session = Depends(get_db),
    current_user: UserModel = Depends(get_current_user),
):
    """Экспорт товаров в XLSX файл Drom"""
    _ensure_org_access(current_user, org_id)
    org = _org_exists(db, org_id)
    
    requested_ids = list(dict.fromkeys(body.product_ids))
    if not requested_ids:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Список product_ids пуст")
    
    # Получаем товары
    products = (
        db.query(ProductModel)
        .filter(
            ProductModel.organization_id == org_id,
            ProductModel.id.in_(requested_ids),
        )
        .all()
    )
    by_id = {p.id: p for p in products}
    
    # Получаем адреса складов
    storage_ids = {p.storage_location_id for p in products if p.storage_location_id}
    storage_rows = (
        db.query(StorageLocationModel).filter(StorageLocationModel.id.in_(list(storage_ids))).all()
        if storage_ids
        else []
    )
    storage_by_id = {s.id: s for s in storage_rows}
    
    # Формируем строки для экспорта
    export_rows = []
    for product_id in requested_ids:
        product = by_id.get(product_id)
        if not product:
            continue
        
        # Получаем фото
        photos = [ph.photo_url for ph in (product.photos or []) if ph.photo_url]
        
        # Получаем адрес склада
        storage = storage_by_id.get(product.storage_location_id) if product.storage_location_id else None
        address = (storage.address if storage and storage.address else None) or (org.address or "")
        
        export_rows.append({
            "product_id": product.id,
            "article": product.article or "",
            "name": product.name or "",
            "is_new": product.is_new,
            "brand": product.brand or "",
            "price": product.price or 0,
            "quantity": product.quantity or 0,
            "photos": photos[:5],  # Максимум 5 фото
            "storage_address": address,
        })
    
    if not export_rows:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Товары не найдены для экспорта")
    
    # Загружаем существующий файл или создаем новый
    xlsx_path, rel_path = _resolve_saved_drom_file(db, org_id)
    existing_bytes = xlsx_path.read_bytes() if xlsx_path.is_file() else None
    
    try:
        merged_bytes = upsert_products_to_drom_autoload(
            existing_bytes,
            export_rows,
            public_base_url=(settings.PUBLIC_BASE_URL or settings.BASE_URL or "").strip(),
        )
        xlsx_path.write_bytes(merged_bytes)
    except Exception as e:
        logger.exception("Ошибка при создании XLSX файла Drom")
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"Ошибка генерации файла: {str(e)}")
    
    # Парсим и валидируем
    parsed = parse_and_validate_drom_autoload(merged_bytes)
    
    # Сохраняем в кэш
    _save_autoload_cache(
        db,
        org_id,
        saved_path=rel_path,
        items=parsed.items,
        local_validation_ok=parsed.local_ok,
        local_errors=parsed.local_errors,
    )
    
    # Создаем записи в product_drom_listing_links для экспортированных товаров
    for product_id in requested_ids:
        if product_id not in by_id:
            continue
        
        # Проверяем, существует ли уже запись
        existing_link = db.query(ProductDromListingLink).filter(
            ProductDromListingLink.organization_id == org_id,
            ProductDromListingLink.product_id == product_id,
        ).first()
        
        if not existing_link:
            # Создаем новую запись
            link = ProductDromListingLink(
                organization_id=org_id,
                product_id=product_id,
                drom_status="exported",
            )
            db.add(link)
    
    db.commit()
    
    return DromAutoloadExportResponse(
        saved_path=rel_path,
        items=parsed.items,
        local_validation_ok=parsed.local_ok,
        local_errors=parsed.local_errors,
        exported_count=len(export_rows),
    )


@router.post("/{org_id}/drom/autoload/export/{product_id}", response_model=DromAutoloadExportResponse)
async def export_single_product_to_drom_autoload(
    org_id: str,
    product_id: int,
    db: Session = Depends(get_db),
    current_user: UserModel = Depends(get_current_user),
):
    """Экспорт одного товара в Drom"""
    return await export_products_to_drom_autoload(
        org_id=org_id,
        body=DromAutoloadExportRequest(product_ids=[product_id]),
        db=db,
        current_user=current_user,
    )


@router.post("/{org_id}/drom/autoload/upload", response_model=DromAutoloadUploadResponse)
async def upload_drom_autoload_file(
    org_id: str,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: UserModel = Depends(get_current_user),
):
    """Загрузить XLSX файл Drom вручную"""
    _ensure_org_access(current_user, org_id)
    _org_exists(db, org_id)
    
    if not file.filename or not file.filename.lower().endswith(".xlsx"):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Ожидается файл .xlsx")
    
    body = await file.read()
    if len(body) > 50 * 1024 * 1024:
        raise HTTPException(status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE, detail="Файл больше 50MB")
    
    # Сохраняем файл
    xlsx_path, rel_path = _resolve_saved_drom_file(db, org_id)
    xlsx_path.write_bytes(body)
    
    # Парсим и валидируем
    parsed = parse_and_validate_drom_autoload(body)
    
    warnings = []
    if len(parsed.items) == 0 and not parsed.local_errors:
        warnings.append("Файл загружен, но товары не найдены.")
    
    # Сохраняем в кэш
    _save_autoload_cache(
        db,
        org_id,
        saved_path=rel_path,
        items=parsed.items,
        local_validation_ok=parsed.local_ok,
        local_errors=parsed.local_errors,
        warnings=warnings if warnings else None,
    )
    
    return DromAutoloadUploadResponse(
        saved_path=rel_path,
        items=parsed.items,
        local_validation_ok=parsed.local_ok,
        local_errors=parsed.local_errors,
        warnings=warnings if warnings else None,
    )


@router.post("/{org_id}/drom/autoload/publish", response_model=DromAutoloadPublishResponse)
async def publish_drom_autoload(
    org_id: str,
    db: Session = Depends(get_db),
    current_user: UserModel = Depends(get_current_user),
):
    """Публикация в Drom API (заглушка - не используется)"""
    _ensure_org_access(current_user, org_id)
    _org_exists(db, org_id)
    
    # Проверяем интеграцию
    row = db.query(OrganizationDromIntegration).filter(
        OrganizationDromIntegration.organization_id == org_id
    ).first()
    
    if not row or not row.is_enabled:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Интеграция Drom не включена")
    
    raise HTTPException(status_code=status.HTTP_501_NOT_IMPLEMENTED, detail="Публикация через API пока не поддерживается")


@router.get("/{org_id}/drom/autoload/file-link")
def get_drom_file_link(
    org_id: str,
    db: Session = Depends(get_db),
    current_user: UserModel = Depends(get_current_user),
):
    """Получить публичную ссылку на XLSX файл Drom"""
    _ensure_org_access(current_user, org_id)
    _org_exists(db, org_id)
    
    cache = db.query(OrganizationDromAutoloadCache).filter(
        OrganizationDromAutoloadCache.organization_id == org_id
    ).first()
    
    if not cache or not cache.saved_path:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Файл не найден")
    
    # Формируем публичную ссылку
    base_url = settings.PUBLIC_BASE_URL or settings.BASE_URL or ""
    file_url = f"{base_url}{cache.saved_path}"
    
    return {"file_url": file_url, "saved_path": cache.saved_path}
