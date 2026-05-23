import React, { useMemo } from 'react';
import { chunkStorageCells } from '../../utils/labelPrintDisplay';

export default function LabelStorageCellsPreview({ cells, widthMm, fullWidth = false, className = '' }) {
  const rows = useMemo(
    () => chunkStorageCells(cells, widthMm, { fullWidth }),
    [cells, widthMm, fullWidth]
  );

  if (!rows.length) return null;

  return (
    <div className={`flex flex-col gap-0 w-full ${className}`.trim()}>
      {rows.map((rowCells, rowIndex) => (
        <table
          key={`storage-row-${rowIndex}`}
          className={`w-full border-collapse table-fixed text-black ${rowIndex > 0 ? '-mt-px [&_th]:border-t-0 [&_td]:border-t-0' : ''}`}
        >
          <thead>
            <tr>
              {rowCells.map((cell) => (
                <th
                  key={`head-${rowIndex}-${cell.nameShort}-${cell.value}`}
                  className="border border-black px-0.5 py-0 text-[7px] font-bold leading-tight text-center"
                >
                  {cell.nameShort}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            <tr>
              {rowCells.map((cell) => (
                <td
                  key={`val-${rowIndex}-${cell.nameShort}-${cell.value}`}
                  className="border border-black px-0.5 py-0 text-[8px] font-semibold leading-tight text-center break-words"
                >
                  {cell.value}
                </td>
              ))}
            </tr>
          </tbody>
        </table>
      ))}
    </div>
  );
}
