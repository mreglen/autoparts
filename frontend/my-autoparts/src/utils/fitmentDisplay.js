function normalizeToken(value) {
  return String(value || '').replace(/\s+/g, ' ').trim();
}

function jsonText(value) {
  if (!value) return '';
  if (typeof value === 'string') return normalizeToken(value);
  if (typeof value === 'object') {
    return normalizeToken(
      value.FullDescription
      || value.full_description
      || value.Description
      || value.description
      || value.SalesDescription
      || value.sales_description
      || '',
    );
  }
  return '';
}

export function buildVehicleTitle(vehicle) {
  return [vehicle?.brand, vehicle?.model].filter(Boolean).map(normalizeToken).join(' ').trim();
}

export function buildVehicleSubtitle(vehicle) {
  return [
    vehicle?.generation,
    vehicle?.engine,
    vehicle?.transmission,
  ].map(normalizeToken).filter(Boolean).join(' · ');
}

export function hasDonorDetails(vehicle) {
  if (!vehicle) return false;
  return Boolean(
    normalizeToken(vehicle.brand)
    && (
      normalizeToken(vehicle.model)
      || vehicle.tecdoc_passengercar_id
      || jsonText(vehicle.tecdoc_passengercar_json)
      || normalizeToken(vehicle.generation)
      || normalizeToken(vehicle.engine)
    ),
  );
}

export function buildDonorLabel(vehicle) {
  if (!vehicle) return '';

  const passengercar = jsonText(vehicle.tecdoc_passengercar_json);
  if (passengercar) return passengercar;

  const manufacturer = jsonText(vehicle.tecdoc_manufacturer_json);
  const model = jsonText(vehicle.tecdoc_model_json) || normalizeToken(vehicle.model);
  const engine = jsonText(vehicle.tecdoc_engine_json) || normalizeToken(vehicle.engine);
  const transmission = jsonText(vehicle.tecdoc_transmission_json) || normalizeToken(vehicle.transmission);
  const generation = normalizeToken(vehicle.generation);

  const title = [manufacturer || normalizeToken(vehicle.brand), model].filter(Boolean).join(' ');
  const meta = [generation, engine, transmission].filter(Boolean).join(' · ');

  if (title && meta) return `${title} · ${meta}`;
  return title || meta || buildVehicleTitle(vehicle);
}

export function getDonorCaption(vehicle) {
  const hasModification = Boolean(
    normalizeToken(vehicle?.generation)
    || normalizeToken(vehicle?.engine)
    || jsonText(vehicle?.tecdoc_passengercar_json)
    || jsonText(vehicle?.tecdoc_engine_json),
  );
  return hasModification
    ? 'Запчасть снята с такой модификации'
    : 'Запчасть снята с этого автомобиля';
}

function fitmentKey(vehicle) {
  return [
    normalizeToken(vehicle?.brand).toLowerCase(),
    normalizeToken(vehicle?.model).toLowerCase(),
    normalizeToken(vehicle?.generation).toLowerCase(),
  ].join('|');
}

export function dedupeCompatibilityAgainstDonors(donors = [], compatibility = []) {
  const donorKeys = new Set((donors || []).map(fitmentKey));
  return (compatibility || []).filter((vehicle) => !donorKeys.has(fitmentKey(vehicle)));
}

export function mapSellerVehicle(vehicle) {
  return {
    brand: normalizeToken(vehicle?.brand),
    model: normalizeToken(vehicle?.model),
    generation: normalizeToken(vehicle?.generation),
    engine: normalizeToken(vehicle?.engine),
    transmission: normalizeToken(vehicle?.transmission),
    tecdoc_passengercar_id: vehicle?.tecdoc_passengercar_id ?? null,
    tecdoc_manufacturer_json: vehicle?.tecdoc_manufacturer_json ?? null,
    tecdoc_model_json: vehicle?.tecdoc_model_json ?? null,
    tecdoc_passengercar_json: vehicle?.tecdoc_passengercar_json ?? null,
    tecdoc_engine_json: vehicle?.tecdoc_engine_json ?? null,
    tecdoc_transmission_json: vehicle?.tecdoc_transmission_json ?? null,
    source: 'seller',
  };
}

export function mapReferenceVehicle(vehicle) {
  return {
    brand: normalizeToken(vehicle?.brand),
    model: normalizeToken(vehicle?.model),
    generation: normalizeToken(vehicle?.generation),
    engine: normalizeToken(vehicle?.engine),
    transmission: normalizeToken(vehicle?.transmission),
    source: vehicle?.source || 'reference',
  };
}
