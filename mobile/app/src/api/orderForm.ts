import { apiSend } from "./client";
import { cachedGet, invalidateEntities } from "../offline";
import type { OrderDetail } from "./orders";

// --- Справочники для формы заказ-наряда ---

export interface FormClient {
  id: number;
  name: string;
  phone?: string | null;
  discount_percent?: number | string;
}

export function fetchClients(q = "") {
  const qs = q.trim() ? `?q=${encodeURIComponent(q.trim())}` : "";
  return cachedGet<FormClient[]>(`/autoservice/clients${qs}`);
}

export async function createClient(payload: {
  name: string;
  phone?: string;
}): Promise<FormClient> {
  const row = await apiSend<FormClient>("POST", "/autoservice/clients", {
    body: payload,
  });
  await invalidateEntities(["clients"]);
  return row;
}

export interface FormVehicle {
  id: number;
  client_id: number;
  make: string;
  model?: string | null;
  year?: number | null;
  plate?: string | null;
  vin?: string | null;
}

export function fetchClientVehicles(clientId: number) {
  return cachedGet<FormVehicle[]>(
    `/autoservice/garage/vehicles?client_id=${clientId}`,
  );
}

export async function createVehicle(payload: {
  client_id: number;
  make: string;
  model?: string;
  year?: number | null;
  plate?: string;
  vin?: string;
}): Promise<FormVehicle> {
  const row = await apiSend<FormVehicle>(
    "POST",
    "/autoservice/garage/vehicles/staff",
    { body: payload },
  );
  return row;
}

export interface CatalogWork {
  id: number;
  name: string;
  default_unit_price: number | string;
  is_active?: boolean;
}

export function fetchCatalogWorks(q = "") {
  const qs = q.trim() ? `?q=${encodeURIComponent(q.trim())}` : "";
  return cachedGet<CatalogWork[]>(`/autoservice/works${qs}`);
}

export interface ServiceEmployeeOption {
  id: number;
  name: string;
  work_percent: number | string;
}

export function fetchServiceEmployeeOptions() {
  return cachedGet<ServiceEmployeeOption[]>(
    "/autoservice/repair-orders/service-employees-options",
  );
}

export interface ContractorOption {
  id: number;
  name: string;
  phone?: string | null;
}

export function fetchContractorOptions() {
  return cachedGet<ContractorOption[]>(
    "/autoservice/repair-orders/contractors-options",
  );
}

// --- Полезная нагрузка формы ---

export interface WorkLinePayload {
  title: string;
  catalog_work_id?: number | null;
  qty: number;
  unit_price: number;
  executors: { employee_id: number; percent: number }[];
  contractors: { contractor_id: number; amount: number }[];
}

export interface ClientPartLinePayload {
  title: string;
  qty: number;
  unit: "pcs" | "l" | "kg";
}

export interface ShopPartLinePayload {
  id?: number;
  title: string;
  qty: number;
  unit: "pcs" | "l" | "kg";
  unit_price: number;
  markup_percent?: number;
  source: "manual";
}

export interface DeliveryLinePayload {
  title: string;
  price: number;
}

export interface OrderFormPayload {
  client_id?: number | null;
  vehicle_id?: number | null;
  client_name?: string | null;
  client_phone?: string | null;
  vehicle_make?: string | null;
  vehicle_model?: string | null;
  inspection_booking_id?: number | null;
  scheduled_at?: string | null;
  scheduled_end_at?: string | null;
  inspection_scheduled_at?: string | null;
  mileage_km?: number | null;
  client_comment?: string | null;
  staff_comment?: string | null;
  work_zone_id?: number | null;
  discount_percent?: number | null;
  works: WorkLinePayload[];
  client_parts: ClientPartLinePayload[];
  shop_parts: ShopPartLinePayload[];
  deliveries: DeliveryLinePayload[];
}

export async function createOrder(
  payload: OrderFormPayload,
): Promise<OrderDetail> {
  const row = await apiSend<OrderDetail>("POST", "/autoservice/repair-orders", {
    body: payload,
  });
  await invalidateEntities(["repair-orders"]);
  return row;
}

export async function updateOrder(
  id: number,
  payload: Partial<OrderFormPayload>,
): Promise<OrderDetail> {
  const row = await apiSend<OrderDetail>(
    "PATCH",
    `/autoservice/repair-orders/${id}`,
    { body: payload },
  );
  await invalidateEntities(["repair-orders"]);
  return row;
}
