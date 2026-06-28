const DEFAULT_TTL_MS = 5 * 60 * 1000;

const stores = new Map();

function getStore(name) {
  if (!stores.has(name)) {
    stores.set(name, new Map());
  }
  return stores.get(name);
}

export function readPartDetailCache(storeName, key, ttlMs = DEFAULT_TTL_MS) {
  const entry = getStore(storeName).get(key);
  if (!entry) return null;
  if (Date.now() - entry.ts > ttlMs) {
    getStore(storeName).delete(key);
    return null;
  }
  return entry.data;
}

export function writePartDetailCache(storeName, key, data) {
  getStore(storeName).set(key, { data, ts: Date.now() });
}

export const PART_DETAIL_CACHE = {
  partMeta: 'partMeta',
  newPartMeta: 'newPartMeta',
  alternateOffers: 'alternateOffers',
  referenceFitment: 'referenceFitment',
  newPartResolve: 'newPartResolve',
};
