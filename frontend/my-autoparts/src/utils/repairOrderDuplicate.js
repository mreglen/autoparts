/** Собирает payload POST /autoservice/repair-orders из существующего заказ-наряда. */
export function buildRepairOrderDuplicatePayload(order) {
  return {
    client_id: order.client_id,
    vehicle_id: order.vehicle_id,
    scheduled_at: order.scheduled_at,
    scheduled_end_at: order.scheduled_end_at ?? null,
    shipping_date: order.shipping_date ?? null,
    client_comment: order.client_comment ?? null,
    staff_comment: order.staff_comment ?? null,
    work_zone_id: order.work_zone_id ?? null,
    assignee_user_ids: (order.assignees || []).map((assignee) => assignee.id),
    works: (order.works || []).map((work) => ({
      title: work.title,
      catalog_work_id: work.catalog_work_id ?? null,
      qty: work.qty,
      unit_price: Number(work.unit_price),
      executor_user_id: work.executor_user_id ?? null,
      executors: (work.executors || []).map((executor) => ({
        employee_id: executor.employee_id,
        percent: Number(executor.percent),
      })),
    })),
    client_parts: (order.client_parts || []).map((part) => ({
      title: part.title,
      qty: part.qty,
      unit: part.unit || 'pcs',
    })),
    shop_parts: (order.shop_parts || []).map((part) => ({
      title: part.title,
      brand: part.brand ?? null,
      partnumber: part.partnumber ?? null,
      qty: Number(part.qty),
      unit: part.unit || 'pcs',
      unit_price: Number(part.unit_price),
      markup_percent: Number(part.markup_percent),
      client_unit_price_override: part.client_unit_price_override == null
        ? null
        : Number(part.client_unit_price_override),
      source: part.source || 'manual',
      product_id: part.source === 'warehouse' ? (part.product_id ?? null) : null,
      autoservice_stock_item_id: part.autoservice_stock_item_id ?? null,
      rossko_brand: part.source === 'rossko'
        ? (part.rossko_brand ?? part.brand ?? null)
        : null,
      rossko_partnumber: part.source === 'rossko'
        ? (part.rossko_partnumber ?? part.partnumber ?? null)
        : null,
    })),
  };
}
