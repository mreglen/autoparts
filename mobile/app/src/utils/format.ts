/** Форматтеры, повторяющие веб (`financeDisplay.js`, статусы заказ-нарядов). */

export function formatMoney(
  amount: number | string | null | undefined,
): string {
  const value = Number(amount ?? 0);
  try {
    return new Intl.NumberFormat("ru-RU", {
      style: "currency",
      currency: "RUB",
      maximumFractionDigits: 0,
    }).format(value);
  } catch {
    return `${Math.round(value).toLocaleString("ru-RU")} ₽`;
  }
}

export function formatTime(value: string | null | undefined): string {
  if (!value) return "";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" });
}

export function formatDayMonth(value: string | null | undefined): string {
  if (!value) return "";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString("ru-RU", { day: "numeric", month: "short" });
}

export function toIsoDate(d: Date): string {
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${m}-${day}`;
}

const LEGACY_STATUS_MAP: Record<string, string> = {
  accepted: "pending",
  ready: "completed",
  issued: "completed",
  open: "pending",
};

export const ORDER_STATUS_LABELS: Record<string, string> = {
  pending: "Ожидание",
  in_progress: "В работе",
  done: "Выполнен",
  completed: "Закрыт",
  cancelled: "Отменён",
  review: "На проверке",
};

export function normalizeOrderStatus(
  status: string | null | undefined,
): string {
  const raw = (status ?? "").toLowerCase();
  return LEGACY_STATUS_MAP[raw] ?? raw;
}

export function orderStatusLabel(status: string | null | undefined): string {
  const normalized = normalizeOrderStatus(status);
  return ORDER_STATUS_LABELS[normalized] ?? normalized ?? "—";
}

/** Клиентские формулировки статусов заказ-наряда (не staff-термины). */
export const CLIENT_ORDER_STATUS_LABELS: Record<string, string> = {
  pending: "Запланирован",
  in_progress: "Авто у мастера",
  done: "Выполнен",
  completed: "Завершён",
  cancelled: "Отменён",
  review: "На проверке",
};

export function clientOrderStatusLabel(
  status: string | null | undefined,
): string {
  const normalized = normalizeOrderStatus(status);
  return (
    CLIENT_ORDER_STATUS_LABELS[normalized] ??
    ORDER_STATUS_LABELS[normalized] ??
    normalized ??
    "—"
  );
}

/** Клиентские формулировки статусов записи на осмотр. */
export const CLIENT_BOOKING_STATUS_LABELS: Record<string, string> = {
  new: "Отправлена",
  confirmed: "Подтверждена",
  processed: "Обработана",
  cancelled: "Отменена",
};

export function clientBookingStatusLabel(
  status: string | null | undefined,
): string {
  const normalized = (status ?? "").toLowerCase();
  return CLIENT_BOOKING_STATUS_LABELS[normalized] ?? normalized ?? "—";
}

export function parseServerDate(
  value: string | Date | null | undefined,
): Date | null {
  if (value == null || value === "") return null;
  if (value instanceof Date) return value;

  const raw = String(value).trim();
  if (!raw) return null;

  if (/[zZ]$|[+-]\d{2}:?\d{2}$/.test(raw)) {
    const d = new Date(raw);
    return Number.isNaN(d.getTime()) ? null : d;
  }

  const normalized = raw.includes("T") ? raw : raw.replace(" ", "T");
  const d = new Date(`${normalized}Z`);
  return Number.isNaN(d.getTime()) ? null : d;
}

export function parseWallClockDate(
  value: string | Date | null | undefined,
): Date | null {
  if (value == null || value === "") return null;
  if (value instanceof Date) return value;

  const raw = String(value).trim();
  if (!raw) return null;

  const naive = raw.replace(" ", "T").replace(/([zZ]|[+-]\d{2}:?\d{2})$/, "");
  const d = new Date(naive.length === 10 ? `${naive}T00:00:00` : naive);
  return Number.isNaN(d.getTime()) ? null : d;
}

export function formatServerDate(
  value: string | Date | null | undefined,
): string {
  if (!value) return "—";
  const raw = String(value).trim();
  const dateOnly = raw.slice(0, 10);
  if (
    /^\d{4}-\d{2}-\d{2}$/.test(dateOnly) &&
    (raw.length === 10 || raw[10] === "T" || raw[10] === " ")
  ) {
    const parts = dateOnly.split("-");
    return `${parts[2]}.${parts[1]}.${parts[0]}`;
  }

  const d = parseServerDate(value);
  if (!d) return raw || "—";
  return d.toLocaleDateString("ru-RU", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

export function formatServerDateTime(
  value: string | Date | null | undefined,
): string {
  if (!value) return "—";
  const fallback = String(value).trim();
  const d = parseServerDate(value);
  if (!d) return fallback || "—";
  return d.toLocaleString("ru-RU", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/** Значение для поля даты: берём YYYY-MM-DD из строки как есть (как `toDateInputValue` на вебе). */
export function toDateInputValue(
  value: string | Date | null | undefined,
): string {
  if (value == null || value === "") return "";
  const raw = String(value).trim();
  const dateOnly = raw.slice(0, 10);
  if (/^\d{4}-\d{2}-\d{2}$/.test(dateOnly)) return dateOnly;
  const d = parseServerDate(value);
  if (!d) return "";
  return toIsoDate(d);
}

export function formatWallClockDateTime(
  value: string | Date | null | undefined,
): string {
  if (!value) return "—";
  const fallback = String(value).trim();
  const d = parseWallClockDate(value);
  if (!d) return fallback || "—";
  return d.toLocaleString("ru-RU", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function greetingByHour(hour: number): string {
  if (hour < 5) return "Доброй ночи";
  if (hour < 12) return "Доброе утро";
  if (hour < 18) return "Добрый день";
  return "Добрый вечер";
}

export function plural(
  count: number,
  one: string,
  few: string,
  many: string,
): string {
  const mod100 = Math.abs(count) % 100;
  const mod10 = mod100 % 10;
  if (mod100 > 10 && mod100 < 20) return many;
  if (mod10 > 1 && mod10 < 5) return few;
  if (mod10 === 1) return one;
  return many;
}
