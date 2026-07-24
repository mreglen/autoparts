from typing import Any, Optional
from pydantic import BaseModel, Field


class DromLastAutoloadSnapshot(BaseModel):
    saved_path: Optional[str] = None
    items: list = []
    local_validation_ok: bool = False
    local_errors: list = []
    drom_upload_response: Optional[Any] = None
    drom_upload_status: Optional[int] = None
    drom_token_error: Optional[str] = None
    updated_at: Optional[str] = None
    warnings: Optional[list] = None


class DromCredentialsResponse(BaseModel):
    is_enabled: bool
    packet_id: Optional[str] = None
    api_key_configured: bool = False
    auto_sync_enabled: bool = True
    last_sync_at: Optional[str] = None
    last_sync_status: Optional[int] = None
    last_sync_error: Optional[str] = None
    last_autoload: Optional[DromLastAutoloadSnapshot] = None


class DromCredentialsUpdate(BaseModel):
    is_enabled: bool
    packet_id: Optional[str] = None
    api_key: Optional[str] = Field(
        default=None,
        description="Ключ кабинета Drom (write-only). Пустая строка / null — не менять.",
    )
    auto_sync_enabled: Optional[bool] = True


class DromAutoloadExportRequest(BaseModel):
    product_ids: list[int]


class DromAutoloadExportResponse(BaseModel):
    saved_path: Optional[str] = None
    items: list = []
    local_validation_ok: bool = False
    local_errors: list = []
    exported_count: int = 0
    warnings: Optional[list] = None
    sync: Optional[dict[str, Any]] = None


class DromAutoloadUploadResponse(BaseModel):
    saved_path: Optional[str] = None
    items: list = []
    local_validation_ok: bool = False
    local_errors: list = []
    warnings: Optional[list] = None
    sync: Optional[dict[str, Any]] = None


class DromSyncResponse(BaseModel):
    ok: bool
    status_code: int = 0
    error_code: Optional[str] = None
    error_message: Optional[str] = None
    chunks_sent: int = 0
    body_text: Optional[str] = None
    last_sync_at: Optional[str] = None
