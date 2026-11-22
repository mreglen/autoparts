import * as FileSystem from "expo-file-system/legacy";
import * as Sharing from "expo-sharing";

import { apiBlob } from "./client";
import { cachedGet } from "../offline";

// --- Общие типы отчётов ---

export interface ReportVehicle {
  id?: number;
  make: string;
  model?: string | null;
  year?: number | null;
  plate?: string | null;
  vin?: string | null;
}

export interface OrderEconomicsRow {
  order_id: number;
  order_number: string;
  status: string;
  client_name: string;
  client_phone?: string;
  vehicle?: ReportVehicle | null;
  scheduled_at: string;
  grand_total: number | string;
  parts_cost: number | string;
  payroll_total: number | string;
  net_profit: number | string;
  paid_amount: number | string;
  remaining_amount: number | string;
  is_paid: boolean;
  payment_status: "paid" | "partial" | "unpaid";
  is_preliminary: boolean;
  works_count: number;
  shop_parts_count: number;
}

export interface OrderEconomicsSummary {
  count: number;
  revenue: number | string;
  parts_cost: number | string;
  payroll_total: number | string;
  net_profit: number | string;
  paid_amount: number | string;
  debt_amount: number | string;
  unpaid_count: number;
}

export interface OrderEconomicsResponse {
  date_from: string;
  date_to: string;
  summary: OrderEconomicsSummary;
  items: OrderEconomicsRow[];
}

export type OrderEconomicsStatusFilter =
  | "all"
  | "pending"
  | "in_progress"
  | "done"
  | "completed"
  | "cancelled";

export type OrderEconomicsPaymentFilter = "all" | "paid" | "partial" | "unpaid";

export interface OrderEconomicsParams {
  dateFrom: string;
  dateTo: string;
  status?: OrderEconomicsStatusFilter;
  payment?: OrderEconomicsPaymentFilter;
  q?: string;
}

export interface PayrollOrderRow {
  order_id: number;
  order_number: string;
  end_at?: string | null;
  vehicle?: ReportVehicle | null;
  amount: number | string;
}

export interface PayrollEmployeeRow {
  employee_id: number;
  name: string;
  completed_orders: number;
  total: number | string;
  paid: number | string;
  remaining: number | string;
  orders: PayrollOrderRow[];
}

export interface PayrollReportResponse {
  year: number;
  month: number;
  total: number | string;
  total_paid: number | string;
  total_remaining: number | string;
  employees: PayrollEmployeeRow[];
}

export interface WarehouseStockRow {
  id: number;
  brand: string;
  article: string;
  name: string;
  unit: "pcs" | "l" | "kg";
  unit_price: number | string;
  opening_qty: number;
  received_qty: number;
  expensed_qty: number;
  closing_qty: number;
  reserved_qty?: number | null;
  return_reserved_qty?: number | null;
  available_qty?: number | null;
  stock_amount: number | string;
}

export interface WarehouseStockResponse {
  year: number;
  month: number;
  as_of: string;
  is_current_month: boolean;
  summary: {
    positions: number;
    closing_value: number | string;
    opening_value: number | string;
    received_qty: number;
    expensed_qty: number;
  };
  items: WarehouseStockRow[];
}

export interface WarehouseStockParams {
  year: number;
  month: number;
  q?: string;
  hideZero?: boolean;
}

// --- Пути запросов ---

function appendSearch(qs: URLSearchParams, q?: string) {
  const value = q?.trim();
  if (value) qs.set("q", value);
}

export function orderEconomicsPath(
  params: OrderEconomicsParams,
  xlsx = false,
): string {
  const qs = new URLSearchParams({
    date_from: params.dateFrom,
    date_to: params.dateTo,
    status: params.status ?? "all",
    payment: params.payment ?? "all",
  });
  appendSearch(qs, params.q);
  return `/autoservice/reports/order-economics${xlsx ? ".xlsx" : ""}?${qs}`;
}

export function payrollPath(year: number, month: number, xlsx = false): string {
  return `/autoservice/reports/payroll${xlsx ? ".xlsx" : ""}?year=${year}&month=${month}`;
}

export function warehouseStockPath(
  params: WarehouseStockParams,
  xlsx = false,
): string {
  const qs = new URLSearchParams({
    year: String(params.year),
    month: String(params.month),
    hide_zero: String(params.hideZero ?? true),
  });
  appendSearch(qs, params.q);
  return `/autoservice/reports/warehouse-stock${xlsx ? ".xlsx" : ""}?${qs}`;
}

// --- JSON-запросы ---

export function fetchOrderEconomics(params: OrderEconomicsParams) {
  return cachedGet<OrderEconomicsResponse>(orderEconomicsPath(params));
}

export function fetchPayrollReport(year: number, month: number) {
  return cachedGet<PayrollReportResponse>(payrollPath(year, month));
}

export function fetchWarehouseStock(params: WarehouseStockParams) {
  return cachedGet<WarehouseStockResponse>(warehouseStockPath(params));
}

// --- XLSX-выгрузки ---

const XLSX_MIME =
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

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

export async function shareReportXlsx(
  path: string,
  filename: string,
): Promise<void> {
  const response = await apiBlob(path);
  const blob = await response.blob();
  const base64 = await blobToBase64(blob);
  const uri = `${FileSystem.cacheDirectory ?? ""}${filename}`;
  await FileSystem.writeAsStringAsync(uri, base64, {
    encoding: FileSystem.EncodingType.Base64,
  });
  if (await Sharing.isAvailableAsync()) {
    await Sharing.shareAsync(uri, {
      mimeType: XLSX_MIME,
      dialogTitle: "Отчёт",
      UTI: "org.openxmlformats.spreadsheetml.sheet",
    });
  }
}
