from typing import Any, Optional

from pydantic import BaseModel, Field


class AvitoCredentialsUpdate(BaseModel):
    client_id: str = Field(..., min_length=1, max_length=255)
    client_secret: Optional[str] = Field(None, max_length=512)
    """Если None или пустая строка — существующий секрет не меняем."""
    avito_user_id: int = Field(..., gt=0)


class AvitoLastAutoloadSnapshot(BaseModel):
    saved_path: Optional[str] = None
    items: list[dict[str, Any]] = Field(default_factory=list)
    local_validation_ok: bool = True
    local_errors: list[dict[str, Any]] = Field(default_factory=list)
    sheets_parsed: list[str] = Field(default_factory=list)
    avito_upload: Optional[Any] = None
    avito_upload_status: Optional[int] = None
    avito_report: Optional[Any] = None
    avito_token_error: Optional[str] = None
    updated_at: Optional[str] = None


class AvitoCredentialsResponse(BaseModel):
    client_id: str = ""
    avito_user_id: Optional[int] = None
    client_secret_configured: bool = False
    last_autoload: Optional[AvitoLastAutoloadSnapshot] = None


class AvitoAutoloadUploadResponse(BaseModel):
    saved_path: str
    items: list[dict[str, Any]]
    local_validation_ok: bool
    local_errors: list[dict[str, Any]]
    sheets_parsed: list[str]
    avito_upload: Optional[dict[str, Any]] = None
    avito_upload_status: Optional[int] = None
    avito_report: Optional[dict[str, Any]] = None
    avito_token_error: Optional[str] = None


class AvitoAutoloadActionRow(BaseModel):
    sheet: str = Field(..., min_length=1, max_length=255)
    row: int = Field(..., ge=5)


class AvitoAutoloadApplyActionRequest(BaseModel):
    action: str = Field(..., pattern="^(publish|unpublish|delete)$")
    rows: list[AvitoAutoloadActionRow] = Field(default_factory=list, min_length=1)


class AvitoAutoloadImportRequest(BaseModel):
    rows: list[AvitoAutoloadActionRow] = Field(default_factory=list, min_length=1)
    storage_location_id: int = Field(..., gt=0)
    quantity: int = Field(1, gt=0)
    use_file_price: bool = True
    sale_price: Optional[float] = Field(None, gt=0)
    update_existing: bool = False


class AvitoAutoloadImportResponse(BaseModel):
    created_products: int = 0
    updated_products: int = 0
    created_stock_ins: int = 0
    skipped_rows: list[dict[str, Any]] = Field(default_factory=list)
