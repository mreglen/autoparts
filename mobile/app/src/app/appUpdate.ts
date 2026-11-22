import * as FileSystem from "expo-file-system/legacy";
import * as IntentLauncher from "expo-intent-launcher";

import { fetchMobileMeta, type MobileMeta } from "../api/mobile";
import { APP_VERSION } from "./appIdentity";
import { readJson, writeJson } from "../storage/kv";

export type UpdateKind = "none" | "optional" | "force";

export interface UpdateInfo {
  kind: UpdateKind;
  version: string;
  url: string;
  notes?: string | null;
}

const DISMISSED_KEY = "sg:apk-dismissed-version";

function parseVersion(version: string): number[] {
  return version
    .split(/[.-]/)
    .map((part) => parseInt(part, 10))
    .map((n) => (Number.isFinite(n) ? n : 0));
}

export function compareVersions(a: string, b: string): number {
  const pa = parseVersion(a);
  const pb = parseVersion(b);
  for (let i = 0; i < Math.max(pa.length, pb.length); i += 1) {
    const diff = (pa[i] ?? 0) - (pb[i] ?? 0);
    if (diff !== 0) return diff;
  }
  return 0;
}

function resolveApkUrl(meta: MobileMeta, url: string): string {
  if (/^https?:\/\//i.test(url)) return url;
  const base = (meta.public_base_url || "").replace(/\/+$/, "");
  if (base) return `${base}${url.startsWith("/") ? url : `/${url}`}`;
  return url;
}

export async function checkForUpdate(
  options: { ignoreDismissed?: boolean } = {},
): Promise<UpdateInfo | null> {
  let meta: MobileMeta;
  try {
    meta = await fetchMobileMeta();
  } catch {
    return null;
  }

  const minVersion = (meta.min_supported_app_version || "").trim();
  if (minVersion && compareVersions(APP_VERSION, minVersion) < 0) {
    const apk = meta.latest_apk;
    if (!apk?.url) return null;
    return {
      kind: "force",
      version: apk.version || minVersion,
      url: resolveApkUrl(meta, apk.url),
      notes: apk.notes,
    };
  }

  const apk = meta.latest_apk;
  if (!apk?.version || !apk.url) return null;
  if (compareVersions(APP_VERSION, apk.version) >= 0) return null;
  if (!options.ignoreDismissed) {
    const dismissed = await readJson<string>(DISMISSED_KEY, "");
    if (dismissed === apk.version) return null;
  }
  return {
    kind: "optional",
    version: apk.version,
    url: resolveApkUrl(meta, apk.url),
    notes: apk.notes,
  };
}

export async function dismissUpdate(version: string): Promise<void> {
  await writeJson(DISMISSED_KEY, version);
}

type ManualCheckListener = () => void;
const manualCheckListeners = new Set<ManualCheckListener>();

export function onManualUpdateCheck(listener: ManualCheckListener): () => void {
  manualCheckListeners.add(listener);
  return () => manualCheckListeners.delete(listener);
}

export function requestUpdateCheck(): void {
  manualCheckListeners.forEach((listener) => listener());
}

export interface DownloadProgress {
  (progress: number): void;
}

const APK_MAGIC_BASE64 = "UEsDBA=="; // "PK\x03\x04"
const MIN_APK_BYTES = 1024 * 1024;

async function validateApkFile(uri: string, httpStatus?: number): Promise<void> {
  if (httpStatus !== undefined && httpStatus !== 200) {
    throw new Error(`download failed: HTTP ${httpStatus}`);
  }
  const info = await FileSystem.getInfoAsync(uri);
  const size = info.exists ? info.size : 0;
  if (size < MIN_APK_BYTES) {
    throw new Error("Сервер вернул не APK-файл (файл слишком маленький)");
  }
  const head = await FileSystem.readAsStringAsync(uri, {
    encoding: FileSystem.EncodingType.Base64,
    position: 0,
    length: 4,
  });
  if (head !== APK_MAGIC_BASE64) {
    throw new Error("Скачанный файл не является APK");
  }
}

export async function downloadApk(
  url: string,
  version: string,
  onProgress?: DownloadProgress,
): Promise<string> {
  const target = `${FileSystem.cacheDirectory ?? ""}sg-autoservice-${version}.apk`;
  await FileSystem.deleteAsync(target, { idempotent: true }).catch(() => {});
  const download = FileSystem.createDownloadResumable(
    url,
    target,
    {},
    (progress) => {
      const total = progress.totalBytesExpectedToWrite;
      if (total > 0 && onProgress) {
        onProgress(progress.totalBytesWritten / total);
      }
    },
  );
  try {
    const result = await download.downloadAsync();
    if (!result?.uri) throw new Error("download failed");
    await validateApkFile(result.uri, result.status);
    return result.uri;
  } catch (e) {
    await FileSystem.deleteAsync(target, { idempotent: true }).catch(() => {});
    throw e;
  }
}

const INTENT_FLAG_GRANT_READ_URI_PERMISSION = 0x00000001;
const INTENT_FLAG_ACTIVITY_NEW_TASK = 0x10000000;

export async function installApk(uri: string): Promise<void> {
  const contentUri = await FileSystem.getContentUriAsync(uri);
  await IntentLauncher.startActivityAsync("android.intent.action.VIEW", {
    data: contentUri,
    type: "application/vnd.android.package-archive",
    flags:
      INTENT_FLAG_GRANT_READ_URI_PERMISSION | INTENT_FLAG_ACTIVITY_NEW_TASK,
  });
}
