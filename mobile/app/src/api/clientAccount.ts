import * as FileSystem from "expo-file-system/legacy";
import * as Sharing from "expo-sharing";

import { apiBlob, apiSend } from "./client";
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

export interface ClientOrderWork {
  id: number;
  position: number;
  title: string;
  qty: number;
  unit_price: number | string;
  line_sum: number | string;
}

export interface ClientOrderPart {
  id: number;
  position: number;
  title: string;
  qty: number | string;
  unit?: string;
}

export interface ClientOrderShopPart {
  id: number;
  position: number;
  title: string;
  display_name?: string;
  qty: number | string;
  unit?: string;
  price_with_markup: number | string;
  line_sum: number | string;
}

export interface ClientOrderDelivery {
  id: number;
  position: number;
  title: string;
  price: number | string;
}

export interface ClientRepairOrder {
  id: number;
  order_number?: string | null;
  organization_id?: string | null;
  organization_name?: string | null;
  vehicle_id?: number | null;
  client_comment?: string | null;
  work_zone_id?: number | null;
  work_zone?: { id: number; name: string } | null;
  scheduled_at: string;
  scheduled_end_at?: string | null;
  status: string;
  created_at?: string;
  vehicle?: ClientVehicleBrief | null;
  works?: ClientOrderWork[];
  client_parts?: ClientOrderPart[];
  shop_parts?: ClientOrderShopPart[];
  deliveries?: ClientOrderDelivery[];
  vat_rate?: number | string;
  discount_percent?: number | string;
  works_total?: number | string;
  shop_parts_total?: number | string;
  deliveries_total?: number | string;
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

export interface PublicAutoserviceOrg {
  organization_id: string;
  name?: string | null;
  description?: string | null;
  address?: string | null;
  phone?: string | null;
}

export function fetchPublicAutoserviceOrgs() {
  return cachedGet<PublicAutoserviceOrg[]>("/public/autoservice/organizations");
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

export interface ClientBookingCreatePayload {
  organization_id?: string;
  name?: string;
  phone?: string;
  preferred_date: string;
  preferred_time?: string;
  vehicle_make?: string;
  vehicle_model?: string;
  notes?: string;
  garage_vehicle_id?: number;
}

export function createClientInspectionBooking(
  payload: ClientBookingCreatePayload,
) {
  return apiSend<ClientBooking>("POST", "/autoservice/inspection-bookings/me", {
    body: payload,
  });
}

export function cancelClientInspectionBooking(bookingId: number) {
  return apiSend<ClientBooking>(
    "POST",
    `/autoservice/inspection-bookings/me/${bookingId}/cancel`,
  );
}

export function fetchMyRepairOrders(
  scope: "active" | "history" | "all" = "all",
  organizationId?: string,
) {
  const params = new URLSearchParams({ scope });
  if (organizationId) params.set("organization_id", organizationId);
  return cachedGet<ClientRepairOrder[]>(
    `/autoservice/repair-orders/me?${params.toString()}`,
  );
}

export function fetchMyRepairOrder(orderId: number) {
  return cachedGet<ClientRepairOrder>(
    `/autoservice/repair-orders/me/${orderId}`,
  );
}

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

/** Клиентский PDF заказ-наряда (без закупочных цен) → системный «Поделиться». */
export async function shareMyRepairOrderPdf(orderId: number): Promise<void> {
  const response = await apiBlob(
    `/autoservice/repair-orders/me/${orderId}/pdf`,
  );
  const blob = await response.blob();
  const base64 = await blobToBase64(blob);
  const uri = `${FileSystem.cacheDirectory ?? ""}my-order-${orderId}.pdf`;
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
