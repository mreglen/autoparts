from pydantic import BaseModel


class LatestApkInfo(BaseModel):
    version: str | None = None
    url: str | None = None
    notes: str | None = None


class MobileMetaResponse(BaseModel):
    server_time: str
    timezone: str
    utc_offset_minutes: int
    public_base_url: str
    min_supported_app_version: str | None = None
    latest_apk: LatestApkInfo | None = None
