import React, { useCallback, useEffect, useRef, useState } from 'react';

function useDebouncedValue(value, delayMs) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(t);
  }, [value, delayMs]);
  return debounced;
}

export default function AuditEntityPicker({
  label,
  placeholder,
  value,
  displayValue,
  onChange,
  onSelect,
  fetchOptions,
  renderOption,
  getOptionKey,
}) {
  const [input, setInput] = useState(displayValue || value || '');
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [options, setOptions] = useState([]);
  const [highlight, setHighlight] = useState(-1);
  const wrapRef = useRef(null);
  const debounced = useDebouncedValue(input, 300);

  useEffect(() => {
    setInput(displayValue || value || '');
  }, [displayValue, value]);

  useEffect(() => {
    if (!open) return undefined;
    let cancelled = false;
    setLoading(true);
    fetchOptions(debounced)
      .then((items) => {
        if (!cancelled) setOptions(items || []);
      })
      .catch(() => {
        if (!cancelled) setOptions([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [debounced, open, fetchOptions]);

  useEffect(() => {
    const onDoc = (e) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) {
        setOpen(false);
        setHighlight(-1);
      }
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, []);

  const handleSelect = useCallback(
    (opt) => {
      onSelect(opt);
      setOpen(false);
      setHighlight(-1);
    },
    [onSelect]
  );

  const handleClear = () => {
    setInput('');
    onChange('');
    onSelect(null);
    setOpen(false);
  };

  return (
    <div ref={wrapRef} className="relative">
      <label className="mb-1 block text-xs font-medium text-gray-600">{label}</label>
      <div className="relative">
        <input
          type="text"
          placeholder={placeholder}
          value={input}
          onChange={(e) => {
            setInput(e.target.value);
            onChange(e.target.value);
            setOpen(true);
            setHighlight(-1);
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={(e) => {
            if (!open && (e.key === 'ArrowDown' || e.key === 'ArrowUp')) {
              setOpen(true);
              return;
            }
            if (e.key === 'Escape') {
              setOpen(false);
              return;
            }
            if (e.key === 'ArrowDown') {
              e.preventDefault();
              setHighlight((h) => Math.min(h + 1, options.length - 1));
            }
            if (e.key === 'ArrowUp') {
              e.preventDefault();
              setHighlight((h) => Math.max(h - 1, 0));
            }
            if (e.key === 'Enter' && highlight >= 0 && options[highlight]) {
              e.preventDefault();
              handleSelect(options[highlight]);
            }
          }}
          className="w-full rounded-lg border border-gray-300 px-3 py-2 pr-8 text-sm focus:border-indigo-500 focus:ring-indigo-500"
        />
        {(input || value) && (
          <button
            type="button"
            onClick={handleClear}
            className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
            aria-label="Очистить"
          >
            ×
          </button>
        )}
      </div>
      {open && (loading || options.length > 0) && (
        <ul className="absolute z-40 mt-1 max-h-60 w-full overflow-auto rounded-lg border border-gray-200 bg-white py-1 shadow-lg">
          {loading && (
            <li className="px-3 py-2 text-sm text-gray-500">Загрузка...</li>
          )}
          {!loading &&
            options.map((opt, idx) => (
              <li key={getOptionKey(opt)}>
                <button
                  type="button"
                  className={`w-full px-3 py-2 text-left hover:bg-indigo-50 ${
                    idx === highlight ? 'bg-indigo-50' : ''
                  }`}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => handleSelect(opt)}
                >
                  {renderOption(opt)}
                </button>
              </li>
            ))}
          {!loading && options.length === 0 && debounced.trim() && (
            <li className="px-3 py-2 text-sm text-gray-500">Ничего не найдено</li>
          )}
        </ul>
      )}
    </div>
  );
}
