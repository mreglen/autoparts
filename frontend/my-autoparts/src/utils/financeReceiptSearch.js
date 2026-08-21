import { payerDisplayName } from './autoservicePayerRequisites';
import { formatServerDateTime } from './serverDate';

export const FINANCE_METHOD_LABELS = {
  card: 'Карта',
  cash: 'Наличными',
  bank: 'Расчётный счёт',
};

const PRIMARY_MATCH_LABELS = new Set(['Плательщик', 'Клиент', 'ФИО плательщика', 'Наименование плательщика']);

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

export function buildPayersMap(payers) {
  const map = new Map();
  (payers || []).forEach((payer) => {
    if (payer?.id != null) map.set(payer.id, payer);
  });
  return map;
}

export function financeReceiptPayerLabel(row, payer) {
  return row?.payer_name || payerDisplayName(payer) || row?.client_name || '—';
}

export function findFinanceReceiptMatch(row, payer, query) {
  const trimmed = String(query || '').trim();
  if (!trimmed) return null;
  const q = trimmed.toLowerCase();
  const qDigits = digitsOnly(trimmed);

  const checks = [
    { label: 'Плательщик', value: row?.payer_name || payerDisplayName(payer) },
    { label: 'Клиент', value: row?.client_name },
    { label: 'Телефон клиента', value: row?.client_phone, digits: true },
    { label: 'Email плательщика', value: payer?.email },
    { label: 'ИНН плательщика', value: payer?.inn, digits: true },
    { label: 'Наименование плательщика', value: payer?.legal_name },
    { label: 'ФИО плательщика', value: payer?.name },
    { label: 'Заказ-наряд', value: row?.repair_order_number ? `№ ${row.repair_order_number}` : '' },
    { label: '№ поступления', value: row?.sequential_number != null ? String(row.sequential_number) : '' },
    { label: 'Адрес плательщика', value: payer?.address },
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

export function financeReceiptMatchesQuery(row, payer, query) {
  return Boolean(findFinanceReceiptMatch(row, payer, query));
}

export function financeReceiptMatchHint(match) {
  if (!match || PRIMARY_MATCH_LABELS.has(match.label)) return null;
  return `${match.label}: ${match.value}`;
}

export function filterFinanceReceipts(items, payersById, query, { method } = {}) {
  const trimmed = String(query || '').trim();
  let rows = Array.isArray(items) ? items : [];
  if (method) rows = rows.filter((row) => row.method === method);
  if (!trimmed) return rows.map((row) => ({
    row,
    payer: row.payer_id ? payersById.get(row.payer_id) : null,
    match: null,
    hint: null,
  }));

  return rows
    .map((row) => {
      const payer = row.payer_id ? payersById.get(row.payer_id) : null;
      const match = findFinanceReceiptMatch(row, payer, trimmed);
      if (!match) return null;
      return {
        row,
        payer,
        match,
        hint: financeReceiptMatchHint(match),
      };
    })
    .filter(Boolean);
}
