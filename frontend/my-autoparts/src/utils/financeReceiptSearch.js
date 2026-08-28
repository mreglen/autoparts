import { formatServerDateTime } from './serverDate';

export const FINANCE_METHOD_LABELS = {
  card: 'Карта',
  cash: 'Наличными',
  bank: 'Расчётный счёт',
};

const PRIMARY_MATCH_LABELS = new Set(['Клиент']);

function digitsOnly(value) {
  return String(value || '').replace(/\D/g, '');
}

function includesQuery(value, query, queryDigits) {
  const text = String(value || '').trim();
  if (!text) return false;
  if (query && text.toLowerCase().includes(query)) return true;
  if (queryDigits) {
    const hay = digitsOnly(text);
    if (hay && hay.includes(queryDigits)) return true;
  }
  return false;
}

export function financeReceiptClientLabel(row) {
  return row?.client_name || '—';
}

export function findFinanceReceiptMatch(row, query) {
  const trimmed = String(query || '').trim();
  if (!trimmed) return null;
  const q = trimmed.toLowerCase();
  const qDigits = digitsOnly(trimmed);

  const checks = [
    { label: 'Клиент', value: row?.client_name },
    { label: 'Телефон клиента', value: row?.client_phone, digits: true },
    { label: 'Заказ-наряд', value: row?.repair_order_number ? `№ ${row.repair_order_number}` : '' },
    { label: '№ поступления', value: row?.sequential_number != null ? String(row.sequential_number) : '' },
    { label: 'Способ оплаты', value: FINANCE_METHOD_LABELS[row?.method] || row?.method },
    { label: 'Дата', value: row?.created_at ? formatServerDateTime(row.created_at) : '' },
  ];

  for (const check of checks) {
    if (includesQuery(check.value, q, check.digits ? qDigits : '')) {
      return { label: check.label, value: String(check.value || '').trim() };
    }
  }
  return null;
}

export function financeReceiptMatchesQuery(row, query) {
  return Boolean(findFinanceReceiptMatch(row, query));
}

export function financeReceiptMatchHint(match) {
  if (!match || PRIMARY_MATCH_LABELS.has(match.label)) return null;
  return `${match.label}: ${match.value}`;
}

export function filterFinanceReceipts(items, query, { method } = {}) {
  const trimmed = String(query || '').trim();
  let rows = Array.isArray(items) ? items : [];
  if (method) rows = rows.filter((row) => row.method === method);
  if (!trimmed) {
    return rows.map((row) => ({
      row,
      match: null,
      hint: null,
    }));
  }

  return rows
    .map((row) => {
      const match = findFinanceReceiptMatch(row, trimmed);
      if (!match) return null;
      return {
        row,
        match,
        hint: financeReceiptMatchHint(match),
      };
    })
    .filter(Boolean);
}
