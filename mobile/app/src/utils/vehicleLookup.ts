/** Порт web-утилит laximoVin/laximoPlate/vehicleLookupKind/laximoVinCandidate
 *  для клиентского гаража в мобильном приложении. */

import type { VehicleDecodeCandidate } from "../api/clientAccount";

export const VIN_MIN_LENGTH = 11;
export const VIN_MAX_LENGTH = 17;
export const VIN_INPUT_MAX_LENGTH = 32;

const VIN_FORBIDDEN = /[IOQ]/;
const VIN_ALLOWED = /^[A-HJ-NPR-Z0-9]+$/;
const RELAXED_VIN_ALLOWED = /^[A-Z0-9]+$/;
const SHORT_VIN_MAX_DIGIT_RATIO = 0.65;
const SHORT_VIN_MIN_LETTERS = 3;
const FULL_VIN_MIN_LETTERS = 3;

const CYR_TO_LATIN: Record<string, string> = {
  А: "A",
  В: "B",
  Е: "E",
  К: "K",
  М: "M",
  Н: "H",
  О: "O",
  Р: "P",
  С: "C",
  Т: "T",
  У: "Y",
  Х: "X",
};

const LATIN_TO_CYR: Record<string, string> = {
  A: "А",
  B: "В",
  E: "Е",
  K: "К",
  M: "М",
  H: "Н",
  O: "О",
  P: "Р",
  C: "С",
  T: "Т",
  Y: "У",
  X: "Х",
};

const PLATE_ALLOWED = new Set("АВЕКМНОРСТУХ0123456789".split(""));

export type VehicleLookupKind = "vin" | "plate" | "frame";

function letterAndDigitStats(norm: string) {
  let letters = 0;
  let digits = 0;
  for (const ch of norm) {
    if (ch >= "A" && ch <= "Z") letters += 1;
    else if (ch >= "0" && ch <= "9") digits += 1;
  }
  return { letters, digits };
}

function looksLikePartNumber(norm: string): boolean {
  const length = norm.length;
  if (length < VIN_MIN_LENGTH) return true;

  const { letters, digits } = letterAndDigitStats(norm);
  if (letters < FULL_VIN_MIN_LETTERS) return true;

  if (length < VIN_MAX_LENGTH) {
    if (letters < SHORT_VIN_MIN_LETTERS) return true;

    let leadingLetters = 0;
    while (leadingLetters < length && /[A-Z]/.test(norm[leadingLetters])) {
      leadingLetters += 1;
    }
    if (leadingLetters >= SHORT_VIN_MIN_LETTERS && leadingLetters < length) {
      const rest = norm.slice(leadingLetters);
      if (/^\d+$/.test(rest) && rest[0] !== "0") return false;
    }

    const total = letters + digits;
    if (total > 0 && digits / total >= SHORT_VIN_MAX_DIGIT_RATIO) return true;
  }

  return false;
}

export function sanitizeVinInput(value: string | null | undefined): string {
  if (value == null) return "";
  let text = String(value).trim().toUpperCase();
  text = text.replace(/[АВЕКМНОРСТУХ]/g, (ch) => CYR_TO_LATIN[ch] ?? ch);
  text = text.replace(/[\s\-–—_./\\]+/g, "");
  return text.slice(0, VIN_MAX_LENGTH);
}

export function looksLikeVin(value: string | null | undefined): boolean {
  const norm = sanitizeVinInput(value);
  if (norm.length < VIN_MIN_LENGTH || norm.length > VIN_MAX_LENGTH)
    return false;
  if (VIN_FORBIDDEN.test(norm)) return false;
  if (!VIN_ALLOWED.test(norm)) return false;
  if (!/[A-Z]/.test(norm)) return false;
  if (looksLikePartNumber(norm)) return false;
  return true;
}

function rewriteCommonVinOcrConfusions(norm: string): string {
  return norm.replace(/O/g, "0").replace(/Q/g, "0").replace(/I/g, "1");
}

function looksLikeRelaxedChassis(norm: string): boolean {
  if (norm.length < VIN_MIN_LENGTH || norm.length > VIN_MAX_LENGTH)
    return false;
  if (!RELAXED_VIN_ALLOWED.test(norm)) return false;
  if (!/[A-Z]/.test(norm)) return false;
  if (looksLikePartNumber(norm)) return false;
  return true;
}

function resolveVinForLookup(norm: string): string | null {
  for (const candidate of [norm, rewriteCommonVinOcrConfusions(norm)]) {
    if (looksLikeVin(candidate)) return candidate;
  }
  return null;
}

/** Строгий ISO VIN с OCR-фиксами — для lookup и хранения. */
export function normalizeVinOrNull(
  value: string | null | undefined,
): string | null {
  if (!looksLikeVin(value)) return null;
  return sanitizeVinInput(value);
}

/** VIN для Laximo-lookup: строгий ISO VIN с OCR-фиксами I→1, O/Q→0. */
export function normalizeVinForLookupOrNull(
  value: string | null | undefined,
): string | null {
  const norm = sanitizeVinInput(value);
  if (norm.length < VIN_MIN_LENGTH || norm.length > VIN_MAX_LENGTH) return null;
  return resolveVinForLookup(norm);
}

/** Нормализация VIN для сохранения в гараж (вкл. «мягкие» frame-номера). */
export function normalizeGarageVinOrNull(
  value: string | null | undefined,
): string | null {
  const norm = sanitizeVinInput(value);
  if (norm.length < VIN_MIN_LENGTH || norm.length > VIN_MAX_LENGTH) return null;
  const resolved = resolveVinForLookup(norm);
  if (resolved) return resolved;
  if (looksLikeRelaxedChassis(norm)) return norm;
  return null;
}

export function normalizePlate(value: string | null | undefined): string {
  if (value == null) return "";
  let text = String(value).trim().toUpperCase();
  text = text.replace(/[\s\-–—]+/g, "");
  text = text.replace(/[ABEKMHOPCTYX]/g, (ch) => LATIN_TO_CYR[ch] ?? ch);
  return text;
}

export function looksLikeRuPlate(value: string | null | undefined): boolean {
  const norm = normalizePlate(value);
  if (norm.length < 6 || norm.length > 12) return false;
  return [...norm].every((ch) => PLATE_ALLOWED.has(ch));
}

/** Определяет тип поискового ввода: VIN / госномер РФ / frame (корпусной номер). */
export function detectVehicleLookupKind(
  value: string | null | undefined,
): VehicleLookupKind | null {
  const raw = String(value || "").trim();
  if (!raw) return null;
  if (looksLikeVin(raw)) return "vin";
  if (looksLikeRuPlate(raw)) return "plate";

  const compact = raw.toUpperCase().replace(/\s+/g, "");
  if (compact.includes("-") && compact.length >= 6) return "frame";
  if (compact.length >= 6 && /^[A-Z0-9-]+$/.test(compact)) return "frame";
  return null;
}

export function formatVehicleLookupInput(
  value: string | null | undefined,
): string {
  const raw = String(value || "");
  if (looksLikeVin(raw)) return sanitizeVinInput(raw);
  if (looksLikeRuPlate(raw)) {
    return raw.toUpperCase().replace(/\s+/g, " ").trimStart();
  }
  return raw.toUpperCase().replace(/\s+/g, "").trimStart();
}

export function candidateLabel(candidate: VehicleDecodeCandidate): string {
  const parts = [
    candidate.display_name ||
      [candidate.make, candidate.model].filter(Boolean).join(" "),
    candidate.year != null ? String(candidate.year) : null,
    candidate.engine || null,
  ].filter(Boolean);
  return parts.join(" · ");
}

export interface GarageVehicleFormFields {
  vin: string;
  make: string;
  model: string;
  year: string;
  color: string;
  plate: string;
  notes: string;
}

function isUnknownLabel(value: string | null | undefined): boolean {
  const text = String(value || "").trim();
  if (!text) return true;
  return /^\[?unknown\]?$/i.test(text);
}

function resolveCandidateModel(candidate: VehicleDecodeCandidate): string {
  const model = String(candidate.model || "").trim();
  if (model && !isUnknownLabel(model)) return model;
  const display = String(candidate.display_name || "").trim();
  if (!display) return "";
  const make = String(candidate.make || "").trim();
  if (make && display.toUpperCase().startsWith(make.toUpperCase())) {
    return display.slice(make.length).trim();
  }
  return display;
}

/** Подстановка данных кандидата Laximo в поля формы. */
export function mapCandidateToGarageForm(
  candidate: VehicleDecodeCandidate | null,
  vin: string,
  plate = "",
): GarageVehicleFormFields {
  const resolvedVin = normalizeVinOrNull(vin) ?? "";
  if (!candidate) {
    return {
      vin: resolvedVin,
      make: "",
      model: "",
      year: "",
      color: "",
      plate,
      notes: "",
    };
  }
  return {
    vin: resolvedVin,
    make: candidate.make || "",
    model: resolveCandidateModel(candidate),
    year: candidate.year != null ? String(candidate.year) : "",
    color: candidate.color || "",
    plate,
    notes: "",
  };
}

export interface GarageVehicleCreatePayload {
  vin?: string | null;
  make: string;
  model?: string | null;
  year?: number | null;
  color?: string | null;
  plate?: string | null;
  notes?: string | null;
  source?: string;
  laximo_catalog?: string | null;
  laximo_vehicle_id?: string | null;
  laximo_attributes?: Record<string, unknown>[] | null;
}

/** Сборка payload создания авто из формы и выбранного кандидата. */
export function mapCandidateToCreatePayload(
  candidate: VehicleDecodeCandidate | null,
  fields: GarageVehicleFormFields,
  opts: { fromPlate?: boolean; fromFrame?: boolean; frameQuery?: string } = {},
): GarageVehicleCreatePayload {
  const base: GarageVehicleCreatePayload = {
    vin: fields.vin.trim() || null,
    make: fields.make.trim(),
    model: fields.model.trim() || null,
    year: fields.year ? Number(fields.year) : null,
    color: fields.color.trim() || null,
    plate: fields.plate.trim() || null,
    notes: fields.notes.trim() || null,
  };
  if (!candidate) return { ...base, source: "manual" };

  const hasCatalog = Boolean(candidate.catalog || candidate.vehicle_id);
  let source = "laximo";
  if (opts.fromPlate) source = hasCatalog ? "laximo" : "plate";
  else if (opts.fromFrame) source = hasCatalog ? "laximo" : "frame";

  let attrs = Array.isArray(candidate.attributes_raw)
    ? [...candidate.attributes_raw]
    : null;
  if (opts.fromFrame && opts.frameQuery) {
    attrs = attrs || [];
    attrs.push({ key: "frame_query", value: opts.frameQuery });
  }
  return {
    ...base,
    source,
    laximo_catalog: candidate.catalog ?? null,
    laximo_vehicle_id: candidate.vehicle_id ?? null,
    laximo_attributes: attrs,
  };
}
