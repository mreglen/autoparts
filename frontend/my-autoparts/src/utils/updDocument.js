export const UPD_VAT_RATE = 22;

export function roundMoney(value) {
  return Math.round((Number(value) || 0) * 100) / 100;
}

export function splitVatInclusive(amount, rate = UPD_VAT_RATE) {
  const withVat = roundMoney(amount);
  const vat = roundMoney((withVat * rate) / (100 + rate));
  const without = roundMoney(withVat - vat);
  return { withVat, vat, without };
}

export function formatUpdMoney(value) {
  const n = Number(value);
  if (Number.isNaN(n)) return '0,00';
  return n.toLocaleString('ru-RU', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

const MONTHS_GENITIVE = [
  'января',
  'февраля',
  'марта',
  'апреля',
  'мая',
  'июня',
  'июля',
  'августа',
  'сентября',
  'октября',
  'ноября',
  'декабря',
];

export function formatUpdLongDate(date) {
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) return '';
  return `${date.getDate()} ${MONTHS_GENITIVE[date.getMonth()]} ${date.getFullYear()} г.`;
}

export function formatUpdQuotedDate(date) {
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) return '';
  return `« ${date.getDate()} »   ${MONTHS_GENITIVE[date.getMonth()]}   ${date.getFullYear()}  года`;
}

export function innKpp(inn, kpp) {
  const a = String(inn || '').trim();
  const b = String(kpp || '').trim();
  if (a && b) return `${a}/${b}`;
  return a || '';
}

export const UPD_UNIT_META = {
  pcs: { code: '796', label: 'шт' },
  l: { code: '112', label: 'л' },
  kg: { code: '166', label: 'кг' },
  service: { code: '796', label: 'шт' },
};
