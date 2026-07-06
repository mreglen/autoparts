export function buildStorageCellsFromQuantities(cellQuantities) {
  return Object.entries(cellQuantities || {})
    .filter(([, value]) => value && String(value).trim())
    .map(([cellId, value]) => ({
      storage_cell_id: parseInt(cellId, 10),
      value: String(value).trim(),
    }))
    .filter((item) => Number.isFinite(item.storage_cell_id));
}

export function buildProductDraftPayload({
  formData,
  photos,
  videos,
  selectedVehicle,
  cellQuantities,
}) {
  const photoUrls = (photos || [])
    .map((file) => {
      if (file?.finalPath) {
        return file.finalPath.startsWith('/') ? file.finalPath : `/${file.finalPath}`;
      }
      if (typeof file === 'string') {
        return file.startsWith('/') ? file : `/${file}`;
      }
      return null;
    })
    .filter(Boolean);

  const videoUrls = (videos || [])
    .map((file) => {
      if (file?.finalPath) {
        return file.finalPath.startsWith('/') ? file.finalPath : `/${file.finalPath}`;
      }
      if (typeof file === 'string') {
        return file.startsWith('/') ? file : `/${file}`;
      }
      return null;
    })
    .filter(Boolean);

  const storageCells = buildStorageCellsFromQuantities(cellQuantities);

  const priceRaw = formData?.sale_price;
  const quantityRaw = formData?.quantity;

  return {
    article: (formData?.article || '').trim() || null,
    name: (formData?.name || '').trim() || null,
    brand: (formData?.brand || '').trim() || null,
    description: formData?.description ? String(formData.description).trim() : null,
    is_new: formData?.condition === 'новый',
    price: priceRaw !== '' && priceRaw != null ? parseFloat(priceRaw) : null,
    quantity: quantityRaw !== '' && quantityRaw != null ? parseInt(quantityRaw, 10) : null,
    storage_location_id: formData?.storage_location_id
      ? parseInt(formData.storage_location_id, 10)
      : null,
    part_type_id: formData?.part_type_id ? parseInt(formData.part_type_id, 10) : null,
    photos: photoUrls.length ? photoUrls : [],
    videos: videoUrls.length ? videoUrls : [],
    vehicle_ids: selectedVehicle?.id ? [selectedVehicle.id] : [],
    storage_cells: storageCells,
  };
}

export function draftPayloadHasContent(payload) {
  if (!payload) return false;
  return Boolean(
    payload.article
      || payload.name
      || payload.brand
      || payload.description
      || (payload.photos && payload.photos.length)
      || (payload.videos && payload.videos.length)
      || payload.storage_location_id
      || payload.part_type_id
      || payload.price != null
      || payload.quantity != null
      || (payload.storage_cells && payload.storage_cells.length)
      || (payload.vehicle_ids && payload.vehicle_ids.length)
  );
}

export function formatDraftTitle(draft) {
  const parts = [draft?.brand, draft?.article, draft?.name].filter(Boolean);
  if (parts.length) return parts.join(' · ');
  return `Черновик #${draft?.id || ''}`.trim();
}

const DRAFT_SESSION_PREFIX = 'sg:product-draft:';

export function draftToFormSnapshot(draft) {
  if (!draft) return null;

  const photos = (draft.photos || [])
    .map((url) => ({
      finalPath: typeof url === 'string' ? url : (url.full_url || url.photo_url || url.url || ''),
      name: 'photo',
      isExisting: true,
    }))
    .filter((item) => item.finalPath);

  const videos = (draft.videos || [])
    .map((url) => ({
      finalPath: typeof url === 'string' ? url : (url.full_url || url.video_url || url.url || ''),
      name: 'video',
      isExisting: true,
    }))
    .filter((item) => item.finalPath);

  const cellQuantities = {};
  (draft.storage_cells || []).forEach((link) => {
    if (link.storage_cell_id) {
      cellQuantities[link.storage_cell_id] = link.value || '';
    }
  });

  return {
    formData: {
      article: draft.article || '',
      name: draft.name || '',
      brand: draft.brand || '',
      description: draft.description || '',
      condition: draft.is_new ? 'новый' : 'б/у',
      quantity: draft.quantity != null ? String(draft.quantity) : '',
      sale_price: draft.price != null ? String(draft.price) : '',
      storage_location_id: draft.storage_location_id ? String(draft.storage_location_id) : '',
      part_type_id: draft.part_type_id ? String(draft.part_type_id) : '',
    },
    photos,
    videos,
    cellQuantities,
    vehicle: draft.vehicle || null,
    vehicleId: draft.vehicle_ids?.[0] ?? draft.vehicle?.id ?? null,
  };
}

export function readDraftSessionCache(draftId) {
  if (!draftId) return null;
  try {
    const raw = sessionStorage.getItem(`${DRAFT_SESSION_PREFIX}${draftId}`);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function writeDraftSessionCache(draftId, snapshot) {
  if (!draftId || !snapshot) return;
  try {
    sessionStorage.setItem(`${DRAFT_SESSION_PREFIX}${draftId}`, JSON.stringify(snapshot));
  } catch {
    // sessionStorage может быть недоступен
  }
}

export function clearDraftSessionCache(draftId) {
  if (!draftId) return;
  try {
    sessionStorage.removeItem(`${DRAFT_SESSION_PREFIX}${draftId}`);
  } catch {
    // ignore
  }
}
