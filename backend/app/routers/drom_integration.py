import json
import logging
import asyncio
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Optional

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile, status
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session, selectinload

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
from app.services.audit_service import log_audit
from app.services.marketplace_site_footer import append_marketplace_site_info
from app.schemas.drom_integration import (
    DromAutoloadExportRequest,
    DromAutoloadExportResponse,
    DromAutoloadRemoveRowsRequest,
    DromAutoloadRemoveRowsResponse,
    DromAutoloadUploadResponse,
    DromCredentialsResponse,
    DromCredentialsUpdate,
    DromLastAutoloadSnapshot,
    DromSyncResponse,
)
from app.services.drom_api import DromSyncResult, sync_price_list_chunks, sync_price_list_chunk
from app.services.drom_autoload_xlsx import (
    build_drom_header_only_xlsx,
    chunk_export_rows_for_drom_sync,
    parse_and_validate_drom_autoload,
    remove_products_from_drom_autoload,
    upsert_products_to_drom_autoload,
    zero_quantity_rows_for_articles,
)
from app.utils.avito_crypto import decrypt_secret, encrypt_secret

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
    del db
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
    row.drom_upload_response_json = (
        json.dumps(drom_upload_response, ensure_ascii=False) if drom_upload_response is not None else None
    )
    row.drom_upload_status = drom_upload_status
    row.drom_token_error = drom_token_error
    row.warnings_json = json.dumps(warnings, ensure_ascii=False) if warnings else None
    db.commit()


def _credentials_response(row: Optional[OrganizationDromIntegration], last) -> DromCredentialsResponse:
    if not row:
        return DromCredentialsResponse(
            is_enabled=False,
            packet_id=None,
            api_key_configured=False,
            auto_sync_enabled=True,
            last_sync_at=None,
            last_sync_status=None,
            last_sync_error=None,
            last_autoload=last,
        )
    return DromCredentialsResponse(
        is_enabled=bool(row.is_enabled),
        packet_id=row.packet_id,
        api_key_configured=bool(row.api_key_encrypted),
        auto_sync_enabled=bool(row.auto_sync_enabled) if row.auto_sync_enabled is not None else True,
        last_sync_at=row.last_sync_at.isoformat() if row.last_sync_at else None,
        last_sync_status=row.last_sync_status,
        last_sync_error=row.last_sync_error,
        last_autoload=last,
    )


def _get_integration(db: Session, org_id: str) -> Optional[OrganizationDromIntegration]:
    return (
        db.query(OrganizationDromIntegration)
        .filter(OrganizationDromIntegration.organization_id == org_id)
        .first()
    )


def _decrypt_api_key(row: OrganizationDromIntegration) -> Optional[str]:
    if not row.api_key_encrypted:
        return None
    try:
        return decrypt_secret(row.api_key_encrypted)
    except Exception:
        logger.exception("Failed to decrypt Drom api key for org %s", row.organization_id)
        return None


def _apply_sync_result(db: Session, row: OrganizationDromIntegration, result: DromSyncResult) -> None:
    row.last_sync_at = datetime.now(timezone.utc).replace(tzinfo=None)
    row.last_sync_status = result.status_code if result.status_code else None
    row.last_sync_error = None if result.ok else (result.error_message or result.error_code or "Ошибка sync")
    db.commit()

    cache = (
        db.query(OrganizationDromAutoloadCache)
        .filter(OrganizationDromAutoloadCache.organization_id == row.organization_id)
        .first()
    )
    if cache:
        cache.drom_upload_response_json = json.dumps(result.to_dict(), ensure_ascii=False)
        cache.drom_upload_status = result.status_code if result.status_code else None
        cache.drom_token_error = None if result.ok else (result.error_code or result.error_message)
        db.commit()


async def _sync_export_rows(
    db: Session,
    org_id: str,
    export_rows: list[dict[str, Any]],
    *,
    force: bool = False,
) -> Optional[dict[str, Any]]:
    row = _get_integration(db, org_id)
    if not row or not row.is_enabled:
        return None
    if not force and not row.auto_sync_enabled:
        return {"ok": False, "skipped": True, "error_message": "Автосинхронизация отключена"}
    if not row.packet_id or not row.api_key_encrypted:
        return {
            "ok": False,
            "skipped": True,
            "error_message": "Не заданы packetId или ключ кабинета",
        }

    api_key = _decrypt_api_key(row)
    if not api_key:
        return {"ok": False, "error_message": "Не удалось расшифровать ключ кабинета"}

    public_base_url = (settings.PUBLIC_BASE_URL or settings.BASE_URL or "").strip()
    chunks = await asyncio.to_thread(
        chunk_export_rows_for_drom_sync,
        export_rows,
        public_base_url=public_base_url,
    )
    if not chunks:
        return {"ok": False, "error_message": "Нет данных для sync"}

    result = await sync_price_list_chunks(
        packet_id=row.packet_id,
        api_key=api_key,
        chunks=chunks,
    )
    _apply_sync_result(db, row, result)
    return result.to_dict()


@router.get("/{org_id}/drom/credentials", response_model=DromCredentialsResponse)
def get_drom_credentials(
    org_id: str,
    db: Session = Depends(get_db),
    current_user: UserModel = Depends(get_current_user),
):
    _ensure_org_access(current_user, org_id)
    _org_exists(db, org_id)
    row = _get_integration(db, org_id)
    last = _get_last_autoload(db, org_id)
    return _credentials_response(row, last)


@router.put("/{org_id}/drom/credentials", response_model=DromCredentialsResponse)
def put_drom_credentials(
    org_id: str,
    body: DromCredentialsUpdate,
    db: Session = Depends(get_db),
    current_user: UserModel = Depends(get_current_user),
):
    _ensure_org_access(current_user, org_id)
    _org_exists(db, org_id)

    row = _get_integration(db, org_id)
    if row is None:
        row = OrganizationDromIntegration(
            organization_id=org_id,
            is_enabled=body.is_enabled,
            auto_sync_enabled=True if body.auto_sync_enabled is None else bool(body.auto_sync_enabled),
        )
        db.add(row)
    else:
        row.is_enabled = body.is_enabled
        if body.auto_sync_enabled is not None:
            row.auto_sync_enabled = bool(body.auto_sync_enabled)

    if body.packet_id is not None:
        packet = str(body.packet_id).strip()
        row.packet_id = packet or None

    if body.api_key is not None:
        key = str(body.api_key).strip()
        if key:
            row.api_key_encrypted = encrypt_secret(key)

    db.commit()
    db.refresh(row)
    log_audit(
        db,
        event_type="integration_updated",
        category="integrations",
        summary=f"Интеграция Drom {'включена' if row.is_enabled else 'отключена'}",
        user=current_user,
        organization_id=org_id,
        details={
            "is_enabled": row.is_enabled,
            "packet_id": row.packet_id,
            "auto_sync_enabled": row.auto_sync_enabled,
            "api_key_configured": bool(row.api_key_encrypted),
        },
    )

    last = _get_last_autoload(db, org_id)
    return _credentials_response(row, last)


@router.post("/{org_id}/drom/sync", response_model=DromSyncResponse)
async def sync_drom_price_list(
    org_id: str,
    db: Session = Depends(get_db),
    current_user: UserModel = Depends(get_current_user),
):
    """Отправить текущий XLSX (частями ≤5 МБ) в Drom API sync."""
    _ensure_org_access(current_user, org_id)
    _org_exists(db, org_id)

    row = _get_integration(db, org_id)
    if not row or not row.is_enabled:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Интеграция Drom выключена")
    if not row.packet_id or not row.api_key_encrypted:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Укажите packetId и ключ кабинета в настройках Drom",
        )

    api_key = _decrypt_api_key(row)
    if not api_key:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Не удалось прочитать ключ кабинета")

    xlsx_path, _rel = _resolve_saved_drom_file(db, org_id)
    if not xlsx_path.is_file():
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Файл прайса ещё не создан")

    file_bytes = xlsx_path.read_bytes()
    parsed = await asyncio.to_thread(parse_and_validate_drom_autoload, file_bytes)
    export_rows = []
    for item in parsed.items:
        export_rows.append(
            {
                "article": item.get("article") or "",
                "name": item.get("name") or item.get("Наименование товара") or "",
                "is_new": str(item.get("Новый/б.у.") or "").lower().startswith("нов"),
                "brand": item.get("Производитель") or item.get("brand") or "",
                "price": item.get("price") or item.get("Цена") or 0,
                "quantity": item.get("quantity") or item.get("Кол-во") or 0,
                "photos": [item.get("photo") or item.get("Фотография")]
                if (item.get("photo") or item.get("Фотография"))
                else [],
                "storage_address": item.get("Адрес склада") or "",
            }
        )

    if not export_rows:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="В файле нет товаров для sync")

    public_base_url = (settings.PUBLIC_BASE_URL or settings.BASE_URL or "").strip()
    chunks = await asyncio.to_thread(
        chunk_export_rows_for_drom_sync,
        export_rows,
        public_base_url=public_base_url,
    )
    result = await sync_price_list_chunks(
        packet_id=row.packet_id,
        api_key=api_key,
        chunks=chunks,
    )
    _apply_sync_result(db, row, result)
    log_audit(
        db,
        event_type="drom_sync",
        category="integrations",
        summary=f"Drom API sync: {'OK' if result.ok else 'ошибка'}",
        user=current_user,
        organization_id=org_id,
        details=result.to_dict(),
    )
    db.refresh(row)
    return DromSyncResponse(
        ok=result.ok,
        status_code=result.status_code,
        error_code=result.error_code,
        error_message=result.error_message,
        chunks_sent=result.chunks_sent,
        body_text=(result.body_text or "")[:500] or None,
        last_sync_at=row.last_sync_at.isoformat() if row.last_sync_at else None,
    )


@router.post("/{org_id}/drom/sync/test", response_model=DromSyncResponse)
async def test_drom_sync(
    org_id: str,
    db: Session = Depends(get_db),
    current_user: UserModel = Depends(get_current_user),
):
    """Проверка packetId/auth: отправка XLSX только с заголовками шаблона."""
    _ensure_org_access(current_user, org_id)
    _org_exists(db, org_id)

    row = _get_integration(db, org_id)
    if not row or not row.packet_id or not row.api_key_encrypted:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Сначала сохраните packetId и ключ кабинета",
        )

    api_key = _decrypt_api_key(row)
    if not api_key:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Не удалось прочитать ключ кабинета")

    try:
        header_bytes = await asyncio.to_thread(build_drom_header_only_xlsx)
    except FileNotFoundError as exc:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(exc)) from exc

    result = await sync_price_list_chunk(
        packet_id=row.packet_id,
        api_key=api_key,
        file_bytes=header_bytes,
        filename="drom-auth-test.xlsx",
    )
    _apply_sync_result(db, row, result)
    db.refresh(row)
    return DromSyncResponse(
        ok=result.ok,
        status_code=result.status_code,
        error_code=result.error_code,
        error_message=result.error_message,
        chunks_sent=result.chunks_sent,
        body_text=(result.body_text or "")[:500] or None,
        last_sync_at=row.last_sync_at.isoformat() if row.last_sync_at else None,
    )


@router.post("/{org_id}/drom/autoload/export", response_model=DromAutoloadExportResponse)
async def export_products_to_drom_autoload(
    org_id: str,
    body: DromAutoloadExportRequest,
    db: Session = Depends(get_db),
    current_user: UserModel = Depends(get_current_user),
):
    """Экспорт товаров в XLSX файл Drom (+ auto sync в API при включённой настройке)."""
    _ensure_org_access(current_user, org_id)
    org = _org_exists(db, org_id)

    requested_ids = list(dict.fromkeys(body.product_ids))
    if not requested_ids:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Список product_ids пуст")

    products = (
        db.query(ProductModel)
        .options(selectinload(ProductModel.photos))
        .filter(
            ProductModel.organization_id == org_id,
            ProductModel.id.in_(requested_ids),
        )
        .all()
    )
    by_id = {p.id: p for p in products}

    storage_ids = {p.storage_location_id for p in products if p.storage_location_id}
    storage_rows = (
        db.query(StorageLocationModel).filter(StorageLocationModel.id.in_(list(storage_ids))).all()
        if storage_ids
        else []
    )
    storage_by_id = {s.id: s for s in storage_rows}

    export_rows = []
    for product_id in requested_ids:
        product = by_id.get(product_id)
        if not product:
            continue

        photos = [ph.photo_url for ph in (product.photos or []) if ph.photo_url]
        storage = storage_by_id.get(product.storage_location_id) if product.storage_location_id else None
        address = (storage.address if storage and storage.address else None) or (org.address or "")

        note = append_marketplace_site_info(
            product.description or "",
            enabled=bool(getattr(org, "append_marketplace_site_info", False)),
            product=product,
            site_origin=(settings.PUBLIC_BASE_URL or settings.BASE_URL or "").strip(),
        )

        export_rows.append(
            {
                "product_id": product.id,
                "article": product.article or "",
                "name": product.name or "",
                "is_new": product.is_new,
                "brand": product.brand or "",
                "price": product.price or 0,
                "quantity": product.quantity or 0,
                "photos": photos[:5],
                "storage_address": address,
                "note": note,
            }
        )

    if not export_rows:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Товары не найдены для экспорта")

    xlsx_path, rel_path = _resolve_saved_drom_file(db, org_id)
    existing_bytes = xlsx_path.read_bytes() if xlsx_path.is_file() else None
    public_base_url = (settings.PUBLIC_BASE_URL or settings.BASE_URL or "").strip()

    try:
        merged_bytes = await asyncio.to_thread(
            upsert_products_to_drom_autoload,
            existing_bytes,
            export_rows,
            public_base_url,
        )
        xlsx_path.write_bytes(merged_bytes)
    except Exception as e:
        logger.exception("Ошибка при создании XLSX файла Drom")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Ошибка генерации файла: {str(e)}",
        ) from e

    parsed = await asyncio.to_thread(parse_and_validate_drom_autoload, merged_bytes)

    _save_autoload_cache(
        db,
        org_id,
        saved_path=rel_path,
        items=parsed.items,
        local_validation_ok=parsed.local_ok,
        local_errors=parsed.local_errors,
    )

    for product_id in requested_ids:
        if product_id not in by_id:
            continue
        existing_link = (
            db.query(ProductDromListingLink)
            .filter(
                ProductDromListingLink.organization_id == org_id,
                ProductDromListingLink.product_id == product_id,
            )
            .first()
        )
        if not existing_link:
            db.add(
                ProductDromListingLink(
                    organization_id=org_id,
                    product_id=product_id,
                    drom_status="exported",
                )
            )

    db.commit()

    sync_result = await _sync_export_rows(db, org_id, export_rows, force=False)

    log_audit(
        db,
        event_type="drom_export",
        category="integrations",
        summary=f"Экспорт в Drom: {len(export_rows)} товар(ов)",
        user=current_user,
        organization_id=org_id,
        details={
            "product_ids": requested_ids,
            "exported_count": len(export_rows),
            "sync": sync_result,
        },
    )

    return DromAutoloadExportResponse(
        saved_path=rel_path,
        items=parsed.items,
        local_validation_ok=parsed.local_ok,
        local_errors=parsed.local_errors,
        exported_count=len(export_rows),
        sync=sync_result,
    )


@router.post("/{org_id}/drom/autoload/export/{product_id}", response_model=DromAutoloadExportResponse)
async def export_single_product_to_drom_autoload(
    org_id: str,
    product_id: int,
    db: Session = Depends(get_db),
    current_user: UserModel = Depends(get_current_user),
):
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
    _ensure_org_access(current_user, org_id)
    _org_exists(db, org_id)

    if not file.filename or not file.filename.lower().endswith(".xlsx"):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Ожидается файл .xlsx")

    body = await file.read()
    if len(body) > 50 * 1024 * 1024:
        raise HTTPException(status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE, detail="Файл больше 50MB")

    xlsx_path, rel_path = _resolve_saved_drom_file(db, org_id)
    xlsx_path.write_bytes(body)

    parsed = parse_and_validate_drom_autoload(body)

    warnings = []
    if len(parsed.items) == 0 and not parsed.local_errors:
        warnings.append("Файл загружен, но товары не найдены.")

    _save_autoload_cache(
        db,
        org_id,
        saved_path=rel_path,
        items=parsed.items,
        local_validation_ok=parsed.local_ok,
        local_errors=parsed.local_errors,
        warnings=warnings if warnings else None,
    )

    export_rows = []
    for item in parsed.items:
        export_rows.append(
            {
                "article": item.get("article") or "",
                "name": item.get("name") or "",
                "is_new": str(item.get("Новый/б.у.") or "").lower().startswith("нов"),
                "brand": item.get("Производитель") or "",
                "price": item.get("price") or item.get("Цена") or 0,
                "quantity": item.get("quantity") or item.get("Кол-во") or 0,
                "photos": [item.get("photo") or item.get("Фотография")]
                if (item.get("photo") or item.get("Фотография"))
                else [],
                "storage_address": item.get("Адрес склада") or "",
            }
        )
    sync_result = await _sync_export_rows(db, org_id, export_rows, force=False) if export_rows else None

    return DromAutoloadUploadResponse(
        saved_path=rel_path,
        items=parsed.items,
        local_validation_ok=parsed.local_ok,
        local_errors=parsed.local_errors,
        warnings=warnings if warnings else None,
        sync=sync_result,
    )


@router.post("/{org_id}/drom/autoload/remove-rows", response_model=DromAutoloadRemoveRowsResponse)
async def remove_drom_autoload_rows(
    org_id: str,
    body: DromAutoloadRemoveRowsRequest,
    db: Session = Depends(get_db),
    current_user: UserModel = Depends(get_current_user),
):
    """Удаляет позиции из XLSX прайс-листа Drom и отправляет qty=0 в API автообновления."""
    _ensure_org_access(current_user, org_id)
    _org_exists(db, org_id)

    articles = list(
        dict.fromkeys(str(a or "").strip() for a in (body.articles or []) if str(a or "").strip())
    )
    if not articles:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Список артикулов пуст")

    xlsx_path, rel_path = _resolve_saved_drom_file(db, org_id)
    cache = (
        db.query(OrganizationDromAutoloadCache)
        .filter(OrganizationDromAutoloadCache.organization_id == org_id)
        .first()
    )
    if cache and cache.saved_path:
        candidate = Path(cache.saved_path)
        if not candidate.is_absolute():
            candidate = Path(__file__).resolve().parents[2] / cache.saved_path.lstrip("/")
        if candidate.is_file():
            xlsx_path = candidate
            rel_path = cache.saved_path

    if not xlsx_path.is_file():
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Файл автозагрузки Drom не найден",
        )

    before = parse_and_validate_drom_autoload(xlsx_path.read_bytes())
    before_articles = {
        str(item.get("article") or item.get("Артикул") or "").strip()
        for item in before.items
    }
    matched = [a for a in articles if a in before_articles]
    if not matched:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Указанные артикулы не найдены в прайс-листе Drom",
        )

    updated_bytes = remove_products_from_drom_autoload(xlsx_path.read_bytes(), matched)
    xlsx_path.write_bytes(updated_bytes)
    parsed = parse_and_validate_drom_autoload(updated_bytes)

    # Снимаем связь «экспортирован в Drom», чтобы позиция не считалась в номенклатуре
    products = (
        db.query(ProductModel)
        .filter(
            ProductModel.organization_id == org_id,
            ProductModel.article.in_(matched),
        )
        .all()
    )
    product_ids = [p.id for p in products]
    if product_ids:
        db.query(ProductDromListingLink).filter(
            ProductDromListingLink.organization_id == org_id,
            ProductDromListingLink.product_id.in_(product_ids),
        ).delete(synchronize_session=False)
        db.commit()

    warnings = [
        f"Удалено позиций из файла: {len(matched)}",
    ]
    _save_autoload_cache(
        db,
        org_id,
        saved_path=rel_path,
        items=parsed.items,
        local_validation_ok=parsed.local_ok,
        local_errors=parsed.local_errors,
        warnings=warnings,
    )

    # API автообновления прайс-листа: количество 0 = убрать с площадки
    sync_result = await _sync_export_rows(
        db,
        org_id,
        zero_quantity_rows_for_articles(matched),
        force=False,
    )

    log_audit(
        db,
        event_type="drom_autoload_remove_rows",
        category="integrations",
        summary=f"Удаление из номенклатуры Drom: {len(matched)} поз.",
        user=current_user,
        organization_id=org_id,
        details={"articles": matched, "removed_count": len(matched)},
    )

    return DromAutoloadRemoveRowsResponse(
        saved_path=rel_path,
        items=parsed.items,
        local_validation_ok=parsed.local_ok,
        local_errors=parsed.local_errors,
        removed_count=len(matched),
        warnings=warnings,
        sync=sync_result,
    )


@router.get("/{org_id}/drom/autoload/download")
async def download_drom_autoload(
    org_id: str,
    db: Session = Depends(get_db),
    current_user: UserModel = Depends(get_current_user),
):
    _ensure_org_access(current_user, org_id)
    _org_exists(db, org_id)

    cache = (
        db.query(OrganizationDromAutoloadCache)
        .filter(OrganizationDromAutoloadCache.organization_id == org_id)
        .first()
    )
    if not cache or not cache.saved_path:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Файл автозагрузки не найден")

    project_root = Path(__file__).resolve().parents[2]
    xlsx_path = project_root / cache.saved_path.lstrip("/")

    if not xlsx_path.is_file():
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Файл автозагрузки на диске не найден")

    return FileResponse(
        path=str(xlsx_path),
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        filename="drom-autoload.xlsx",
        headers={
            "Cache-Control": "no-cache, no-store, must-revalidate",
            "Pragma": "no-cache",
            "Expires": "0",
        },
    )


@router.get("/{org_id}/drom/autoload/file-link")
def get_drom_file_link(
    org_id: str,
    db: Session = Depends(get_db),
    current_user: UserModel = Depends(get_current_user),
):
    _ensure_org_access(current_user, org_id)
    _org_exists(db, org_id)

    cache = (
        db.query(OrganizationDromAutoloadCache)
        .filter(OrganizationDromAutoloadCache.organization_id == org_id)
        .first()
    )

    if not cache or not cache.saved_path:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Файл не найден")

    base_url = settings.PUBLIC_BASE_URL or settings.BASE_URL or ""
    file_url = f"{base_url}{cache.saved_path}"

    return {"file_url": file_url, "saved_path": cache.saved_path}
