import React, { useEffect, useState } from 'react';
import {
  autopartsFilterOptionClass,
  autopartsFilterCheckboxClass,
} from '../../utils/autopartsFilterUi';

/**
 * Раскрывающийся блок выбора сортировки в панели фильтров.
 */
export default function SortFilterSection({
  options,
  value,
  onChange,
  defaultValue,
  title = 'Сортировка',
}) {
  const [expanded, setExpanded] = useState(value !== defaultValue);

  useEffect(() => {
    if (value !== defaultValue) {
      setExpanded(true);
    }
  }, [value, defaultValue]);

  return (
    <div className="space-y-2">
      <button
        type="button"
        onClick={() => setExpanded((prev) => !prev)}
        className="flex min-h-10 w-full touch-manipulation items-center justify-between rounded-full bg-gray-100 px-3 text-sm font-medium text-gray-800 transition hover:bg-gray-50"
        aria-expanded={expanded}
      >
        <span className="text-xs font-medium uppercase tracking-wide text-gray-500">{title}</span>
        <svg
          className={`h-4 w-4 shrink-0 text-gray-400 transition-transform ${expanded ? 'rotate-180' : ''}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
          aria-hidden
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      {expanded && (
        <div className="space-y-1.5">
          {options.map((option) => (
            <label key={option.value} className={autopartsFilterOptionClass}>
              <input
                type="radio"
                name={`sort-filter-${title}`}
                checked={value === option.value}
                onChange={() => onChange(option.value)}
                className={autopartsFilterCheckboxClass}
              />
              <span className="min-w-0 flex-1">{option.label}</span>
            </label>
          ))}
        </div>
      )}
    </div>
  );
}
