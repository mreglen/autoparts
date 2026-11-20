import { formatMoney } from "./format";
import type {
  PurchaseNewOrder,
  PurchaseUsedOrder,
  ShopPart,
  ShopStock,
  SiteDeliveryOption,
} from "../api/partsShop";

export { formatMoney };

const monthNames = [
  "января", "февраля", "марта", "апреля", "мая", "июня",
  "июля", "августа", "сентября", "октября", "ноября", "декабря",
];
const weekdays = ["вс", "пн", "вт", "ср", "чт", "пт", "сб"];

export function truncateRubles(price: number | string | null | undefined): number {
  const amount = Number(price);
  if (!Number.isFinite(amount) || amount <= 0) return 0;
  return Math.floor(amount);
}

export function parseSupplierPrice(price: number | string | null | undefined): number {
  const numeric = parseFloat(String(price ?? ""));
  if (Number.isNaN(numeric) || numeric <= 0) return 0;
  return truncateRubles(numeric);
}

export function applyMarkup(
  price: number | string | null | undefined,
  markupPercent = 0,
): number {
  const base = parseSupplierPrice(price);
  if (!base) return 0;
  const mult = 1 + Number(markupPercent) / 100;
  return truncateRubles(base * mult);
}

export function stocksOf(part: ShopPart | null | undefined): ShopStock[] {
  const stocks = part?.stocks?.stock;
  if (!stocks) return [];
  return Array.isArray(stocks) ? stocks : [stocks];
}

export function isDeliverableStock(stock: ShopStock | null | undefined): boolean {
  if (!stock || typeof stock !== "object") return false;
  const start = stock.deliveryStart ?? stock.delivery_start;
  const end = stock.deliveryEnd ?? stock.delivery_end;
  return Boolean(start && end);
}

export function deliverableStocks(part: ShopPart | null | undefined): ShopStock[] {
  return stocksOf(part).filter(
    (s): s is ShopStock => Boolean(s && typeof s === "object") && isDeliverableStock(s),
  );
}

export function stockCount(stock: ShopStock): number {
  return parseInt(String(stock.count ?? 0), 10) || 0;
}

export function getStockCount(part: ShopPart | null | undefined): number {
  return deliverableStocks(part).reduce((sum, s) => sum + stockCount(s), 0);
}

export function getMinPrice(part: ShopPart | null | undefined): number {
  return deliverableStocks(part).reduce((min, s) => {
    const p = parseFloat(String(s.price ?? "")) || 0;
    if (!p) return min;
    return min === 0 ? p : Math.min(min, p);
  }, 0);
}

export function mapPartToStocksData(part: ShopPart | null | undefined) {
  return deliverableStocks(part).map((stock) => ({
    stock_id: String(stock.id ?? ""),
    price: parseFloat(String(stock.price ?? "")) || 0,
    available_count: stockCount(stock),
    delivery_start: stock.deliveryStart ?? stock.delivery_start ?? null,
    delivery_end: stock.deliveryEnd ?? stock.delivery_end ?? null,
    description: stock.description ?? null,
    is_preferred: Boolean(stock.is_preferred),
  }));
}

export interface ShopStockData {
  stock_id: string;
  price: number;
  available_count: number;
  delivery_start: string | null;
  delivery_end: string | null;
  description: string | null;
  is_preferred: boolean;
}

export function inStockStocks(part: ShopPart | null | undefined): ShopStockData[] {
  return mapPartToStocksData(part).filter(
    (s) => s.price > 0 && s.available_count > 0,
  );
}

export function hasInStock(part: ShopPart | null | undefined): boolean {
  return inStockStocks(part).length > 0;
}

export function normalizeArticle(value: unknown): string {
  if (!value) return "";
  return String(value).replace(/[^A-Za-z0-9А-Яа-яЁё]/gi, "").toUpperCase();
}

export function partDedupeKey(part: ShopPart | null | undefined): string {
  const guid = String(part?.guid || "").trim();
  if (guid) return guid;
  const brand = String(part?.brand || "").trim();
  const article = normalizeArticle(part?.partnumber || part?.article);
  return `${brand}|${article}`;
}

function mergeStocks(existing: ShopPart, incoming: ShopPart): ShopPart {
  const byId = new Map<string, ShopStock>();
  [...deliverableStocks(existing), ...deliverableStocks(incoming)].forEach((stock) => {
    if (stock.id == null) return;
    const id = String(stock.id);
    const prev = byId.get(id);
    if (!prev) {
      byId.set(id, stock);
      return;
    }
    const prevCount = stockCount(prev);
    const nextCount = stockCount(stock);
    if (nextCount > prevCount) {
      byId.set(id, { ...stock, is_preferred: Boolean(prev.is_preferred || stock.is_preferred) });
    } else if (stock.is_preferred && !prev.is_preferred) {
      byId.set(id, { ...prev, is_preferred: true });
    }
  });
  const merged = Array.from(byId.values());
  if (!merged.length) return existing;
  return {
    ...existing,
    stocks: { stock: merged.length === 1 ? merged[0] : merged },
  };
}

export function dedupeParts(parts: ShopPart[] | null | undefined): ShopPart[] {
  const list = Array.isArray(parts) ? parts : [];
  const byKey = new Map<string, ShopPart>();
  const order: string[] = [];
  list.forEach((part) => {
    if (!part || typeof part !== "object") return;
    const key = partDedupeKey(part);
    if (!key || key === "|") return;
    if (!byKey.has(key)) {
      byKey.set(key, part);
      order.push(key);
      return;
    }
    byKey.set(key, mergeStocks(byKey.get(key)!, part));
  });
  return order.map((key) => byKey.get(key)!);
}

function crossParts(part: ShopPart | null | undefined): ShopPart[] {
  const crosses = part?.crosses?.Part;
  if (!crosses) return [];
  return Array.isArray(crosses) ? crosses : [crosses];
}

export function collectAnalogs(parts: ShopPart[] | null | undefined): ShopPart[] {
  const list = Array.isArray(parts) ? parts : [];
  const seen = new Set<string>();
  const out: ShopPart[] = [];
  list.forEach((part) => {
    crossParts(part).forEach((cross) => {
      const key = partDedupeKey(cross);
      if (!key || key === "|" || seen.has(key)) return;
      if (!hasInStock(cross)) return;
      seen.add(key);
      out.push(cross);
    });
  });
  return out;
}

export function collectOfferParts(parts: ShopPart[] | null | undefined): ShopPart[] {
  const list = Array.isArray(parts) ? parts : [];
  const seen = new Set<string>();
  const out: ShopPart[] = [];
  const add = (part: ShopPart | null | undefined) => {
    if (!part || typeof part !== "object") return;
    if (!hasInStock(part)) return;
    const key = partDedupeKey(part);
    if (!key || key === "|" || seen.has(key)) return;
    seen.add(key);
    out.push(part);
  };
  list.forEach(add);
  collectAnalogs(list).forEach(add);
  return out;
}

export function splitOriginalAndAnalogs(
  parts: ShopPart[] | null | undefined,
  queryNorm: string,
): { originals: ShopPart[]; analogs: ShopPart[] } {
  const originals: ShopPart[] = [];
  const analogs: ShopPart[] = [];
  collectOfferParts(parts).forEach((part) => {
    const pn = normalizeArticle(part.partnumber || part.article);
    const matches = Boolean(
      queryNorm && pn && (pn === queryNorm || pn.includes(queryNorm) || queryNorm.includes(pn)),
    );
    (matches ? originals : analogs).push(part);
  });
  return { originals, analogs };
}

export function partTitle(part: ShopPart | null | undefined): string {
  return String(part?.name || part?.description || "").trim();
}

export function partArticle(part: ShopPart | null | undefined): string {
  return String(part?.partnumber || part?.article || "").trim();
}

export function partBrand(part: ShopPart | null | undefined): string {
  return String(part?.brand || "").trim();
}

export function formatDeliveryParts(
  deliveryStart: string | null | undefined,
  deliveryEnd: string | null | undefined,
): { dateLine: string; timeLine: string } | null {
  if (!deliveryStart || !deliveryEnd) return null;
  const startDate = new Date(deliveryStart);
  const endDate = new Date(deliveryEnd);
  if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime())) return null;
  const today = new Date();
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const isToday =
    startDate.getDate() === today.getDate() &&
    startDate.getMonth() === today.getMonth() &&
    startDate.getFullYear() === today.getFullYear();
  const isTomorrow =
    startDate.getDate() === tomorrow.getDate() &&
    startDate.getMonth() === tomorrow.getMonth() &&
    startDate.getFullYear() === tomorrow.getFullYear();
  const dateLine = isToday
    ? "Сегодня"
    : isTomorrow
      ? "Завтра"
      : `${startDate.getDate()} ${monthNames[startDate.getMonth()]} ${weekdays[startDate.getDay()]}`;
  const fmt = (d: Date) =>
    d.toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" });
  return { dateLine, timeLine: `с ${fmt(startDate)} до ${fmt(endDate)}` };
}

export function formatDeliveryText(
  deliveryStart: string | null | undefined,
  deliveryEnd: string | null | undefined,
): string {
  const parts = formatDeliveryParts(deliveryStart, deliveryEnd);
  if (!parts) return "—";
  return `${parts.dateLine}, ${parts.timeLine}`;
}

const FULL_NAME_REGEX =
  /^[А-ЯЁа-яё]+(?:-[А-ЯЁа-яё]+)?\s+[А-ЯЁа-яё]+(?:-[А-ЯЁа-яё]+)?(?:\s+[А-ЯЁа-яё]+(?:-[А-ЯЁа-яё]+)?)?$/;
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export function normalizeFullName(value: string): string {
  return String(value || "").replace(/\s+/g, " ").trim();
}

export function validateFullName(value: string): string {
  const normalized = normalizeFullName(value);
  if (!normalized) return "Укажите ФИО";
  if (!FULL_NAME_REGEX.test(normalized)) {
    return "Введите фамилию, имя и при необходимости отчество кириллицей";
  }
  const parts = normalized.split(" ");
  if (parts.length < 2) return "Укажите как минимум фамилию и имя";
  if (parts.some((part) => part.length < 2)) {
    return "Каждая часть ФИО должна содержать не менее 2 букв";
  }
  return "";
}

export function normalizeEmail(value: string): string {
  return String(value || "").trim().toLowerCase();
}

export function validateEmail(value: string): string {
  const raw = String(value || "");
  const email = normalizeEmail(raw);
  if (!email) return "";
  if (/\s/.test(raw)) return "Email не должен содержать пробелов";
  if (!EMAIL_REGEX.test(email)) return "Неверный формат email";
  return "";
}

function normalizePhoneDigits(digits: string): string {
  let d = String(digits || "").replace(/\D/g, "");
  if (!d) return "";
  if (d.startsWith("8")) d = `7${d.slice(1)}`;
  else if (!d.startsWith("7")) d = `7${d}`;
  return d.slice(0, 11);
}

export function formatPhoneInput(inputValue: string): string {
  const digits = normalizePhoneDigits(inputValue);
  if (!digits) return "";
  const national = digits.slice(1);
  if (national.length === 0) return "+7";
  if (national.length <= 3) return `+7 (${national}`;
  if (national.length <= 6) return `+7 (${national.slice(0, 3)}) ${national.slice(3)}`;
  if (national.length <= 8) {
    return `+7 (${national.slice(0, 3)}) ${national.slice(3, 6)}-${national.slice(6)}`;
  }
  return `+7 (${national.slice(0, 3)}) ${national.slice(3, 6)}-${national.slice(6, 8)}-${national.slice(8)}`;
}

export function validatePhone(value: string): string {
  const pure = String(value || "").replace(/\D/g, "");
  if (!pure) return "Укажите номер телефона";
  if (pure.length !== 11 || !pure.startsWith("7")) {
    return "Введите полный номер в формате +7 (___) ___-__-__";
  }
  return "";
}

export function normalizePickupOption(options: SiteDeliveryOption[] | null | undefined) {
  if (!Array.isArray(options)) return null;
  const pickups = options.filter(
    (o) => o && o.enabled !== false && o.delivery_type === "pickup",
  );
  const norm = (v: unknown) => String(v || "").trim().toLowerCase();
  return pickups.find((o) => norm(o.region_name) === "урал") || pickups[0] || null;
}

export const GARAGE_STATUS_NAMES: Record<string, string> = {
  pending: "В ожидании",
  confirmed: "Подтверждён",
  rejected: "Не подтверждён",
  assembled: "Сформирован",
  ready_for_pickup: "К выдаче",
  shipped: "В доставке",
  delivered: "Получен",
  closed: "Закрыт",
  new_waiting_confirmation: "Ждёт подтверждения",
  new_assembling: "Комплектуется",
  new_shipped: "Отгружено",
  new_awaiting_arrival: "Ожидает поступления",
  new_ready_for_pickup: "К выдаче",
  new_received: "Получен",
};

export const NEW_ORDER_BUYER_HINTS: Record<string, string> = {
  new_waiting_confirmation: "Заказ принят. Ждём подтверждения.",
  new_assembling: "Заказ комплектуется.",
  new_shipped: "Заказ отгружен поставщиком.",
  new_awaiting_arrival: "Ожидаем поступление на точку выдачи.",
  new_ready_for_pickup: "Покажите QR или назовите код при получении.",
  new_received: "Заказ получен. Спасибо за покупку!",
};

export const USED_ORDER_BUYER_HINTS: Record<string, string> = {
  pending: "Продавец проверяет наличие. Обычно отвечает в течение рабочего дня.",
  confirmed: "Заказ подтверждён. Продавец готовит товар.",
  assembled: "Заказ собран. Ожидайте передачи или доставки.",
  ready_for_pickup: "Покажите QR или назовите код при получении.",
  shipped: "Товар передан в доставку или курьеру.",
  delivered: "Заказ получен. Спасибо за покупку!",
  rejected: "Продавец не подтвердил заказ. Напишите ему в чат.",
  closed: "Заказ закрыт.",
};

export const GARAGE_ACTIVE_STATUSES = new Set([
  "pending", "confirmed", "assembled", "ready_for_pickup", "shipped",
  "new_waiting_confirmation", "new_assembling", "new_shipped",
  "new_awaiting_arrival", "new_ready_for_pickup",
]);

export const GARAGE_COMPLETED_STATUSES = new Set(["delivered", "closed", "new_received"]);

export function garageStatusLabel(code: string | null | undefined): string {
  return GARAGE_STATUS_NAMES[code || ""] || code || "В ожидании";
}

export function newOrderBuyerHint(code: string | null | undefined): string | null {
  const c = code || "new_waiting_confirmation";
  return NEW_ORDER_BUYER_HINTS[c] || null;
}

export function usedOrderBuyerHint(code: string | null | undefined): string {
  const c = code || "pending";
  return USED_ORDER_BUYER_HINTS[c] || USED_ORDER_BUYER_HINTS.pending;
}

export function garageDeliveryInfo(order: {
  delivery_method_name?: string | null;
  delivery_type?: string | null;
  delivery_region_name?: string | null;
  delivery_address?: string | null;
  pickup_address?: string | null;
  transport_company?: string | null;
} | null | undefined): string {
  if (!order) return "Способ доставки уточняется";
  if (order.delivery_method_name) return order.delivery_method_name;
  const type = order.delivery_type || "";
  const labels: Record<string, string> = {
    pickup: "Самовывоз",
    pvz: "ПВЗ",
    courier: "Курьер",
    transport: "Доставка",
  };
  const typeLabel = labels[type] || null;
  const addr = [order.delivery_region_name, order.delivery_address]
    .filter(Boolean)
    .join(", ");
  if (type === "pickup") {
    const a = order.pickup_address || addr || "адрес уточняется";
    return `${typeLabel || "Самовывоз"} · ${a}`;
  }
  if (type === "pvz" || type === "courier" || type === "transport") {
    const carrier = order.transport_company;
    if (carrier) return `${typeLabel ? `${typeLabel} · ` : ""}${carrier} · ${addr || "адрес уточняется"}`;
    return `${typeLabel || "Доставка"} · ${addr || "адрес уточняется"}`;
  }
  if (typeLabel) return `${typeLabel} · ${addr || "адрес уточняется"}`;
  return "Способ доставки уточняется";
}

export interface PurchaseOrderLike {
  id: number;
  organization_name?: string | null;
  total_amount: number;
  is_paid: boolean;
  status_code: string;
  created_at?: string | null;
  delivery_type?: string | null;
  delivery_address?: string | null;
  transport_company?: string | null;
  pickup_address?: string | null;
  delivery_region_name?: string | null;
  pickup_code?: string | null;
  pickup_qr_payload?: string | null;
  items: { id: number; name: string; brand?: string | null; partnumber?: string | null; quantity: number; price: number; status_code: string }[];
}

export function isReadyForPickup(order: PurchaseOrderLike | null | undefined): boolean {
  const code = order?.status_code || "";
  return code === "ready_for_pickup" || code === "new_ready_for_pickup";
}

export function formatGarageOrderDate(dateString: string | null | undefined): string {
  if (!dateString) return "—";
  const d = new Date(dateString);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("ru-RU", { day: "numeric", month: "short", year: "numeric" });
}

export function purchaseOrderTotal(order: PurchaseNewOrder | PurchaseUsedOrder): number {
  return Number(order.total_amount || 0);
}

export function cartTotal(items: { price?: number | null; quantity: number }[]): number {
  return items.reduce(
    (sum, item) => sum + truncateRubles(Number(item.price ?? 0)) * Math.max(0, item.quantity),
    0,
  );
}
