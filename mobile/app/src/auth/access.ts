/** Зеркало `frontend/.../utils/autoservicePermissions.js` — те же коды и логика bypass.
 *  Права режет сервер; здесь только скрытие разделов и состояний «нет доступа». */

import type { SessionUser } from "./session";

export const PERM = {
  planner: "autoservice.planner",
  orders: "autoservice.orders",
  ordersOwn: "autoservice.orders.own",
  warehouse: "autoservice.warehouse",
  finance: "autoservice.finance",
  reports: "autoservice.reports",
  clients: "autoservice.clients",
  inspections: "autoservice.inspections",
  inspectionsConfirm: "autoservice.inspections.confirm",
  settings: "autoservice.settings",
  markup: "autoservice.markup",
} as const;

export const ORDERS_CODES = [PERM.orders, PERM.ordersOwn] as const;

/** Разделы автосервиса → коды прав (как AUTOSERVICE_SECTION_PERMISSION на вебе). */
export const SECTION_CODES: Record<string, readonly string[]> = {
  planner: [PERM.planner],
  orders: ORDERS_CODES,
  "order-form": ORDERS_CODES,
  clients: [PERM.clients],
  inspections: [PERM.inspections],
  finance: [PERM.finance],
  reports: [PERM.reports],
  payroll: ORDERS_CODES,
  warehouse: [PERM.warehouse],
  settings: [PERM.settings],
  dashboard: [
    PERM.planner,
    PERM.orders,
    PERM.ordersOwn,
    PERM.warehouse,
    PERM.finance,
    PERM.reports,
    PERM.clients,
    PERM.inspections,
    PERM.settings,
  ],
};

export function hasBypass(user: SessionUser | null): boolean {
  return Boolean(user?.isAdmin || user?.isDirector || user?.isSeller);
}

export function hasPermission(
  user: SessionUser | null,
  codes: readonly string[],
  code: string,
): boolean {
  if (hasBypass(user)) return true;
  if (!user?.isEmployee) return false;
  return codes.includes(code);
}

export function canAccessSection(
  user: SessionUser | null,
  codes: readonly string[],
  section: string,
): boolean {
  const required = SECTION_CODES[section];
  if (!required) return hasAnyPermission(user, codes);
  return required.some((code) => hasPermission(user, codes, code));
}

export function hasAnyPermission(
  user: SessionUser | null,
  codes: readonly string[],
): boolean {
  if (hasBypass(user)) return true;
  if (!user?.isEmployee) return false;
  return Object.values(PERM).some((code) => codes.includes(code));
}
