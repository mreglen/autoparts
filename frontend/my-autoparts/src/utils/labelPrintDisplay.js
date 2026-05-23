export function shortCellName(name) {
  const text = (name || '').trim();
  return text ? text.slice(0, 4) : '—';
}

export function storageCellsPerRow(widthMm, { fullWidth = false } = {}) {
  if (fullWidth) {
    const usable = Math.max(24, Number(widthMm || 58) - 4);
    return Math.max(3, Math.min(8, Math.floor(usable / 6)));
  }
  const leftMm = Math.max(18, Number(widthMm || 58) - 21);
  return Math.max(2, Math.min(5, Math.floor(leftMm / 7)));
}

export function chunkStorageCells(cells, widthMm, options = {}) {
  const size = storageCellsPerRow(widthMm, options);
  if (!cells?.length) return [];
  const rows = [];
  for (let i = 0; i < cells.length; i += size) {
    rows.push(cells.slice(i, i + size));
  }
  return rows;
}

export function buildStorageCellsForLabel(productStorageCells, cellCatalog = []) {
  if (!productStorageCells?.length) return [];

  return productStorageCells
    .map((link) => {
      const cellId = link.storage_cell_id ?? link.id;
      const catalogCell = cellCatalog.find((cell) => cell.id === cellId);
      const name = link.name
        || link.storage_cell_name
        || link.cell_name
        || catalogCell?.name
        || '';
      const value = link.value;
      if (value == null || String(value).trim() === '') return null;
      return {
        nameShort: shortCellName(name),
        value: String(value).trim(),
      };
    })
    .filter(Boolean);
}
