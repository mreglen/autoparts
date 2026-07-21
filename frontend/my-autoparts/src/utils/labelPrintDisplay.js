/** Сокращает текст: каждое слово — до maxLen символов (длинные слова обрезаются). */
export function shortStorageCellText(text, maxLen = 5) {
  const raw = String(text ?? '').trim();
  if (!raw) return '—';
  const words = raw.split(/\s+/).filter(Boolean);
  if (!words.length) return '—';
  return words
    .map((word) => (word.length > maxLen ? word.slice(0, maxLen) : word))
    .join(' ');
}

export function shortCellName(name) {
  return shortStorageCellText(name, 4);
}

export function findStorageCellInCatalog(cellCatalog, cellId) {
  if (cellId == null || !cellCatalog?.length) return null;
  const id = String(cellId);
  return cellCatalog.find((cell) => String(cell.id) === id) || null;
}

export function resolveStorageCellName(link, cellCatalog = []) {
  const cellId = link?.storage_cell_id ?? link?.id;
  const fromLink = link?.name || link?.storage_cell_name || link?.cell_name || '';
  if (String(fromLink).trim()) return String(fromLink).trim();
  const catalogCell = findStorageCellInCatalog(cellCatalog, cellId);
  return catalogCell?.name?.trim() || '';
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
      const name = resolveStorageCellName(link, cellCatalog);
      const value = link.value;
      if (value == null || String(value).trim() === '') return null;
      return {
        nameShort: shortCellName(name),
        value: String(value).trim(),
      };
    })
    .filter(Boolean);
}

/**
 * Compact "адресное хранение" line for order / confirm UI.
 * Returns { warehouse, cells, line } — empty strings when nothing to show.
 */
export function formatProductStorageInline({
  storage_location_name,
  product_storage_cells,
  storage_addresses,
} = {}, { short = false } = {}) {
  const warehouse = String(storage_location_name || '').trim();

  const links = Array.isArray(product_storage_cells) ? product_storage_cells : [];
  const cellParts = links
    .map((link) => {
      if (link?.value == null || String(link.value).trim() === '') return null;
      const name = resolveStorageCellName(link, []);
      const value = String(link.value).trim();
      if (short) {
        const nameShort = shortStorageCellText(name);
        const valueShort = shortStorageCellText(value);
        return [nameShort !== '—' ? nameShort : '', valueShort !== '—' ? valueShort : '']
          .filter(Boolean)
          .join(' ');
      }
      return [name, value].filter(Boolean).join(' ');
    })
    .filter(Boolean);

  let cells = cellParts.join(' · ');
  if (!cells && Array.isArray(storage_addresses) && storage_addresses.length) {
    cells = storage_addresses
      .map((row) => String(row || '').trim())
      .filter(Boolean)
      .join(' · ');
  }

  const line = [warehouse, cells].filter(Boolean).join(' · ');
  return { warehouse, cells, line };
}
