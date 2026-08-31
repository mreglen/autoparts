import React, { useMemo, useState } from 'react';
import {
  buildVehicleSubtitle,
  countGroupedFitmentRows,
  groupFitmentForDisplay,
} from '../../utils/fitmentDisplay';

const INITIAL_VISIBLE_ROWS = 12;

export default function PartDetailCompatibilityList({ vehicles = [] }) {
  const [expanded, setExpanded] = useState(false);
  const groups = useMemo(() => groupFitmentForDisplay(vehicles), [vehicles]);
  const totalRows = useMemo(() => countGroupedFitmentRows(groups), [groups]);

  if (!totalRows) return null;

  let visibleBudget = expanded ? totalRows : INITIAL_VISIBLE_ROWS;
  const renderedGroups = [];

  for (const brandGroup of groups) {
    if (visibleBudget <= 0) break;
    const models = [];
    for (const modelGroup of brandGroup.models) {
      if (visibleBudget <= 0) break;
      const rows = modelGroup.rows.slice(0, visibleBudget);
      visibleBudget -= rows.length;
      if (rows.length) {
        models.push({ ...modelGroup, rows });
      }
    }
    if (models.length) {
      renderedGroups.push({ brand: brandGroup.brand, models });
    }
  }

  return (
    <div className="mt-4 space-y-4">
      {renderedGroups.map((brandGroup) => (
        <section key={brandGroup.brand} className="rounded-sg-lg border border-gray-200/80 bg-white">
          <header className="border-b border-gray-100 px-4 py-2.5">
            <h3 className="text-sm font-semibold text-ink">{brandGroup.brand}</h3>
          </header>
          <ul className="divide-y divide-gray-100">
            {brandGroup.models.map((modelGroup) => (
              modelGroup.rows.map((row, index) => {
                const meta = buildVehicleSubtitle(row);
                const key = `${brandGroup.brand}|${modelGroup.model}|${row.generation}|${index}`;
                return (
                  <li key={key} className="px-4 py-3">
                    <p className="text-sm font-medium text-ink">{modelGroup.model}</p>
                    {meta ? <p className="mt-0.5 text-xs text-ink-muted">{meta}</p> : null}
                  </li>
                );
              })
            ))}
          </ul>
        </section>
      ))}

      {totalRows > INITIAL_VISIBLE_ROWS ? (
        <button
          type="button"
          onClick={() => setExpanded((prev) => !prev)}
          className="text-sm font-medium text-accent-700 hover:underline"
        >
          {expanded ? 'Свернуть' : `Показать все ${totalRows}`}
        </button>
      ) : null}
    </div>
  );
}
