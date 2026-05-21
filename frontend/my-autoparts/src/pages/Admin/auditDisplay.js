export const CATEGORY_LABELS = {
  auth: 'Авторизация',
  warehouse: 'Склад',
  sales: 'Продажи',
  products: 'Товары',
  employees: 'Сотрудники',
  integrations: 'Интеграции',
  finance: 'Финансы',
  moderation: 'Модерация',
  orders: 'Заказы',
  settings: 'Настройки',
  system: 'Система',
};

export function getMonthRangeDefaults() {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const lastDay = new Date(y, now.getMonth() + 1, 0).getDate();
  return {
    dateFrom: `${y}-${m}-01`,
    dateTo: `${y}-${m}-${String(lastDay).padStart(2, '0')}`,
  };
}

export function formatAuditDate(iso) {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleString('ru-RU', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  } catch {
    return iso;
  }
}

export function labelCategory(code, meta) {
  if (!code) return '—';
  return meta?.category_labels?.[code] || CATEGORY_LABELS[code] || code;
}

export function labelEventType(code, meta) {
  if (!code) return '—';
  return meta?.event_type_labels?.[code] || code;
}

export function parseDetails(row) {
  if (row?.details_parsed != null) return row.details_parsed;
  if (!row?.details) return null;
  try {
    return JSON.parse(row.details);
  } catch {
    return row.details;
  }
}

export function buildAuditQueryParams({
  dateFrom,
  dateTo,
  category,
  eventType,
  organizationId,
  userQuery,
  search,
  page,
  limit,
}) {
  const params = { page, limit };
  if (dateFrom) params.date_from = dateFrom;
  if (dateTo) params.date_to = dateTo;
  if (category && category !== 'all') params.category = category;
  if (eventType && eventType !== 'all') params.event_type = eventType;
  if (organizationId?.trim()) params.organization_id = organizationId.trim();
  if (userQuery?.trim()) params.user = userQuery.trim();
  if (search?.trim()) params.search = search.trim();
  return params;
}

export function formatOrgCell(row) {
  if (!row.organization_id && !row.organization_name) return '—';
  return {
    name: row.organization_name || row.organization_id,
    id: row.organization_id,
  };
}

export function formatActorCell(row) {
  const name = row.actor_name || row.email || '—';
  const code = row.user_public_code;
  return { name, code };
}
