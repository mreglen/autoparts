import {
  dedupeCompatibilityAgainstDonors,
  mapReferenceVehicle,
  mapSellerVehicle,
  mergeReferenceFitmentRows,
} from './fitmentDisplay';

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

  const append = (vehicle) => {
    const brand = normalizeToken(vehicle?.brand);
    const model = normalizeToken(vehicle?.model);
    if (!brand || !model) return;
    const item = {
      brand,
      model,
      generation: normalizeToken(vehicle?.generation),
      engine: normalizeToken(vehicle?.engine),
      transmission: normalizeToken(vehicle?.transmission),
      tecdoc_passengercar_id: vehicle?.tecdoc_passengercar_id ?? null,
      tecdoc_manufacturer_json: vehicle?.tecdoc_manufacturer_json ?? null,
      tecdoc_model_json: vehicle?.tecdoc_model_json ?? null,
      tecdoc_passengercar_json: vehicle?.tecdoc_passengercar_json ?? null,
      tecdoc_engine_json: vehicle?.tecdoc_engine_json ?? null,
      tecdoc_transmission_json: vehicle?.tecdoc_transmission_json ?? null,
      source: vehicle?.source || 'reference',
    };
    const key = fitmentKey(item);
    if (seen.has(key)) return;
    seen.add(key);
    merged.push(item);
  };

  (Array.isArray(sellerVehicles) ? sellerVehicles : []).forEach((vehicle) => {
    append(mapSellerVehicle(vehicle));
  });
  (Array.isArray(referenceVehicles) ? referenceVehicles : []).forEach((vehicle) => {
    append(mapReferenceVehicle(vehicle));
  });

  return merged.slice(0, limit);
}

export function splitFitmentForDisplay(sellerVehicles = [], referenceVehicles = []) {
  const donors = (Array.isArray(sellerVehicles) ? sellerVehicles : [])
    .map(mapSellerVehicle)
    .filter((vehicle) => vehicle.brand);
  const mergedReference = mergeReferenceFitmentRows(referenceVehicles);
  const compatibility = dedupeCompatibilityAgainstDonors(
    donors,
    mergedReference,
  ).filter((vehicle) => vehicle.brand && vehicle.model);

  return { donors, compatibility };
}
