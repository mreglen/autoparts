/** Регионы доставки на чекауте (отображаемые названия). */
export const CHECKOUT_DELIVERY_REGIONS = [
  'Центр',
  'Северо-Запад',
  'Юг',
  'Поволжье',
  'Урал',
  'Сибирь',
  'Дальний Восток',
  'Северный Кавказ',
];

/** Как в кабинете Яндекс Товаров для типа «ПВЗ служб доставки». */
export const YANDEX_PVZ_DELIVERY_TYPE_LABEL = 'ПВЗ службы доставки';

/** Способы доставки до ПВЗ: label — UI, carrierName — для Яндекса и БД. */
export const CHECKOUT_PVZ_METHODS = [
  { key: 'cdek', label: 'ПВЗ СДЭК', carrierName: 'СДЭК', carriers: ['сдэк', 'cdek'] },
  {
    key: 'yandex',
    label: 'ПВЗ Яндекс Доставка',
    carrierName: 'Яндекс Доставка',
    carriers: ['яндекс доставка', 'яндекс', 'yandex'],
  },
  {
    key: 'pochta',
    label: 'ПВЗ Почта России',
    carrierName: 'Почта России',
    carriers: ['почта россии', 'почта', 'почты', 'russian post'],
  },
];

const norm = (s) =>
  String(s || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ');

export function carrierMatchesOption(carrierKey, option) {
  const def = CHECKOUT_PVZ_METHODS.find((m) => m.key === carrierKey);
  if (!def) return false;
  const carrier = norm(option?.carrier);
  if (carrier === norm(def.carrierName)) return true;
  return def.carriers.some((needle) => carrier.includes(needle));
}

export function regionMatchesOption(regionName, option) {
  return norm(option?.region_name) === norm(regionName);
}

/** Подбор строки из site_delivery_options под выбор пользователя. */
export function findPvzDeliveryOption(options, regionName, pvzKey) {
  if (!regionName || !pvzKey || !Array.isArray(options)) return null;

  const inRegion = options.filter(
    (o) => o.enabled !== false && regionMatchesOption(regionName, o) && o.delivery_type === 'pvz'
  );
  const withCarrier = inRegion.filter((o) => carrierMatchesOption(pvzKey, o));
  if (withCarrier.length) return withCarrier[0];

  const pvzAnyRegion = options.filter(
    (o) =>
      o.enabled !== false &&
      o.delivery_type === 'pvz' &&
      carrierMatchesOption(pvzKey, o) &&
      regionMatchesOption(regionName, o)
  );
  if (pvzAnyRegion.length) return pvzAnyRegion[0];

  const carrierOnly = options.filter(
    (o) => o.enabled !== false && o.delivery_type === 'pvz' && carrierMatchesOption(pvzKey, o)
  );
  if (carrierOnly.length) return carrierOnly[0];

  const courierFallback = options.filter(
    (o) =>
      o.enabled !== false &&
      o.delivery_type === 'courier' &&
      carrierMatchesOption(pvzKey, o) &&
      (regionMatchesOption(regionName, o) || !regionName)
  );
  return courierFallback[0] || null;
}

export function findPickupDeliveryOption(options) {
  if (!Array.isArray(options)) return null;
  const pickups = options.filter((o) => o.enabled !== false && o.delivery_type === 'pickup');
  const ural = pickups.find((o) => norm(o.region_name) === 'урал');
  return ural || pickups[0] || null;
}

export function pvzMethodLabel(pvzKey) {
  return CHECKOUT_PVZ_METHODS.find((m) => m.key === pvzKey)?.label || '';
}

export function pvzCarrierName(pvzKey) {
  return CHECKOUT_PVZ_METHODS.find((m) => m.key === pvzKey)?.carrierName || '';
}

export function regionIdForCheckout(options, regionName, matchedOption) {
  if (matchedOption?.region_id != null) return matchedOption.region_id;
  const row = options?.find((o) => regionMatchesOption(regionName, o));
  return row?.region_id ?? null;
}
