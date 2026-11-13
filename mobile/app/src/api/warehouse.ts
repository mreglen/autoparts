import { apiSend } from "./client";
import { cachedGet, invalidateEntities } from "../offline";

export interface WarehouseItem {
  id: number;
  brand: string;
  article: string;
  name: string;
  quantity: number;
  reserved_qty: number;
  return_reserved_qty: number;
  available_qty: number;
  unit: "pcs" | "l" | "kg";
  unit_price: number;
}

export interface Page<T> {
  items: T[];
  total: number;
  has_more: boolean;
}

export interface ItemReservation {
  repair_order_id: number;
  repair_order_number?: string | null;
  order_status: string;
  qty: number;
  unit: string;
}

export interface MovementEvent {
  kind: "receipt" | "expense" | "return" | "return_pending";
  date: string;
  quantity: number;
  unit: string;
  title: string;
  detail?: string | null;
  unit_price?: number | null;
  repair_order_id?: number | null;
  repair_order_number?: string | null;
  balance_after?: number | null;
}

export interface ItemMovements {
  item_id: number;
  brand: string;
  article: string;
  name: string;
  quantity: number;
  reserved_qty: number;
  available_qty: number;
  unit: string;
  unit_price: number;
  events: MovementEvent[];
}

export interface WarehouseReturn {
  id: number;
  receipt_id: number;
  item_id: number;
  brand: string;
  article: string;
  name: string;
  quantity: number;
  unit_price: number;
  reason: string;
  comment?: string | null;
  status_code: string;
  supplier_name?: string | null;
  created_at: string;
}

export interface PurchaseLot {
  receipt_id: number;
  item_id: number;
  supplier_name: string;
  brand: string;
  article: string;
  name: string;
  unit: string;
  quantity: number;
  returned_qty: number;
  max_returnable_qty: number;
  unit_price: number;
  created_at: string;
}

const WAREHOUSE = "/autoservice/warehouse";

export function fetchWarehouseItems(params: {
  q?: string;
  availableOnly?: boolean;
  excludeZero?: boolean;
  limit?: number;
  offset?: number;
}) {
  const sp = new URLSearchParams();
  if (params.q) sp.set("q", params.q);
  if (params.availableOnly) sp.set("available_only", "true");
  if (params.excludeZero) sp.set("exclude_zero_qty", "true");
  sp.set("limit", String(params.limit ?? 50));
  sp.set("offset", String(params.offset ?? 0));
  return cachedGet<Page<WarehouseItem>>(
    `${WAREHOUSE}/items/page?${sp.toString()}`,
  );
}

export function fetchItemReservations(itemId: number) {
  return cachedGet<ItemReservation[]>(
    `${WAREHOUSE}/items/${itemId}/reservations`,
  );
}

export function fetchItemMovements(itemId: number) {
  return cachedGet<ItemMovements>(`${WAREHOUSE}/items/${itemId}/movements`);
}

export function createReceipt(payload: {
  brand?: string;
  article?: string;
  name: string;
  quantity: number;
  unit: "pcs" | "l" | "kg";
  unit_price: number;
}) {
  return apiSend("POST", `${WAREHOUSE}/receipts`, { body: payload }).then(
    (r) => {
      void invalidateEntities(["warehouse", "warehouse-items"]);
      return r;
    },
  );
}

export function createExpense(payload: {
  item_id: number;
  quantity: number;
  reason?: string;
}) {
  return apiSend("POST", `${WAREHOUSE}/expenses`, { body: payload }).then(
    (r) => {
      void invalidateEntities(["warehouse", "warehouse-items"]);
      return r;
    },
  );
}

export function fetchReturns() {
  return cachedGet<WarehouseReturn[]>(`${WAREHOUSE}/returns`);
}

export function fetchPurchaseLots() {
  return cachedGet<PurchaseLot[]>(`${WAREHOUSE}/purchase-lots`);
}

export function createReturn(payload: {
  receipt_id: number;
  quantity: number;
  reason: string;
  comment?: string;
}) {
  return apiSend("POST", `${WAREHOUSE}/returns`, { body: payload }).then(
    (r) => {
      void invalidateEntities(["warehouse", "warehouse-items"]);
      return r;
    },
  );
}

export const UNIT_LABELS: Record<string, string> = {
  pcs: "шт",
  l: "л",
  kg: "кг",
};

export const RETURN_STATUS_LABELS: Record<string, string> = {
  requested: "Запрошен",
  reviewing: "На проверке",
  approved: "Одобрен",
  rejected: "Отклонён",
  cancelled: "Отменён",
  sent: "Отправлен",
  refunded: "Возвращён",
  closed: "Закрыт",
};

export const RETURN_REASON_LABELS: Record<string, string> = {
  defect: "Брак",
  wrong_item: "Не тот товар",
  not_as_described: "Не соответствует описанию",
  changed_mind: "Передумал",
  other: "Другое",
};
