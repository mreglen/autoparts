import React, { useEffect, useRef, useState } from 'react';
import { apiRequest } from '../../utils/apiClient';

function optionLabel(field, row) {
  if (field === 'brand') {
    return row.brand || '—';
  }
  if (field === 'article') {
    return row.article || '—';
  }
  return row.name || '—';
}

function optionHint(field, row) {
  const parts = [];
  if (field !== 'brand' && row.brand) parts.push(row.brand);
  if (field !== 'article' && row.article) parts.push(row.article);
  if (field !== 'name' && row.name) parts.push(row.name);
  return parts.join(' · ');
}

export default function AutoserviceReceiptSuggestField({
  field,
  value,
  onValueChange,
  onPick,
  placeholder,
  inputClassName,
  className = '',
  disabled = false,
}) {
  const rootRef = useRef(null);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [options, setOptions] = useState([]);

  useEffect(() => {
    const onDocClick = (event) => {
      if (rootRef.current && !rootRef.current.contains(event.target)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, []);

  useEffect(() => {
    if (!open || disabled) return undefined;
    let cancelled = false;
    const timer = setTimeout(async () => {
      setLoading(true);
      try {
        const params = new URLSearchParams({
          field,
          q: value || '',
          limit: '15',
        });
        const rows = await apiRequest(`/autoservice/warehouse/receipts/suggest?${params.toString()}`);
        if (!cancelled) {
          setOptions(Array.isArray(rows) ? rows : []);
        }
      } catch {
        if (!cancelled) setOptions([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }, 220);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [open, disabled, field, value]);

  const handlePick = (row) => {
    onPick?.(row);
    setOpen(false);
  };

  return (
    <div ref={rootRef} className={`relative min-w-0 ${className}`}>
      <input
        type="text"
        className={inputClassName}
        value={value}
        disabled={disabled}
        placeholder={placeholder}
        autoComplete="off"
        onChange={(event) => {
          onValueChange(event.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
      />
      {open && !disabled ? (
        <ul className="absolute z-40 mt-1 max-h-48 w-full overflow-y-auto rounded-lg border border-gray-200 bg-white py-1 shadow-lg">
          {loading ? (
            <li className="px-3 py-2 text-sm text-gray-500">Загрузка…</li>
          ) : options.length === 0 ? (
            <li className="px-3 py-2 text-sm text-gray-500">Ничего не найдено</li>
          ) : (
            options.map((row, index) => {
              const hint = optionHint(field, row);
              return (
                <li key={`${row.brand}-${row.article}-${row.name}-${index}`}>
                  <button
                    type="button"
                    className="block w-full px-3 py-2 text-left hover:bg-indigo-50"
                    onMouseDown={(event) => event.preventDefault()}
                    onClick={() => handlePick(row)}
                  >
                    <div className="text-sm font-medium text-gray-900">{optionLabel(field, row)}</div>
                    {hint ? <div className="mt-0.5 text-xs text-gray-500">{hint}</div> : null}
                  </button>
                </li>
              );
            })
          )}
        </ul>
      ) : null}
    </div>
  );
}
