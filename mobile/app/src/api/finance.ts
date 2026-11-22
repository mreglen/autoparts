import { apiGet, apiSend } from "./client";
import { shareReportXlsx } from "./reports";
import { cachedGet, invalidateEntities } from "../offline";

export type PaymentMethod = "card" | "cash" | "bank";

export const PAYMENT_METHOD_LABELS: Record<PaymentMethod, string> = {
  card: "Карта",
  cash: "Наличными",
  bank: "Расчётный счёт",
};

export interface FinanceReceipt {
  id: number;
  sequential_number: number;
  repair_order_id: number;
  repair_order_number: string;
  client_name: string;
  client_phone?: string;
  amount: number | string;
  method: PaymentMethod;
  created_at: string;
  paid_at?: string | null;
}

export interface FinanceReceiptsResponse {
  totals: {
    card: number | string;
    cash: number | string;
    bank: number | string;
  };
  total_amount: number | string;
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
  amount: number | string;
  expense_date: string;
  description?: string | null;
  employee_id?: number | null;
  employee_name?: string | null;
  created_by_user_id?: number;
  created_by_name: string;
  created_at: string;
}

export interface FinanceExpensesResponse {
  total_amount: number | string;
  count: number;
  items: FinanceExpense[];
}

export interface FinanceExpenseArticle {
  id: number;
  name: string;
}

export type FinanceExpenseType = "salary" | "other";

export interface FinanceExpensePayload {
  type?: FinanceExpenseType;
  article_id?: number | null;
  article_name?: string | null;
  amount: number;
  expense_date: string;
  description?: string | null;
  employee_id?: number | null;
}

export interface EmployeePayrollInfo {
  employee_id: number;
  employee_name: string;
  total_accrued: number | string;
  total_paid: number | string;
  remaining: number | string;
}

export interface ClientDebtRow {
  id: number;
  name: string;
  phone?: string | null;
  debt_amount: number | string;
  orders_count: number;
  orders_total: number | string;
  paid_total: number | string;
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

export function fetchExpenseArticles() {
  return cachedGet<FinanceExpenseArticle[]>("/autoservice/expense-articles");
}

export async function createExpenseArticle(
  name: string,
): Promise<FinanceExpenseArticle> {
  const row = await apiSend<FinanceExpenseArticle>(
    "POST",
    "/autoservice/expense-articles",
    { body: { name } },
  );
  await invalidateEntities(["expense-articles", "finance-expenses"]);
  return row;
}

export async function patchExpenseArticle(
  id: number,
  name: string,
): Promise<FinanceExpenseArticle> {
  const row = await apiSend<FinanceExpenseArticle>(
    "PATCH",
    `/autoservice/expense-articles/${id}`,
    { body: { name } },
  );
  await invalidateEntities(["expense-articles", "finance-expenses"]);
  return row;
}

export async function deleteExpenseArticle(id: number): Promise<void> {
  await apiSend("DELETE", `/autoservice/expense-articles/${id}`);
  await invalidateEntities(["expense-articles", "finance-expenses"]);
}

export function fetchEmployeePayrollInfo(
  employeeId: number,
  year: number,
  month: number,
) {
  return cachedGet<EmployeePayrollInfo>(
    `/autoservice/finance/expenses/employee-payroll/${employeeId}?year=${year}&month=${month}`,
  );
}

export async function createFinanceExpense(
  body: FinanceExpensePayload,
): Promise<FinanceExpense> {
  const row = await apiSend<FinanceExpense>(
    "POST",
    "/autoservice/finance/expenses",
    { body },
  );
  await invalidateEntities(["finance-expenses", "reports"]);
  return row;
}

export async function patchFinanceExpense(
  id: number,
  body: Partial<FinanceExpensePayload>,
): Promise<FinanceExpense> {
  const row = await apiSend<FinanceExpense>(
    "PATCH",
    `/autoservice/finance/expenses/${id}`,
    { body },
  );
  await invalidateEntities(["finance-expenses", "reports"]);
  return row;
}

export async function deleteFinanceExpense(id: number): Promise<void> {
  await apiSend("DELETE", `/autoservice/finance/expenses/${id}`);
  await invalidateEntities(["finance-expenses", "reports"]);
}

export function financeReceiptsXlsxPath(dateFrom: string, dateTo: string) {
  return `/autoservice/finance/receipts.xlsx?${periodParams(dateFrom, dateTo)}`;
}

export function financeExpensesXlsxPath(dateFrom: string, dateTo: string) {
  return `/autoservice/finance/expenses.xlsx?${periodParams(dateFrom, dateTo)}`;
}

export function shareFinanceReceiptsXlsx(dateFrom: string, dateTo: string) {
  return shareReportXlsx(
    financeReceiptsXlsxPath(dateFrom, dateTo),
    `autoservice_payments_${dateFrom}_${dateTo}.xlsx`,
  );
}

export function shareFinanceExpensesXlsx(dateFrom: string, dateTo: string) {
  return shareReportXlsx(
    financeExpensesXlsxPath(dateFrom, dateTo),
    `autoservice_expenses_${dateFrom}_${dateTo}.xlsx`,
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
