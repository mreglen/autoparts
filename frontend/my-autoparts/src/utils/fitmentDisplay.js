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

/**
 * Map Laximo FindApplicableVehicles row to fitment chip shape.
 */
function stripEmbeddedYearRange(name) {
  const text = normalizeToken(name);
  if (!text) return '';
  return text.replace(/\s*\((19|20)\d{2}\s*[-–—]\s*(19|20)\d{2}\)\s*$/i, '').trim();
}

function extractModelFromLaximoName(name, brand) {
  const cleaned = stripEmbeddedYearRange(name);
  const make = normalizeToken(brand);
  if (make && cleaned.toUpperCase().startsWith(make.toUpperCase())) {
    return cleaned.slice(make.length).trim() || cleaned;
  }
  return cleaned;
}

export function mapLaximoApplicableVehicle(vehicle) {
  if (!vehicle) return null;
  const brand = normalizeToken(vehicle.brand);
  const rawName = normalizeToken(vehicle.name);
  if (!brand && !rawName) return null;
  const model = extractModelFromLaximoName(rawName, brand) || rawName || brand;
  const yearFrom = normalizeToken(vehicle.year_from);
  const yearTo = normalizeToken(vehicle.year_to);
  let generation = '';
  if (yearFrom && yearTo) generation = `${yearFrom}–${yearTo}`;
  else if (yearFrom) generation = yearFrom;
  else if (yearTo) generation = yearTo;
  return {
    brand: brand || '—',
    model,
    generation,
    engine: '',
    transmission: '',
    source: 'laximo',
  };
}

export function mapLaximoApplicableVehicles(vehicles = []) {
  const list = Array.isArray(vehicles) ? vehicles : [];
  return list.map(mapLaximoApplicableVehicle).filter(Boolean);
}

function compatibilityDedupeKey(vehicle) {
  return [
    normalizeToken(vehicle?.brand).toLowerCase(),
    normalizeToken(vehicle?.model).toLowerCase(),
    normalizeToken(vehicle?.generation).toLowerCase(),
  ].join('|');
}

function mergeSources(existingSources, source) {
  const set = new Set(Array.isArray(existingSources) ? existingSources : []);
  if (source) set.add(source);
  return Array.from(set);
}

export function mergeReferenceFitmentRows(referenceVehicles = []) {
  const merged = [];
  const index = new Map();
  (Array.isArray(referenceVehicles) ? referenceVehicles : []).forEach((raw) => {
    const vehicle = mapReferenceVehicle(raw);
    if (!vehicle.brand || !vehicle.model) return;
    const key = compatibilityDedupeKey(vehicle);
    const prev = index.get(key);
    if (!prev) {
      const entry = { ...vehicle, sources: [vehicle.source || 'reference'] };
      index.set(key, entry);
      merged.push(entry);
      return;
    }
    prev.sources = mergeSources(prev.sources, vehicle.source);
    if (!prev.generation && vehicle.generation) prev.generation = vehicle.generation;
    if (!prev.engine && vehicle.engine) prev.engine = vehicle.engine;
    if (!prev.transmission && vehicle.transmission) prev.transmission = vehicle.transmission;
  });
  return merged;
}

export function groupFitmentForDisplay(vehicles = []) {
  const groups = new Map();
  (Array.isArray(vehicles) ? vehicles : []).forEach((vehicle) => {
    const brand = normalizeToken(vehicle?.brand);
    const model = normalizeToken(vehicle?.model);
    if (!brand || !model) return;
    const brandKey = brand.toLowerCase();
    if (!groups.has(brandKey)) {
      groups.set(brandKey, { brand, models: new Map() });
    }
    const brandGroup = groups.get(brandKey);
    const modelKey = model.toLowerCase();
    if (!brandGroup.models.has(modelKey)) {
      brandGroup.models.set(modelKey, { model, rows: [] });
    }
    brandGroup.models.get(modelKey).rows.push({
      generation: normalizeToken(vehicle.generation),
      engine: normalizeToken(vehicle.engine),
      transmission: normalizeToken(vehicle.transmission),
      sources: Array.isArray(vehicle.sources) ? vehicle.sources : [vehicle.source || 'reference'],
    });
  });

  return Array.from(groups.values())
    .sort((a, b) => a.brand.localeCompare(b.brand, 'ru'))
    .map((brandGroup) => ({
      brand: brandGroup.brand,
      models: Array.from(brandGroup.models.values())
        .sort((a, b) => a.model.localeCompare(b.model, 'ru'))
        .map((modelGroup) => ({
          model: modelGroup.model,
          rows: modelGroup.rows.sort((a, b) => (
            String(a.generation).localeCompare(String(b.generation), 'ru')
          )),
        })),
    }));
}

export function countGroupedFitmentRows(groups = []) {
  return (groups || []).reduce(
    (sum, brandGroup) => sum + brandGroup.models.reduce(
      (modelSum, modelGroup) => modelSum + modelGroup.rows.length,
      0,
    ),
    0,
  );
}

export function sourceLabel(source) {
  if (source === 'laximo') return 'Laximo';
  if (source === 'tecdoc') return 'TecDoc';
  if (source === 'seller') return 'Продавец';
  return 'Справочник';
}
