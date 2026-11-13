import { apiGet } from "./client";

export interface LatestApkInfo {
  version?: string | null;
  url?: string | null;
  notes?: string | null;
}

export interface MobileMeta {
  server_time: string;
  timezone: string;
  utc_offset_minutes: number;
  public_base_url: string;
  min_supported_app_version?: string | null;
  latest_apk?: LatestApkInfo | null;
}

export function fetchMobileMeta(): Promise<MobileMeta> {
  return apiGet<MobileMeta>("/mobile/meta");
}
