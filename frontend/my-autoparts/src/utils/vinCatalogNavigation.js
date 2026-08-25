import { normalizeVinForSearchOrNull } from './laximoVin';

export function buildVinCatalogPath(vin) {
  const normalized = normalizeVinForSearchOrNull(vin);
  if (!normalized) return null;
  return `/autoparts/vin?vin=${encodeURIComponent(normalized)}`;
}

export function navigateToVinCatalog(navigate, vin, options = {}) {
  const path = buildVinCatalogPath(vin);
  if (!path) return false;
  navigate(path, options);
  return true;
}

export function resolveSearchOrVin(navigate, text, { replace } = {}) {
  const path = buildVinCatalogPath(text);
  if (path) {
    navigate(path, { replace: Boolean(replace) });
    return 'vin';
  }
  return 'text';
}
