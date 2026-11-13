import { apiGet } from "./client";
import { cachedGet } from "../offline";
import { toIsoDate } from "../utils/format";

export interface PlannerItem {
  id: number;
  kind: "order" | "inspection";
  order_number?: string;
  client_name: string;
  client_phone?: string;
  vehicle: string;
  status: string;
  scheduled_at: string;
  scheduled_end_at?: string | null;
  inspection_scheduled_at?: string | null;
  preferred_time?: string | null;
  vehicle_make?: string | null;
  vehicle_model?: string | null;
  work_zone_id?: number | null;
  work_zone_name?: string | null;
  notes?: string | null;
}

export interface PlannerWeekDay {
  date: string;
  orders: PlannerItem[];
}

export interface PlannerWeekZone {
  id: number | null;
  name: string;
  sort_order: number;
  is_unassigned?: boolean;
  days: PlannerWeekDay[];
}

export interface PlannerWeekResponse {
  week_start: string;
  week_end: string;
  days: { date: string }[];
  zones: PlannerWeekZone[];
}

function mondayOf(date: Date): Date {
  const d = new Date(date);
  const dow = (d.getDay() + 6) % 7; // 0 = понедельник
  d.setDate(d.getDate() - dow);
  d.setHours(0, 0, 0, 0);
  return d;
}

export function weekStartOf(date: Date): string {
  const d = mondayOf(date);
  return toIsoDate(d);
}

export function fetchPlannerWeek(weekStart: string) {
  return cachedGet<PlannerWeekResponse>(
    `/autoservice/planner/week?week_start=${weekStart}`,
  );
}

/** Свежая проверка пересечений при сохранении — без кэша. */
export function fetchPlannerConflicts(params: {
  workZoneId: number;
  start: string;
  end?: string | null;
  excludeOrderId?: number | null;
}) {
  const qs = new URLSearchParams();
  qs.set("work_zone_id", String(params.workZoneId));
  qs.set("start", params.start);
  if (params.end) qs.set("end", params.end);
  if (params.excludeOrderId) {
    qs.set("exclude_order_id", String(params.excludeOrderId));
  }
  return apiGet<PlannerItem[]>(`/autoservice/planner/conflicts?${qs}`);
}
