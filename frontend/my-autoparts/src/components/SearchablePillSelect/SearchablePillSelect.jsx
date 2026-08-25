import { useEffect, useMemo, useRef, useState, useId } from 'react';
import { warehousePillControlClass } from '../../utils/warehouseListUi';

export const SEARCHABLE_PILL_ADD_VALUE = '__add__';

export default function SearchablePillSelect({
  value,
  onChange,
  options = [],
  placeholder = 'Начните вводить…',
  emptyOptionLabel = 'Без автомобиля',
  addOptionLabel = 'Добавить автомобиль',
  onAddClick,
  disabled = false,
  loading = false,
  ariaLabel,
  id,
  className = '',
  inputClassName = '',
}) {
  const rootRef = useRef(null);
  const inputRef = useRef(null);
  const listboxId = useId();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');

  useEffect(() => {
    if (!open) return undefined;

    const handleClickOutside = (event) => {
      if (!rootRef.current?.contains(event.target)) {
        setOpen(false);
        setQuery('');
      }
    };

    const handleEscape = (event) => {
      if (event.key === 'Escape') {
        setOpen(false);
        setQuery('');
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [open]);

  const selected = options.find((option) => String(option.value) === String(value));

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return options;
    return options.filter((option) => (option.searchText || option.label).toLowerCase().includes(q));
  }, [options, query]);

  const displayValue = open ? query : selected?.label || '';

  const activeOptionId = open && filtered.length > 0
    ? `${listboxId}-opt-${String(filtered[0].value).replace(/[^a-zA-Z0-9_-]/g, '_')}`
    : undefined;

  const handleSelect = (nextValue) => {
    if (nextValue === SEARCHABLE_PILL_ADD_VALUE) {
      setOpen(false);
      setQuery('');
      onAddClick?.();
      return;
    }
    onChange(nextValue === '' ? '' : String(nextValue));
    setOpen(false);
    setQuery('');
  };

  const optionId = (optionValue) => `${listboxId}-opt-${String(optionValue).replace(/[^a-zA-Z0-9_-]/g, '_')}`;

  return (
    <div ref={rootRef} className={`relative min-w-0 ${className}`}>
      <input
        ref={inputRef}
        id={id}
        type="text"
        role="combobox"
        aria-label={ariaLabel}
        aria-expanded={open}
        aria-haspopup="listbox"
        aria-controls={open ? listboxId : undefined}
        aria-activedescendant={activeOptionId}
        aria-autocomplete="list"
        disabled={disabled || loading}
        placeholder={loading ? 'Загрузка…' : placeholder}
        value={displayValue}
        onChange={(event) => {
          setQuery(event.target.value);
          setOpen(true);
        }}
        onFocus={() => {
          setOpen(true);
          if (!open && selected?.label) {
            setQuery('');
          }
        }}
        onKeyDown={(event) => {
          if (event.key !== 'Enter' || !open || filtered.length === 0) return;
          event.preventDefault();
          handleSelect(filtered[0].value);
        }}
        autoComplete="off"
        className={`${inputClassName || warehousePillControlClass} mt-0 pr-10 ${open ? 'bg-white ring-2 ring-indigo-400/70' : ''}`}
      />
      <span className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-3.5 text-gray-400">
        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden>
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </span>

      {open && !disabled && !loading ? (
        <ul
          id={listboxId}
          role="listbox"
          aria-label={ariaLabel}
          className="absolute left-0 z-40 mt-1.5 max-h-64 w-full overflow-auto rounded-xl border border-gray-200 bg-white py-1.5 shadow-lg"
        >
          <li role="option" id={`${listboxId}-opt-empty`} aria-selected={value === ''}>
            <button
              type="button"
              className={`flex w-full px-4 py-2.5 text-left text-sm transition hover:bg-gray-50 ${
                value === '' ? 'bg-indigo-50 font-medium text-indigo-700' : 'text-gray-800'
              }`}
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => handleSelect('')}
            >
              {emptyOptionLabel}
            </button>
          </li>

          {filtered.length === 0 ? (
            <li className="px-4 py-2.5 text-sm text-gray-500">Ничего не найдено</li>
          ) : (
            filtered.map((option) => {
              const isSelected = String(option.value) === String(value);
              return (
                <li key={option.value} role="option" id={optionId(option.value)} aria-selected={isSelected}>
                  <button
                    type="button"
                    className={`flex w-full px-4 py-2.5 text-left text-sm transition hover:bg-gray-50 ${
                      isSelected ? 'bg-indigo-50 font-medium text-indigo-700' : 'text-gray-800'
                    }`}
                    onMouseDown={(event) => event.preventDefault()}
                    onClick={() => handleSelect(option.value)}
                  >
                    <span className="min-w-0 whitespace-normal break-words">{option.label}</span>
                  </button>
                </li>
              );
            })
          )}

          {onAddClick ? (
            <li className="sticky bottom-0 border-t border-gray-100 bg-white">
              <button
                type="button"
                id={`${listboxId}-opt-add`}
                className="flex w-full items-center gap-2 px-4 py-2.5 text-left text-sm font-medium text-indigo-600 transition hover:bg-indigo-50"
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => handleSelect(SEARCHABLE_PILL_ADD_VALUE)}
              >
                <svg className="h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden>
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                {addOptionLabel}
              </button>
            </li>
          ) : null}
        </ul>
      ) : null}
    </div>
  );
}
