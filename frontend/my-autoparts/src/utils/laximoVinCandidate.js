/**
 * Map Laximo VIN / plate candidate → garage / dismantling form fields.
 * Do not invent TecDoc ids.
 */

import { normalizeVinOrNull } from './laximoVin';

function isUnknownLabel(value) {
  const text = String(value || '').trim();
  if (!text) return true;
  return /^\[?unknown\]?$/i.test(text);
}

function resolveCandidateModel(candidate) {
  const model = String(candidate?.model || '').trim();
  if (model && !isUnknownLabel(model)) return model;
  const display = String(candidate?.display_name || '').trim();
  if (!display) return '';
  const make = String(candidate?.make || '').trim();
  if (make && display.toUpperCase().startsWith(make.toUpperCase())) {
    return display.slice(make.length).trim();
  }
  return display;
}

export function sanitizeResolvedVin(value) {
  return normalizeVinOrNull(value) || '';
}

export function mapCandidateToGarageForm(candidate, vin, plate = '') {
  if (!candidate) {
    return {
      vin: sanitizeResolvedVin(vin),
      make: '',
      model: '',
      year: '',
      color: '',
      plate: plate || '',
      notes: '',
    };
  }
  return {
    vin: sanitizeResolvedVin(vin),
    make: candidate.make || '',
    model: resolveCandidateModel(candidate),
    year: candidate.year != null ? String(candidate.year) : '',
    color: candidate.color || '',
    plate: plate || '',
    notes: '',
  };
}

export function mapCandidateToGarageCreatePayload(
  candidate,
  formFields,
  { fromPlate = false, fromFrame = false, frameQuery = '' } = {},
) {
  const base = {
    vin: formFields.vin?.trim() || null,
    make: formFields.make.trim(),
    model: formFields.model.trim(),
    year: formFields.year ? Number(formFields.year) : null,
    color: formFields.color?.trim() || null,
    plate: formFields.plate?.trim() || null,
    notes: formFields.notes?.trim() || null,
  };
  if (!candidate) {
    return { ...base, source: 'manual' };
  }
  const hasCatalog = Boolean(candidate.catalog || candidate.vehicle_id);
  let source = 'laximo';
  if (fromPlate) {
    source = hasCatalog ? 'laximo' : 'plate';
  } else if (fromFrame) {
    source = hasCatalog ? 'laximo' : 'frame';
  }
  let attrs = Array.isArray(candidate.attributes_raw)
    ? [...candidate.attributes_raw]
    : null;
  if (fromFrame && frameQuery) {
    attrs = attrs || [];
    attrs.push({ key: 'frame_query', value: frameQuery });
  }
  return {
    ...base,
    source,
    laximo_catalog: candidate.catalog || null,
    laximo_vehicle_id: candidate.vehicle_id || null,
    laximo_attributes: attrs,
  };
}

export function mapCandidateToDismantlingPrefill(candidate, vin) {
  if (!candidate) {
    return {
      brandInput: '',
      modelInput: '',
      engineText: '',
      transmissionText: '',
      generationInput: '',
      vin: vin || '',
    };
  }
  const yearStr = candidate.year != null ? String(candidate.year) : '';
  return {
    brandInput: candidate.make || '',
    modelInput: resolveCandidateModel(candidate),
    engineText: candidate.engine || '',
    transmissionText: candidate.transmission || '',
    // Free-text generation so manual TecDoc-less path can proceed; user can refine.
    generationInput: yearStr || candidate.body || '',
    vin: vin || '',
  };
}

export function softNoticeVariantFromReason(reason) {
  if (reason === 'not_found') return 'not_found';
  return 'unavailable';
}

export function candidateLabel(candidate) {
  if (!candidate) return '';
  const parts = [
    candidate.display_name || [candidate.make, candidate.model].filter(Boolean).join(' '),
    candidate.year != null ? String(candidate.year) : null,
    candidate.engine || null,
  ].filter(Boolean);
  return parts.join(' · ');
}
