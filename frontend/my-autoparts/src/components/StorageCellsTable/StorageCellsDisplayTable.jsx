import React, { useMemo } from 'react';
import { resolveStorageCellName, shortStorageCellText } from '../../utils/labelPrintDisplay';

export function buildStorageCellsForDisplay(productStorageCells, cellCatalog = []) {
  if (!productStorageCells?.length) return [];

  return productStorageCells
    .map((link) => {
      const value = link.value;
      if (value == null || String(value).trim() === '') return null;
      const cellId = link.storage_cell_id ?? link.id;
      const name = resolveStorageCellName(link, cellCatalog);
      return {
        id: cellId,
        nameShort: shortStorageCellText(name),
        value: shortStorageCellText(String(value).trim()),
        nameFull: String(name || '').trim(),
        valueFull: String(value).trim(),
      };
    })
    .filter(Boolean);
}

function StorageCellsDisplayCards({ cells, compact = false }) {
  return (
    <ul className="space-y-2 md:hidden">
      {cells.map((cell) => (
        <li
          key={`card-${cell.id}`}
          className="flex items-center justify-between gap-3 rounded-xl bg-gray-50 px-3 py-2.5 ring-1 ring-gray-200/80"
        >
          <span
            className={`min-w-0 truncate font-medium text-gray-700 ${compact ? 'text-xs' : 'text-sm'}`}
            title={cell.nameFull || undefined}
          >
            {cell.nameShort}
          </span>
          <span
            className={`shrink-0 tabular-nums font-semibold text-gray-900 ${compact ? 'text-xs' : 'text-sm'}`}
            title={cell.valueFull || undefined}
          >
            {cell.value}
          </span>
        </li>
      ))}
    </ul>
  );
}

function StorageCellsDisplayTableDesktop({ cells, compact = false, className = '' }) {
  const thClass = compact
    ? 'px-2 py-1 text-[10px] font-semibold text-gray-600 uppercase border border-gray-200 bg-gray-50 text-center'
    : 'px-3 py-2 text-xs font-semibold text-gray-600 uppercase border border-gray-200 bg-gray-50 text-center';
  const tdClass = compact
    ? 'px-2 py-1 text-xs font-medium text-gray-900 border border-gray-200 text-center'
    : 'px-3 py-2 text-sm font-medium text-gray-900 border border-gray-200 text-center';

  return (
    <div className={`hidden overflow-x-auto md:block ${className}`.trim()}>
      <table className="min-w-full border-collapse table-fixed border border-gray-200 rounded-lg overflow-hidden">
        <thead>
          <tr>
            {cells.map((cell) => (
              <th
                key={`head-${cell.id}`}
                className={thClass}
                title={cell.nameFull || undefined}
              >
                {cell.nameShort}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          <tr>
            {cells.map((cell) => (
              <td
                key={`val-${cell.id}`}
                className={tdClass}
                title={cell.valueFull || undefined}
              >
                {cell.value}
              </td>
            ))}
          </tr>
        </tbody>
      </table>
    </div>
  );
}

export default function StorageCellsDisplayTable({
  productStorageCells = [],
  cellCatalog = [],
  compact = false,
  className = '',
}) {
  const cells = useMemo(
    () => buildStorageCellsForDisplay(productStorageCells, cellCatalog),
    [productStorageCells, cellCatalog],
  );

  if (!cells.length) return null;

  return (
    <div className={className}>
      <StorageCellsDisplayCards cells={cells} compact={compact} />
      <StorageCellsDisplayTableDesktop cells={cells} compact={compact} />
    </div>
  );
}
