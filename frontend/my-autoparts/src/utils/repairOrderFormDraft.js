const PREFIX = 'sg:repair-order-form';

export function repairOrderFormCacheKey(mode, orderId = null) {
  if (mode === 'edit' && orderId != null) {
    return `${PREFIX}:edit:${orderId}`;
  }
  return `${PREFIX}:create`;
}

export function repairOrderFormSnapshotHasContent(snapshot) {
  if (!snapshot || typeof snapshot !== 'object') return false;
  if (snapshot.clientId || snapshot.vehicleId) return true;
  if (
    String(snapshot.pendingClientName || '').trim()
    || String(snapshot.pendingClientPhone || '').trim()
    || String(snapshot.pendingVehicleMake || '').trim()
    || String(snapshot.pendingVehicleModel || '').trim()
  ) return true;
  if (String(snapshot.comment || '').trim() || String(snapshot.staffComment || '').trim()) return true;
  if ((snapshot.works || []).length > 0) return true;
  if ((snapshot.clientParts || []).length > 0) return true;
  if ((snapshot.shopParts || []).length > 0) return true;
  return false;
}

export function writeRepairOrderFormDraft(mode, orderId, formSnapshot) {
  try {
    const key = repairOrderFormCacheKey(mode, orderId);
    if (!repairOrderFormSnapshotHasContent(formSnapshot)) {
      sessionStorage.removeItem(key);
      return;
    }
    sessionStorage.setItem(
      key,
      JSON.stringify({ form: formSnapshot, savedAt: Date.now() }),
    );
  } catch {
    /* ignore quota */
  }
}

export function readRepairOrderFormDraft(mode, orderId = null) {
  try {
    const raw = sessionStorage.getItem(repairOrderFormCacheKey(mode, orderId));
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed?.form || typeof parsed.form !== 'object') return null;
    return parsed;
  } catch {
    return null;
  }
}

export function listRepairOrderFormDrafts() {
  const drafts = [];
  try {
    for (let i = 0; i < sessionStorage.length; i += 1) {
      const key = sessionStorage.key(i);
      if (!key || !key.startsWith(`${PREFIX}:`)) continue;
      try {
        const parsed = JSON.parse(sessionStorage.getItem(key));
        if (!parsed?.form || typeof parsed.form !== 'object') continue;
        if (!repairOrderFormSnapshotHasContent(parsed.form)) continue;
        const [mode, idRaw] = key.slice(PREFIX.length + 1).split(':');
        drafts.push({
          key,
          mode,
          orderId: mode === 'edit' ? Number(idRaw) || null : null,
          form: parsed.form,
          savedAt: Number(parsed.savedAt) || 0,
        });
      } catch {
        /* skip broken entry */
      }
    }
  } catch {
    /* sessionStorage unavailable */
  }
  drafts.sort((a, b) => b.savedAt - a.savedAt);
  return drafts;
}

export function clearRepairOrderFormDraft(mode, orderId = null) {
  try {
    sessionStorage.removeItem(repairOrderFormCacheKey(mode, orderId));
  } catch {
    /* ignore */
  }
}
