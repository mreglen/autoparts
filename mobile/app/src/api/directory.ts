import { apiGet, apiSend } from "./client";
import { cachedGet, invalidateEntities } from "../offline";

// --- Клиенты ---

export interface ClientPageRow {
  id: number;
  name: string;
  phone?: string | null;
  email?: string | null;
  status?: string;
  discount_percent?: number | string;
  orders_count?: number;
  orders_total?: number | string;
  paid_total?: number | string;
  debt_amount?: number | string;
  last_visit_at?: string | null;
  matched_vehicle_label?: string | null;
}

export interface PageResponse<T> {
  items: T[];
  total: number;
  has_more: boolean;
  fetched_at?: string;
}

export function fetchClientsPage(params: {
  q?: string;
  limit?: number;
  offset?: number;
}) {
  const sp = new URLSearchParams();
  if (params.q) sp.set("q", params.q);
  sp.set("limit", String(params.limit ?? 50));
  sp.set("offset", String(params.offset ?? 0));
  return cachedGet<PageResponse<ClientPageRow>>(
    `/autoservice/clients/page?${sp.toString()}`,
  );
}

// --- Сотрудники ---

export type SalaryType = "fixed" | "percent_work" | "daily_rate";

export const SALARY_TYPE_LABELS: Record<SalaryType, string> = {
  fixed: "Оклад",
  percent_work: "% от работ",
  daily_rate: "Подённая",
};

export interface ServiceEmployee {
  id: number;
  name: string;
  phone?: string | null;
  position?: string | null;
  salary_type: SalaryType;
  salary_amount: number | string;
  work_percent: number | string;
  is_active: boolean;
}

export interface EmployeePayload {
  name: string;
  phone?: string;
  position?: string;
  salary_type: SalaryType;
  salary_amount: number;
  work_percent: number;
  is_active?: boolean;
}

export function fetchEmployees(includeInactive = true) {
  return cachedGet<ServiceEmployee[]>(
    `/autoservice/service-employees${includeInactive ? "?include_inactive=true" : ""}`,
  );
}

export async function createEmployee(body: EmployeePayload) {
  const row = await apiSend<ServiceEmployee>(
    "POST",
    "/autoservice/service-employees",
    { body },
  );
  await invalidateEntities(["employees"]);
  return row;
}

export async function patchEmployee(
  id: number,
  body: Partial<EmployeePayload>,
) {
  const row = await apiSend<ServiceEmployee>(
    "PATCH",
    `/autoservice/service-employees/${id}`,
    { body },
  );
  await invalidateEntities(["employees"]);
  return row;
}

// --- Подрядчики ---

export interface Contractor {
  id: number;
  name: string;
  phone?: string | null;
  note?: string | null;
  is_active: boolean;
  salary_type: string;
  salary_amount: number | string;
  work_percent: number | string;
}

export interface ContractorPayload {
  name: string;
  phone?: string;
  note?: string;
  salary_type: string;
  salary_amount: number | null;
  work_percent: number | null;
  is_active?: boolean;
}

export function fetchContractors(params: {
  q?: string;
  includeInactive?: boolean;
  limit?: number;
  offset?: number;
}) {
  const sp = new URLSearchParams();
  if (params.q) sp.set("q", params.q);
  if (params.includeInactive) sp.set("include_inactive", "true");
  sp.set("limit", String(params.limit ?? 50));
  sp.set("offset", String(params.offset ?? 0));
  return cachedGet<PageResponse<Contractor>>(
    `/autoservice/contractors/page?${sp.toString()}`,
  );
}

export async function createContractor(body: ContractorPayload) {
  const row = await apiSend<Contractor>("POST", "/autoservice/contractors", {
    body,
  });
  await invalidateEntities(["contractors"]);
  return row;
}

export async function patchContractor(
  id: number,
  body: Partial<ContractorPayload>,
) {
  const row = await apiSend<Contractor>(
    "PATCH",
    `/autoservice/contractors/${id}`,
    { body },
  );
  await invalidateEntities(["contractors"]);
  return row;
}

// --- Настройки ---

export interface AutoserviceSettings {
  id: number;
  vat_rate: number | string;
  public_name?: string | null;
  public_description?: string | null;
}

export function fetchSettings() {
  return cachedGet<AutoserviceSettings>("/autoservice/settings");
}

export async function saveSettings(body: {
  public_name?: string;
  public_description?: string;
  vat_rate?: number;
}) {
  const row = await apiSend<AutoserviceSettings>(
    "PUT",
    "/autoservice/settings",
    {
      body,
    },
  );
  await invalidateEntities(["settings"]);
  return row;
}

// --- Синхронизация календаря (CalDAV) ---

export interface CaldavStatus {
  enabled: boolean;
  configured: boolean;
  username?: string | null;
  server_url?: string | null;
  last_synced_at?: string | null;
}

export interface CaldavCredentials {
  server_url: string;
  username: string;
  password: string;
}

export function fetchCaldavStatus() {
  return apiGet<CaldavStatus>("/autoservice/calendar-sync");
}

export async function connectCaldav() {
  const row = await apiSend<CaldavCredentials>(
    "POST",
    "/autoservice/calendar-sync/connect",
  );
  await invalidateEntities(["calendar-sync"]);
  return row;
}

export async function regenerateCaldav() {
  const row = await apiSend<CaldavCredentials>(
    "POST",
    "/autoservice/calendar-sync/regenerate",
  );
  await invalidateEntities(["calendar-sync"]);
  return row;
}

export async function disconnectCaldav() {
  await apiSend("DELETE", "/autoservice/calendar-sync");
  await invalidateEntities(["calendar-sync"]);
}
