import { useState } from 'react';
import PillDropdown from '../PillDropdown/PillDropdown';

export default function PageFiltersPanel({
  searchComponent,
  filters = [],
  sortOptions = [],
  sortValue = '',
  onSortChange,
  sortPlaceholder = 'Сортировка',
  children,
  className = '',
}) {
  const [openDropdown, setOpenDropdown] = useState(null);

  const handleDropdownOpen = (key) => (open) => {
    setOpenDropdown(open ? key : null);
  };

  return (
    <div className={`mb-4 space-y-3 ${className}`}>
      <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
        {searchComponent ? (
          <div className="min-w-0 flex-[2]">{searchComponent}</div>
        ) : null}

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
            className="min-w-[10rem] flex-1"
          />
        ))}

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
            className="min-w-[10rem]"
            triggerClassName="h-9 rounded-xl bg-white px-3 ring-1 ring-gray-200 hover:bg-gray-50"
            menuClassName="min-w-[14rem]"
          />
        ) : null}
      </div>

      {children ? <div className="mt-3">{children}</div> : null}
    </div>
  );
}
