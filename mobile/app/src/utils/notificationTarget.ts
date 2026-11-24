import type { UserNotification } from "../api/notifications";

export interface NotificationTarget {
  screen: "ChatThread" | "BookingDetail" | "OrderDetail" | "ClientOrder";
  params: { chatId?: number; id?: number; orderId?: number; title?: string };
}

const CLIENT_BOOKING_EVENTS = new Set([
  "autoservice_booking_accepted",
  "autoservice_booking_confirmed",
  "autoservice_booking_cancelled",
  "autoservice_booking_reminder",
]);

const STAFF_BOOKING_EVENTS = new Set([
  "autoservice_new_inspection",
  "autoservice_booking_cancelled_staff",
]);

function toInt(value: unknown): number | null {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? n : null;
}

/** Маппинг web-url/data уведомления в экран мобильного приложения. null — просто пометить прочитанным. */
export function resolveMobileNotificationTarget(
  notification: UserNotification,
): NotificationTarget | null {
  const data = (notification.data ?? {}) as Record<string, unknown>;
  const eventType = notification.event_type;
  const url = `${notification.url ?? ""} ${String(data.url ?? "")}`;

  const chatId =
    toInt(data.chatId) ?? (Number(url.match(/chatId=(\d+)/)?.[1] ?? 0) || null);
  if (chatId || eventType === "chat_message") {
    return chatId ? { screen: "ChatThread", params: { chatId, title: "Чат" } } : null;
  }

  const inspectionId = toInt(data.inspectionId);
  if (inspectionId && STAFF_BOOKING_EVENTS.has(eventType)) {
    return { screen: "BookingDetail", params: { id: inspectionId } };
  }
  if (inspectionId && CLIENT_BOOKING_EVENTS.has(eventType)) {
    return null; // у клиента нет экрана детали записи — только пометить прочитанным
  }

  if (eventType === "repair_order_status_changed") {
    const orderId = toInt(data.orderId);
    if (!orderId) return null;
    return url.includes("/garage/repairs")
      ? { screen: "ClientOrder", params: { orderId } }
      : { screen: "OrderDetail", params: { id: orderId } };
  }

  const bookingParam = url.match(/booking=(\d+)/)?.[1];
  if (bookingParam) {
    const id = Number(bookingParam);
    if (url.includes("/autoservice/inspections")) {
      return { screen: "BookingDetail", params: { id } };
    }
    return null;
  }

  const orderParam = url.match(/order=(\w+)-(\d+)/) ?? url.match(/order=(\d+)/);
  if (orderParam) {
    const id = Number(orderParam[orderParam.length - 1]);
    // Заказ-наряды автосервиса; заказы запчастей (sales/purchases) в приложении не открываются.
    if (url.includes("/garage/repairs")) {
      return { screen: "ClientOrder", params: { orderId: id } };
    }
    if (url.includes("/autoservice/orders")) {
      return { screen: "OrderDetail", params: { id } };
    }
  }

  return null;
}
