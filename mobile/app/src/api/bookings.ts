import { apiSend } from "./client";
import { cachedGet, invalidateEntities } from "../offline";

export type BookingStatus = "new" | "confirmed" | "processed" | "cancelled";

export const BOOKING_STATUS_LABELS: Record<string, string> = {
  new: "Новая заявка",
  confirmed: "Подтверждена",
  processed: "Обработана",
  cancelled: "Отменена",
};

export const BOOKING_SOURCE_LABELS: Record<string, string> = {
  site: "Сайт",
  staff: "Сотрудник",
  client: "Клиент",
};

export function bookingStatusLabel(status?: string | null): string {
  return BOOKING_STATUS_LABELS[status ?? ""] ?? status ?? "—";
}

export interface InspectionBooking {
  id: number;
  client_id?: number | null;
  garage_vehicle_id?: number | null;
  vehicle?: {
    id?: number;
    make?: string;
    model?: string;
    plate?: string;
  } | null;
  name: string;
  phone?: string | null;
  preferred_date: string;
  preferred_time?: string | null;
  vehicle_make?: string | null;
  vehicle_model?: string | null;
  status: BookingStatus | string;
  source?: string;
  work_zone_id?: number | null;
  notes?: string | null;
  created_at?: string;
}

export interface BookingListParams {
  status?: BookingStatus;
  sort_by?: "created_at" | "preferred_date";
  sort_dir?: "asc" | "desc";
}

export function bookingListPath(params: BookingListParams = {}): string {
  const qs = new URLSearchParams();
  if (params.status) qs.set("status", params.status);
  qs.set("sort_by", params.sort_by ?? "created_at");
  qs.set("sort_dir", params.sort_dir ?? "desc");
  const s = qs.toString();
  return `/autoservice/inspection-bookings${s ? `?${s}` : ""}`;
}

export function fetchBookings(params?: BookingListParams) {
  return cachedGet<InspectionBooking[]>(bookingListPath(params));
}

export async function patchBooking(
  id: number,
  body: Partial<InspectionBooking>,
): Promise<InspectionBooking> {
  const row = await apiSend<InspectionBooking>(
    "PATCH",
    `/autoservice/inspection-bookings/${id}`,
    { body },
  );
  await invalidateEntities(["bookings"]);
  return row;
}

export async function sendBookingSms(
  id: number,
): Promise<{ status?: string; cost?: number; error_message?: string }> {
  return apiSend("POST", `/autoservice/inspection-bookings/${id}/sms`);
}

export interface BookingCreatePayload {
  name: string;
  phone?: string;
  preferred_date: string;
  preferred_time?: string;
  vehicle_make?: string;
  vehicle_model?: string;
  notes?: string;
}

export async function createBooking(
  payload: BookingCreatePayload,
): Promise<InspectionBooking> {
  const row = await apiSend<InspectionBooking>(
    "POST",
    "/autoservice/inspection-bookings",
    { body: payload },
  );
  await invalidateEntities(["bookings"]);
  return row;
}
