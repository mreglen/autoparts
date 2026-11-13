import type { useTheme } from "../theme/useTheme";
import { normalizeOrderStatus } from "./format";

type Colors = ReturnType<typeof useTheme>["colors"];

/** Цвета статусов заказ-нарядов — как в планировщике и «Сегодня». */
export function orderStatusColor(
  colors: Colors,
  status?: string | null,
): string {
  switch (normalizeOrderStatus(status)) {
    case "pending":
    case "review":
      return colors.warning;
    case "in_progress":
      return colors.brand;
    case "done":
      return colors.success;
    case "completed":
      return colors.inkMuted;
    default:
      return colors.inkFaint;
  }
}

export function orderStatusSoft(
  colors: Colors,
  status?: string | null,
): string {
  switch (normalizeOrderStatus(status)) {
    case "pending":
    case "review":
      return colors.warningSoft;
    case "in_progress":
      return colors.brandSoft;
    case "done":
      return colors.successSoft;
    default:
      return colors.surfaceSubtle;
  }
}
