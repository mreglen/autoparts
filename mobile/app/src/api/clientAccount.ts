import { apiSend } from "./client";
import { cachedGet } from "../offline";
import type { GarageVehicleCreatePayload } from "../utils/vehicleLookup";

/** Клиентский контур автосервиса (`/autoservice/clients/me*`, `/me`-списки).
 *  Типы — ручные, как в api/bookings.ts; источник истины — openapi.json. */

export interface MyClientOrg {
  organization_id: string;
  organization_name?: string | null;
  client_id: number;
}

export interface MyClientCard {
  id?: number;
  name?: string | null;
  phone?: string | null;
}

export interface MyClientMeResponse {
  is_client: boolean;
  client?: MyClientCard | null;
}

export interface ClientVehicleBrief {
  id?: number;
  make?: string;
  model?: string | null;
  year?: number | null;
  plate?: string | null;
  vin?: string | null;
}

export interface ClientBooking {
  id: number;
  organization_id?: string;
  organization_name?: string | null;
  client_id?: number | null;
  garage_vehicle_id?: number | null;
  vehicle?: ClientVehicleBrief | null;
  name: string;
  phone?: string | null;
  preferred_date: string;
  preferred_time?: string | null;
  vehicle_make?: string | null;
  vehicle_model?: string | null;
  status: string;
  source?: string;
  notes?: string | null;
  created_at?: string;
}

export interface ClientRepairOrder {
  id: number;
  order_number?: string | null;
  organization_id?: string | null;
  organization_name?: string | null;
  vehicle_id?: number | null;
  client_comment?: string | null;
  scheduled_at: string;
  scheduled_end_at?: string | null;
  status: string;
  created_at?: string;
  vehicle?: ClientVehicleBrief | null;
  grand_total?: number | string;
}

export interface GarageVehicle {
  id: number;
  client_id: number;
  organization_id: string;
  vin?: string | null;
  make: string;
  model?: string | null;
  year?: number | null;
  color?: string | null;
  plate?: string | null;
  notes?: string | null;
  mileage_km?: number | null;
  source?: string;
}

export function fetchMyClientOrgs() {
  return cachedGet<MyClientOrg[]>("/autoservice/clients/me/orgs");
}

export function fetchMyClient(organizationId?: string) {
  const qs = organizationId
    ? `?organization_id=${encodeURIComponent(organizationId)}`
    : "";
  return cachedGet<MyClientMeResponse>(`/autoservice/clients/me${qs}`);
}

export function fetchMyClientBookings() {
  return cachedGet<ClientBooking[]>("/autoservice/inspection-bookings/me");
}

export function fetchMyRepairOrders(
  scope: "active" | "history" | "all" = "all",
) {
  return cachedGet<ClientRepairOrder[]>(
    `/autoservice/repair-orders/me?scope=${scope}`,
  );
}

export function fetchGarageVehicles(organizationId: string) {
  return cachedGet<GarageVehicle[]>(
    `/autoservice/garage/vehicles?organization_id=${encodeURIComponent(organizationId)}`,
  );
}

export interface VehicleDecodeCandidate {
  make?: string | null;
  model?: string | null;
  year?: number | null;
  engine?: string | null;
  transmission?: string | null;
  body?: string | null;
  color?: string | null;
  display_name?: string | null;
  catalog?: string | null;
  vehicle_id?: string | null;
  ssd?: string | null;
  filter_level?: string | null;
  attributes_raw?: Record<string, unknown>[] | null;
}

export type VehicleDecodeReason =
  | "ok"
  | "not_found"
  | "temporarily_unavailable";

export interface VehicleDecodeResult {
  ok: boolean;
  reason: VehicleDecodeReason;
  message?: string | null;
  plate?: string | null;
  vin?: string | null;
  frame?: string | null;
  candidates: VehicleDecodeCandidate[];
}

export type VehicleLookupKind = "vin" | "plate" | "frame";

export async function decodeGarageVehicle(
  kind: VehicleLookupKind,
  input: string,
): Promise<VehicleDecodeResult> {
  const path =
    kind === "vin"
      ? "/autoservice/garage/decode-vin"
      : kind === "plate"
        ? "/autoservice/garage/decode-plate"
        : "/autoservice/garage/decode-frame";
  const body =
    kind === "vin"
      ? { vin: input }
      : kind === "plate"
        ? { plate: input, country_code: "ru" }
        : { frame: input };
  const result = await apiSend<VehicleDecodeResult>("POST", path, { body });
  return { ...result, candidates: result.candidates ?? [] };
}

export interface GarageVehicleUpdatePayload {
  vin?: string | null;
  make?: string;
  model?: string | null;
  year?: number | null;
  color?: string | null;
  plate?: string | null;
  notes?: string | null;
}

export function createGarageVehicle(
  organizationId: string,
  payload: GarageVehicleCreatePayload,
) {
  return apiSend<GarageVehicle>(
    "POST",
    `/autoservice/garage/vehicles?organization_id=${encodeURIComponent(organizationId)}`,
    { body: payload },
  );
}

export function updateGarageVehicle(
  vehicleId: number,
  organizationId: string,
  payload: GarageVehicleUpdatePayload,
) {
  return apiSend<GarageVehicle>(
    "PATCH",
    `/autoservice/garage/vehicles/${vehicleId}?organization_id=${encodeURIComponent(organizationId)}`,
    { body: payload },
  );
}

export function deleteGarageVehicle(vehicleId: number, organizationId: string) {
  return apiSend<void>(
    "DELETE",
    `/autoservice/garage/vehicles/${vehicleId}?organization_id=${encodeURIComponent(organizationId)}`,
  );
}

export function vehicleLabel(vehicle?: ClientVehicleBrief | null): string {
  if (!vehicle) return "";
  const parts = [vehicle.make, vehicle.model].filter(Boolean);
  return parts.join(" ") || vehicle.plate || "Авто";
}
