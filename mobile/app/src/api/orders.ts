import * as FileSystem from "expo-file-system/legacy";
import * as Sharing from "expo-sharing";

import { apiBlob, apiGet, apiSend } from "./client";
import { cachedGet, invalidateEntities } from "../offline";

export type OrderSortBy = "scheduled_at" | "scheduled_end_at";
export type PaymentFilter = "unpaid" | "partial" | "paid";

export interface OrderListItem {
  id: number;
  order_number?: string | null;
  client_id?: number;
  status: string;
  scheduled_at?: string | null;
  scheduled_end_at?: string | null;
  inspection_scheduled_at?: string | null;
  created_at?: string | null;
  client?: {
    id?: number;
    name?: string;
    phone?: string | null;
  } | null;
  vehicle?: {
    id?: number;
    make?: string | null;
    model?: string | null;
    year?: number | null;
    plate?: string | null;
  } | null;
  work_zone_id?: number | null;
  work_zone?: { id: number; name: string } | null;
  grand_total?: number | string | null;
  paid_amount?: number | string | null;
  remaining_amount?: number | string | null;
  is_paid?: boolean;
}

export interface OrderListPage {
  items: OrderListItem[];
  total: number;
  has_more: boolean;
}

export interface WorkZone {
  id: number;
  name: string;
  sort_order?: number;
}

export interface OrderListParams {
  statuses?: string[];
  /** 'none' — заказы без зоны (как в веб-фильтре). */
  workZoneIds?: (number | "none")[];
  payments?: PaymentFilter[];
  q?: string;
  dateFrom?: string;
  dateTo?: string;
  sortBy?: OrderSortBy;
  sortDir?: "asc" | "desc";
  limit?: number;
  offset?: number;
}

export function orderListPath(params: OrderListParams = {}): string {
  const qs = new URLSearchParams();
  qs.set("scope", "all");
  qs.set("limit", String(params.limit ?? 50));
  qs.set("offset", String(params.offset ?? 0));
  qs.set("sort_by", params.sortBy ?? "scheduled_at");
  qs.set("sort_dir", params.sortDir ?? "desc");
  for (const s of params.statuses ?? []) qs.append("status", s);
  for (const z of params.workZoneIds ?? []) {
    qs.append("work_zone_id", String(z));
  }
  for (const p of params.payments ?? []) qs.append("payment", p);
  const q = params.q?.trim();
  if (q) qs.set("q", q);
  if (params.dateFrom) qs.set("date_from", params.dateFrom);
  if (params.dateTo) qs.set("date_to", params.dateTo);
  return `/autoservice/repair-orders?${qs.toString()}`;
}

export function fetchOrders(params: OrderListParams = {}) {
  return cachedGet<OrderListPage>(orderListPath(params));
}

export function fetchWorkZones() {
  return cachedGet<{
    work_zones: WorkZone[];
    vat_rate?: number | string;
  }>("/autoservice/repair-orders/work-zones-meta");
}

/** Статус оплаты как на вебе: is_paid → paid, иначе по paid_amount. */
export function orderPaymentStatus(
  order: Pick<OrderListItem, "is_paid" | "paid_amount">,
): PaymentFilter {
  if (order.is_paid) return "paid";
  return Number(order.paid_amount ?? 0) > 0 ? "partial" : "unpaid";
}

export const PAYMENT_LABELS: Record<PaymentFilter, string> = {
  unpaid: "Не оплачено",
  partial: "Частично оплачено",
  paid: "Оплачено",
};

export async function invalidateOrders(): Promise<void> {
  await invalidateEntities(["repair-orders"]);
}

// --- Карточка заказ-наряда (этап 9) ---

export interface OrderWorkExecutor {
  employee_id: number;
  employee?: { id: number; name: string } | null;
  percent: number | string;
  pay_amount?: number | string;
}

export interface OrderWorkContractor {
  contractor_id: number;
  contractor?: { id: number; name: string } | null;
  amount: number | string;
}

export interface OrderWork {
  id: number;
  position: number;
  title: string;
  qty: number;
  unit_price: number | string;
  line_sum: number | string;
  executors: OrderWorkExecutor[];
  contractors: OrderWorkContractor[];
}

export interface OrderClientPart {
  id: number;
  position: number;
  title: string;
  qty: number;
  unit: string;
}

export interface OrderShopPart {
  id: number;
  position: number;
  title: string;
  display_name?: string;
  qty: number | string;
  unit: string;
  unit_price: number | string;
  markup_percent?: number | string;
  price_with_markup?: number | string;
  line_sum: number | string;
}

export interface OrderDelivery {
  id: number;
  position: number;
  title: string;
  price: number | string;
}

export interface OrderDetail extends OrderListItem {
  vehicle_id?: number | null;
  client_comment?: string | null;
  staff_comment?: string | null;
  mileage_km?: number | null;
  accepted_by?: { id: number; name: string } | null;
  created_by?: { id: number; name: string } | null;
  assignees?: { id: number; name: string }[];
  status_completed_at?: string | null;
  vat_rate?: number | string;
  discount_percent?: number | string;
  works_total?: number | string;
  shop_parts_total?: number | string;
  deliveries_total?: number | string;
  works: OrderWork[];
  client_parts: OrderClientPart[];
  shop_parts: OrderShopPart[];
  deliveries: OrderDelivery[];
}

export function fetchOrder(id: number) {
  return cachedGet<OrderDetail>(`/autoservice/repair-orders/${id}`);
}

export interface OrderPayment {
  id: number;
  sequential_number: number;
  method: string;
  amount: number | string;
  created_at?: string;
  paid_at?: string | null;
  is_cancelled?: boolean;
}

/** Оплаты не кешируем: статусы оплаты — только онлайн (правило офлайн-политики). */
export async function fetchOrderPayments(id: number): Promise<OrderPayment[]> {
  const data = await apiGet<{ items?: OrderPayment[] }>(
    `/autoservice/repair-orders/${id}/payments`,
  );
  return Array.isArray(data?.items) ? data.items : [];
}

export const ORDER_STATUS_ACTIONS = [
  { value: "pending", label: "Ожидание" },
  { value: "in_progress", label: "В работу" },
  { value: "done", label: "Выполнен" },
  { value: "completed", label: "Закрыт" },
  { value: "cancelled", label: "Отменить" },
] as const;

export async function patchOrderStatus(
  id: number,
  status: string,
): Promise<OrderDetail> {
  const row = await apiSend<OrderDetail>(
    "PATCH",
    `/autoservice/repair-orders/${id}/status`,
    { body: { status } },
  );
  await invalidateOrders();
  return row;
}

export const PAYMENT_METHOD_LABELS: Record<string, string> = {
  cash: "Наличными",
  card: "Банковской картой",
  bank: "На расчётный счёт",
};

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const result = String(reader.result ?? "");
      resolve(result.slice(result.indexOf(",") + 1));
    };
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}

/** PDF заказ-наряда → системный «Поделиться» (печать, WhatsApp, файлы). */
export async function shareOrderPdf(id: number): Promise<void> {
  const response = await apiBlob(`/autoservice/repair-orders/${id}/pdf`);
  const blob = await response.blob();
  const base64 = await blobToBase64(blob);
  const uri = `${FileSystem.cacheDirectory ?? ""}order-${id}.pdf`;
  await FileSystem.writeAsStringAsync(uri, base64, {
    encoding: FileSystem.EncodingType.Base64,
  });
  if (await Sharing.isAvailableAsync()) {
    await Sharing.shareAsync(uri, {
      mimeType: "application/pdf",
      dialogTitle: "Заказ-наряд",
      UTI: "com.adobe.pdf",
    });
  }
}
