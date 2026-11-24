const CLIENT_BOOKING_EVENTS = new Set([
  'autoservice_booking_accepted',
  'autoservice_booking_confirmed',
  'autoservice_booking_cancelled',
  'autoservice_booking_reminder',
]);

const STAFF_BOOKING_EVENTS = new Set([
  'autoservice_new_inspection',
  'autoservice_booking_cancelled_staff',
]);

export function resolveNotificationUrl(notification) {
  if (!notification) return null;
  const data = notification.data || {};
  const eventType = notification.event_type;

  if (eventType === 'chat_message') {
    if (data.chatId) {
      return data.url || `/chats?chatId=${data.chatId}`;
    }
    return data.url || notification.url || null;
  }

  if (eventType === 'new_order_seller' && data.orderId) {
    const kind = data.orderKind || 'used';
    return `/sales/orders?order=${kind}-${data.orderId}`;
  }

  if (eventType === 'order_status_buyer' && data.orderId) {
    const kind = data.orderKind || 'used';
    return `/purchases/orders?order=${kind}-${data.orderId}`;
  }

  if (STAFF_BOOKING_EVENTS.has(eventType) && data.inspectionId) {
    return `/autoservice/inspections?booking=${data.inspectionId}`;
  }

  if (CLIENT_BOOKING_EVENTS.has(eventType) && data.inspectionId) {
    return `/autoservice/repair-booking?booking=${data.inspectionId}`;
  }

  return notification.url || data.url || null;
}
