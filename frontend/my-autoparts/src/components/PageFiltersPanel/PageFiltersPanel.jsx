import { useState } from 'react';
import PillDropdown from '../PillDropdown/PillDropdown';

const pillButtonClass =
  'inline-flex h-10 items-center justify-center gap-1.5 rounded-full bg-gray-100 px-4 text-sm font-medium text-gray-700 transition hover:bg-gray-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/30';

const chevronIconClass = 'h-4 w-4 text-gray-400 transition-transform';

export default function PageFiltersPanel({
  searchComponent,
  filters = [],
  activeFilterCount: activeFilterCountProp,
  sortOptions = [],
  sortValue = '',
  onSortChange,
  sortPlaceholder = 'Сортировка',
  filterLabel = 'Фильтры',
  children,
  className = '',
}) {
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [openDropdown, setOpenDropdown] = useState(null);

  const handleDropdownOpen = (key) => (open) => {
    setOpenDropdown(open ? key : null);
  };

  const activeFilterCount = activeFilterCountProp ?? filters.filter(
    (f) => f.value !== undefined && f.value !== '' && f.value != null,
  ).length;

  return (
    <div className={`mb-4 space-y-3 ${className}`}>
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        {searchComponent ? (
          <div className="min-w-0 flex-1">{searchComponent}</div>
        ) : null}

        <button
          type="button"
          onClick={() => setFiltersOpen((v) => !v)}
          className={`${pillButtonClass} shrink-0 ${filtersOpen ? 'bg-white ring-2 ring-indigo-400/70' : ''}`}
          aria-expanded={filtersOpen}
        >
          {filterLabel}
          {activeFilterCount > 0 ? (
            <span className="ml-1 inline-flex h-5 min-w-[1.25rem] items-center justify-center rounded-full bg-indigo-100 px-1.5 text-xs font-semibold text-indigo-700">
              {activeFilterCount}
            </span>
          ) : null}
          <svg
            className={`${chevronIconClass} ${filtersOpen ? 'rotate-180' : ''}`}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </button>

        {sortOptions.length > 0 ? (
          <PillDropdown
            ariaLabel="Сортировка"
            placeholder={sortPlaceholder}
            value={sortValue}
            options={sortOptions}
            isOpen={openDropdown === 'sort'}
            onOpenChange={handleDropdownOpen('sort')}
            onChange={onSortChange}
            fullWidth={false}
            triggerClassName="h-9 rounded-xl bg-white px-3 ring-1 ring-gray-200 hover:bg-gray-50"
            menuClassName="min-w-[14rem]"
          />
        ) : null}
      </div>

      {filtersOpen ? (
        <div className="space-y-3">
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-4">
            {filters.map((filter) => (
              <PillDropdown
                key={filter.key}
                ariaLabel={filter.label}
                placeholder={filter.placeholder || filter.label}
                value={filter.value ?? ''}
                options={filter.options}
                disabled={filter.disabled}
                isOpen={openDropdown === filter.key}
                onOpenChange={handleDropdownOpen(filter.key)}
                onChange={(value) => filter.onChange(value, filter.key)}
              />
            ))}
          </div>
          {children}
        </div>
      ) : null}
    </div>
  );
}
