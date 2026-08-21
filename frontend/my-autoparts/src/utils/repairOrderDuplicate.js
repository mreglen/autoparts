/** Собирает payload POST /autoservice/repair-orders из существующего заказ-наряда. */
export function buildRepairOrderDuplicatePayload(order) {
  return {
    client_id: order.client_id,
    vehicle_id: order.vehicle_id,
    scheduled_at: order.scheduled_at,
    scheduled_end_at: order.scheduled_end_at ?? null,
    shipping_date: order.shipping_date ?? null,
    mileage_km: order.mileage_km ?? null,
    client_comment: order.client_comment ?? null,
    staff_comment: order.staff_comment ?? null,
    work_zone_id: order.work_zone_id ?? null,
    assignee_user_ids: [],
    works: [],
    client_parts: [],
    shop_parts: [],
  };
}
