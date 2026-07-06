from typing import Any, Optional
from pydantic import BaseModel


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
    last_autoload: Optional[DromLastAutoloadSnapshot] = None


class DromCredentialsUpdate(BaseModel):
    is_enabled: bool


class DromAutoloadExportRequest(BaseModel):
    product_ids: list[int]


class DromAutoloadExportResponse(BaseModel):
    saved_path: Optional[str] = None
    items: list = []
    local_validation_ok: bool = False
    local_errors: list = []
    exported_count: int = 0
    warnings: Optional[list] = None


class DromAutoloadUploadResponse(BaseModel):
    saved_path: Optional[str] = None
    items: list = []
    local_validation_ok: bool = False
    local_errors: list = []
    warnings: Optional[list] = None
