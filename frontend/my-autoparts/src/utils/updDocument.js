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

const ONES_M = ['', 'один', 'два', 'три', 'четыре', 'пять', 'шесть', 'семь', 'восемь', 'девять'];
const ONES_F = ['', 'одна', 'две', 'три', 'четыре', 'пять', 'шесть', 'семь', 'восемь', 'девять'];
const TEENS = [
  'десять',
  'одиннадцать',
  'двенадцать',
  'тринадцать',
  'четырнадцать',
  'пятнадцать',
  'шестнадцать',
  'семнадцать',
  'восемнадцать',
  'девятнадцать',
];
const TENS = [
  '',
  '',
  'двадцать',
  'тридцать',
  'сорок',
  'пятьдесят',
  'шестьдесят',
  'семьдесят',
  'восемьдесят',
  'девяносто',
];
const HUNDREDS = [
  '',
  'сто',
  'двести',
  'триста',
  'четыреста',
  'пятьсот',
  'шестьсот',
  'семьсот',
  'восемьсот',
  'девятьсот',
];

function ruPlural(n, one, few, many) {
  const n10 = n % 10;
  const n100 = n % 100;
  if (n10 === 1 && n100 !== 11) return one;
  if (n10 >= 2 && n10 <= 4 && (n100 < 12 || n100 > 14)) return few;
  return many;
}

function triadToWords(value, female) {
  const n = Number(value) || 0;
  if (!n) return [];
  const ones = female ? ONES_F : ONES_M;
  const parts = [];
  const h = Math.floor(n / 100);
  const rest = n % 100;
  if (h) parts.push(HUNDREDS[h]);
  if (rest >= 10 && rest <= 19) {
    parts.push(TEENS[rest - 10]);
    return parts;
  }
  const t = Math.floor(rest / 10);
  const o = rest % 10;
  if (t) parts.push(TENS[t]);
  if (o) parts.push(ones[o]);
  return parts;
}

export function formatRublesInWords(amount) {
  const cents = Math.round((Number(amount) || 0) * 100);
  const rub = Math.floor(Math.abs(cents) / 100);
  const kop = Math.abs(cents) % 100;
  if (!rub) {
    const zero = `Ноль рублей ${String(kop).padStart(2, '0')} ${ruPlural(kop, 'копейка', 'копейки', 'копеек')}`;
    return cents < 0 ? `Минус ${zero.toLowerCase()}` : zero;
  }
  const groups = [];
  let rest = rub;
  const scales = [
    { female: false, one: '', few: '', many: '' },
    { female: true, one: 'тысяча', few: 'тысячи', many: 'тысяч' },
    { female: false, one: 'миллион', few: 'миллиона', many: 'миллионов' },
    { female: false, one: 'миллиард', few: 'миллиарда', many: 'миллиардов' },
  ];
  for (let i = 0; i < scales.length && rest > 0; i += 1) {
    const triad = rest % 1000;
    rest = Math.floor(rest / 1000);
    if (!triad) continue;
    const scale = scales[i];
    const words = triadToWords(triad, scale.female);
    if (scale.one) words.push(ruPlural(triad, scale.one, scale.few, scale.many));
    groups.unshift(...words);
  }
  const text = groups.join(' ').replace(/\s+/g, ' ').trim();
  const capitalized = text.charAt(0).toUpperCase() + text.slice(1);
  const result = `${capitalized} ${ruPlural(rub, 'рубль', 'рубля', 'рублей')} ${String(kop).padStart(2, '0')} ${ruPlural(kop, 'копейка', 'копейки', 'копеек')}`;
  return cents < 0 ? `Минус ${result.charAt(0).toLowerCase()}${result.slice(1)}` : result;
}
