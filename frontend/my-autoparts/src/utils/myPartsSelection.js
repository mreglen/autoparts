export function normalizePartId(id) {
  const numeric = Number(id);
  return Number.isFinite(numeric) ? numeric : id;
}

export function idsToSelectionSet(ids) {
  const next = new Set();
  (Array.isArray(ids) ? ids : []).forEach((id) => {
    const normalized = normalizePartId(id);
    if (normalized === 0 || normalized) next.add(normalized);
  });
  return next;
}

export function selectionHasPart(selectedIds, partId) {
  return selectedIds.has(normalizePartId(partId));
}

export function computePartsStats(parts) {
  return (parts || []).reduce(
    (acc, part) => {
      const quantity = Number(part.quantity) || 0;
      const price = Number(part.price) || 0;
      acc.value += price * quantity;
      acc.quantity += quantity;
      acc.count += 1;
      return acc;
    },
    { value: 0, quantity: 0, count: 0 },
  );
}

export function computeMyPartsHeaderStats({
  selectedIds,
  products,
  totalCount,
  totalValue,
  totalQuantity,
  listFullyLoaded,
  selectAllPending = false,
}) {
  const catalogCount = Number(totalCount) || 0;
  const catalogValue = Number(totalValue) || 0;
  const catalogQuantity = Number(totalQuantity) || 0;
  const catalogStats = listFullyLoaded
    ? computePartsStats(products)
    : { value: catalogValue, quantity: catalogQuantity, count: catalogCount };
  const unselected = {
    value: catalogStats.value,
    quantity: catalogStats.quantity,
    count: catalogCount,
  };

  const selectedCount = selectedIds?.size || 0;
  if (!selectedCount && !selectAllPending) return unselected;

  if (selectAllPending || selectedCount === catalogCount) {
    return {
      value: catalogStats.value,
      quantity: catalogStats.quantity,
      count: catalogCount,
    };
  }

  const selectedLoaded = (products || []).filter((part) =>
    selectionHasPart(selectedIds, part.id),
  );
  if (selectedLoaded.length === selectedCount) {
    const loaded = computePartsStats(selectedLoaded);
    return { value: loaded.value, quantity: loaded.quantity, count: selectedCount };
  }

  const unselectedLoaded = (products || []).filter(
    (part) => !selectionHasPart(selectedIds, part.id),
  );
  if (unselectedLoaded.length + selectedCount === catalogCount) {
    const removed = computePartsStats(unselectedLoaded);
    return {
      value: catalogStats.value - removed.value,
      quantity: catalogStats.quantity - removed.quantity,
      count: selectedCount,
    };
  }

  const loaded = computePartsStats(selectedLoaded);
  return { value: loaded.value, quantity: loaded.quantity, count: selectedCount };
}
