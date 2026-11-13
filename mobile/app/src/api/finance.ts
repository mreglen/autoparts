import { apiGet, apiSend } from "./client";
import { cachedGet, invalidateEntities } from "../offline";

export type PaymentMethod = "card" | "cash" | "bank";

export const PAYMENT_METHOD_LABELS: Record<PaymentMethod, string> = {
  card: "Карта",
  cash: "Наличные",
  bank: "Безнал",
};

export interface FinanceReceipt {
  id: number;
  sequential_number: number;
  repair_order_id: number;
  repair_order_number: string;
  client_name: string;
  client_phone?: string;
  amount: number;
  method: PaymentMethod;
  created_at: string;
  paid_at?: string | null;
}

export interface FinanceReceiptsResponse {
  totals: { card: number; cash: number; bank: number };
  total_amount: number;
  count: number;
  items: FinanceReceipt[];
  limit?: number | null;
  offset: number;
  total: number;
  has_more: boolean;
  fetched_at: string;
}

export interface FinanceExpense {
  id: number;
  type: "salary" | "other";
  type_label: string;
  article_id?: number | null;
  article_name?: string | null;
  amount: number;
  expense_date: string;
  description?: string | null;
  employee_id?: number | null;
  employee_name?: string | null;
  created_by_name: string;
  created_at: string;
}

export interface FinanceExpensesResponse {
  total_amount: number;
  count: number;
  items: FinanceExpense[];
}

export interface ClientDebtRow {
  id: number;
  name: string;
  phone?: string | null;
  debt_amount: number;
  orders_count: number;
  orders_total: number;
  paid_total: number;
  last_visit_at?: string | null;
}

function periodParams(dateFrom: string, dateTo: string) {
  return `date_from=${dateFrom}&date_to=${dateTo}`;
}

export function fetchFinanceReceipts(params: {
  dateFrom: string;
  dateTo: string;
  limit?: number;
  offset?: number;
}) {
  const sp = new URLSearchParams(periodParams(params.dateFrom, params.dateTo));
  if (params.limit) sp.set("limit", String(params.limit));
  if (params.offset) sp.set("offset", String(params.offset));
  // Поступления = оплаты: только онлайн, без кэша (как finance/payments).
  return apiGet<FinanceReceiptsResponse>(
    `/autoservice/finance/receipts?${sp.toString()}`,
  );
}

export function fetchFinanceExpenses(dateFrom: string, dateTo: string) {
  return cachedGet<FinanceExpensesResponse>(
    `/autoservice/finance/expenses?${periodParams(dateFrom, dateTo)}`,
  );
}

export async function patchFinanceReceipt(
  id: number,
  body: { paid_at?: string; amount?: number; method?: PaymentMethod },
): Promise<FinanceReceipt> {
  const row = await apiSend<FinanceReceipt>(
    "PATCH",
    `/autoservice/finance/receipts/${id}`,
    { body },
  );
  await invalidateEntities(["repair-orders", "finance-transactions"]);
  return row;
}

export async function deleteFinanceReceipt(id: number): Promise<void> {
  await apiSend("DELETE", `/autoservice/finance/receipts/${id}`);
  await invalidateEntities(["repair-orders", "finance-transactions"]);
}

export function fetchClientsWithDebt(params: {
  q?: string;
  limit?: number;
  offset?: number;
}) {
  const sp = new URLSearchParams();
  if (params.q) sp.set("q", params.q);
  sp.set("limit", String(params.limit ?? 100));
  sp.set("offset", String(params.offset ?? 0));
  return cachedGet<{
    items: ClientDebtRow[];
    total: number;
    has_more: boolean;
  }>(`/autoservice/clients/page?${sp.toString()}`);
}

export async function createOrderPayment(
  orderId: number,
  body: { method: PaymentMethod; amount: number; paid_at?: string },
) {
  const row = await apiSend(
    "POST",
    `/autoservice/repair-orders/${orderId}/payments`,
    { body },
  );
  await invalidateEntities(["repair-orders"]);
  return row;
}
