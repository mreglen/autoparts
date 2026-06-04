import React, { useEffect, useState } from 'react';

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
    <div className="relative z-10 border-t border-gray-100 pt-4 first:border-t-0 first:pt-0">
      <button
        type="button"
        onClick={() => setExpanded((prev) => !prev)}
        className="mb-2 flex min-h-11 w-full touch-manipulation items-center justify-between rounded-lg px-1 text-sm font-medium text-gray-700 active:bg-gray-50"
        aria-expanded={expanded}
      >
        <span>{title}</span>
        <svg
          className={`h-5 w-5 shrink-0 text-gray-400 transition-transform ${expanded ? 'rotate-180' : ''}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
          aria-hidden
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      {expanded && (
        <div className="space-y-1 pb-1">
          {options.map((option) => (
            <label
              key={option.value}
              className="flex min-h-11 touch-manipulation cursor-pointer items-center gap-3 rounded-lg px-1 text-sm text-gray-700 active:bg-gray-50"
            >
              <input
                type="radio"
                name={`sort-filter-${title}`}
                checked={value === option.value}
                onChange={() => onChange(option.value)}
                className="h-4 w-4 shrink-0 border-gray-300 text-indigo-600 focus:ring-indigo-500"
              />
              <span>{option.label}</span>
            </label>
          ))}
        </div>
      )}
    </div>
  );
}
