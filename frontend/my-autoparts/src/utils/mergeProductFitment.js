function normalizeToken(value) {
  return String(value || '').replace(/\s+/g, ' ').trim();
}

function fitmentKey(vehicle) {
  return [
    normalizeToken(vehicle?.brand).toLowerCase(),
    normalizeToken(vehicle?.model).toLowerCase(),
    normalizeToken(vehicle?.generation).toLowerCase(),
  ].join('|');
}

export function mergeProductFitment(sellerVehicles = [], referenceVehicles = [], limit = 24) {
  const merged = [];
  const seen = new Set();

  const append = (vehicle, source) => {
    const brand = normalizeToken(vehicle?.brand);
    const model = normalizeToken(vehicle?.model);
    if (!brand || !model) return;
    const item = {
      brand,
      model,
      generation: normalizeToken(vehicle?.generation),
      engine: normalizeToken(vehicle?.engine),
      transmission: normalizeToken(vehicle?.transmission),
      vin: normalizeToken(vehicle?.vin),
      mileage: vehicle?.mileage,
      source,
    };
    const key = fitmentKey(item);
    if (seen.has(key)) return;
    seen.add(key);
    merged.push(item);
  };

  (Array.isArray(sellerVehicles) ? sellerVehicles : []).forEach((vehicle) => {
    append(vehicle, 'seller');
  });
  (Array.isArray(referenceVehicles) ? referenceVehicles : []).forEach((vehicle) => {
    append(vehicle, 'reference');
  });

  return merged.slice(0, limit);
}
