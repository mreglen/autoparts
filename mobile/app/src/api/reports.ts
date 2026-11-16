import * as FileSystem from "expo-file-system/legacy";
import * as Sharing from "expo-sharing";

import { apiBlob } from "./client";
import { cachedGet } from "../offline";

// --- Общие типы отчётов ---

export interface OrderEconomicsRow {
  order_id: number;
  order_number: string;
  status: string;
  client_name: string;
  client_phone?: string;
  vehicle?: {
    make: string;
    model?: string | null;
    plate?: string | null;
  } | null;
  scheduled_at: string;
  grand_total: number;
  parts_cost: number;
  payroll_total: number;
  net_profit: number;
  paid_amount: number;
  remaining_amount: number;
  is_paid: boolean;
  payment_status: "paid" | "partial" | "unpaid";
  is_preliminary: boolean;
}

export interface OrderEconomicsSummary {
  count: number;
  revenue: number;
  parts_cost: number;
  payroll_total: number;
  net_profit: number;
  paid_amount: number;
  debt_amount: number;
  unpaid_count: number;
}

export interface OrderEconomicsResponse {
  date_from: string;
  date_to: string;
  summary: OrderEconomicsSummary;
  items: OrderEconomicsRow[];
}

export interface PayrollOrderRow {
  order_id: number;
  order_number: string;
  end_at?: string | null;
  vehicle?: {
    make: string;
    model?: string | null;
    plate?: string | null;
  } | null;
  amount: number;
}

export interface PayrollEmployeeRow {
  employee_id: number;
  name: string;
  completed_orders: number;
  total: number;
  paid: number;
  remaining: number;
  orders: PayrollOrderRow[];
}

export interface PayrollReportResponse {
  year: number;
  month: number;
  total: number;
  total_paid: number;
  total_remaining: number;
  employees: PayrollEmployeeRow[];
}

export interface WarehouseStockRow {
  id: number;
  brand: string;
  article: string;
  name: string;
  unit: "pcs" | "l" | "kg";
  unit_price: number;
  opening_qty: number;
  received_qty: number;
  expensed_qty: number;
  closing_qty: number;
  reserved_qty?: number | null;
  return_reserved_qty?: number | null;
  available_qty?: number | null;
  stock_amount: number;
}

export interface WarehouseStockResponse {
  year: number;
  month: number;
  as_of: string;
  is_current_month: boolean;
  summary: {
    positions: number;
    closing_value: number;
    opening_value: number;
    received_qty: number;
    expensed_qty: number;
  };
  items: WarehouseStockRow[];
}

// --- Запросы ---

function monthBounds(year: number, month: number) {
  const from = `${year}-${String(month).padStart(2, "0")}-01`;
  const last = new Date(year, month, 0).getDate();
  const to = `${year}-${String(month).padStart(2, "0")}-${String(last).padStart(2, "0")}`;
  return { from, to };
}

export function fetchOrderEconomics(year: number, month: number, q = "") {
  const { from, to } = monthBounds(year, month);
  const qs = new URLSearchParams({
    date_from: from,
    date_to: to,
    status: "all",
    payment: "all",
  });
  if (q.trim()) qs.set("q", q.trim());
  return cachedGet<OrderEconomicsResponse>(
    `/autoservice/reports/order-economics?${qs}`,
  );
}

export function fetchPayrollReport(year: number, month: number) {
  return cachedGet<PayrollReportResponse>(
    `/autoservice/reports/payroll?year=${year}&month=${month}`,
  );
}

export function fetchWarehouseStock(year: number, month: number, q = "") {
  const qs = new URLSearchParams({
    year: String(year),
    month: String(month),
    hide_zero: "true",
  });
  if (q.trim()) qs.set("q", q.trim());
  return cachedGet<WarehouseStockResponse>(
    `/autoservice/reports/warehouse-stock?${qs}`,
  );
}

// --- XLSX-выгрузки ---

export type ReportKind = "order-economics" | "payroll" | "warehouse-stock";

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
  kind: ReportKind,
  year: number,
  month: number,
  q = "",
): Promise<void> {
  const { from, to } = monthBounds(year, month);
  let path = "";
  if (kind === "order-economics") {
    const qs = new URLSearchParams({
      date_from: from,
      date_to: to,
      status: "all",
      payment: "all",
    });
    if (q.trim()) qs.set("q", q.trim());
    path = `/autoservice/reports/order-economics.xlsx?${qs}`;
  } else if (kind === "payroll") {
    path = `/autoservice/reports/payroll.xlsx?year=${year}&month=${month}`;
  } else {
    const qs = new URLSearchParams({
      year: String(year),
      month: String(month),
      hide_zero: "true",
    });
    if (q.trim()) qs.set("q", q.trim());
    path = `/autoservice/reports/warehouse-stock.xlsx?${qs}`;
  }
  const response = await apiBlob(path);
  const blob = await response.blob();
  const base64 = await blobToBase64(blob);
  const name = `report-${kind}-${year}-${String(month).padStart(2, "0")}.xlsx`;
  const uri = `${FileSystem.cacheDirectory ?? ""}${name}`;
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
