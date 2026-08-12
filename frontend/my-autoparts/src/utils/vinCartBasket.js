import { normalizeVinOrNull } from './laximoVin';

const MAX_BASKET_NAME_LENGTH = 100;

export function buildVinBasketName({ make, model, vin }) {
  const brand = String(make || '').trim();
  const modelName = String(model || '').trim();
  const vinCode = normalizeVinOrNull(vin) || String(vin || '').trim().toUpperCase();

  if (!brand || !modelName || !vinCode) return '';

  const name = `${brand} ${modelName} ${vinCode}`.replace(/\s+/g, ' ').trim();
  return name.length > MAX_BASKET_NAME_LENGTH
    ? name.slice(0, MAX_BASKET_NAME_LENGTH)
    : name;
}

export function isVinBasketName(name, vin) {
  const normalizedVin = normalizeVinOrNull(vin);
  if (!normalizedVin || !name) return false;
  return String(name).toUpperCase().includes(normalizedVin);
}
