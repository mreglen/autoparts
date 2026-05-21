import React, { useEffect, useRef, useState } from 'react';
import { apiAxios } from '../../utils/apiClient';

function useDebouncedValue(value, delayMs) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(t);
  }, [value, delayMs]);
  return debounced;
}

const HINT_LABELS = {
  summary: 'Описание',
  email: 'Email',
  actor: 'Актор',
  event_type: 'Тип события',
};

export default function AuditSearchInput({ value, onChange, onApply }) {
  const [open, setOpen] = useState(false);
  const [hints, setHints] = useState([]);
  const [loading, setLoading] = useState(false);
  const [highlight, setHighlight] = useState(-1);
  const wrapRef = useRef(null);
  const debounced = useDebouncedValue(value, 300);

  useEffect(() => {
    if (!open || !debounced.trim()) {
      setHints([]);
      return undefined;
    }
    let cancelled = false;
    setLoading(true);
    apiAxios
      .get('/audit/meta/search-hints', { params: { q: debounced.trim(), limit: 10 } })
      .then((res) => {
        if (!cancelled) setHints(res.data?.items || []);
      })
      .catch(() => {
        if (!cancelled) setHints([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [debounced, open]);

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

  const applyHint = (hint) => {
    const v = hint.label && hint.hint_type === 'event_type' ? hint.label : hint.value;
    onChange(v);
    onApply?.(v);
    setOpen(false);
    setHighlight(-1);
  };

  return (
    <div ref={wrapRef} className="relative md:col-span-2">
      <label className="mb-1 block text-xs font-medium text-gray-600">Поиск</label>
      <input
        type="text"
        placeholder="Email, описание, тип события..."
        value={value}
        onChange={(e) => {
          onChange(e.target.value);
          setOpen(true);
          setHighlight(-1);
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={(e) => {
          if (e.key === 'Escape') {
            setOpen(false);
            return;
          }
          if (e.key === 'ArrowDown') {
            e.preventDefault();
            setHighlight((h) => Math.min(h + 1, hints.length - 1));
          }
          if (e.key === 'ArrowUp') {
            e.preventDefault();
            setHighlight((h) => Math.max(h - 1, 0));
          }
          if (e.key === 'Enter' && highlight >= 0 && hints[highlight]) {
            e.preventDefault();
            applyHint(hints[highlight]);
          }
        }}
        className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:ring-indigo-500"
      />
      {open && (loading || hints.length > 0) && value.trim() && (
        <ul className="absolute z-40 mt-1 max-h-52 w-full overflow-auto rounded-lg border border-gray-200 bg-white py-1 shadow-lg">
          {loading && <li className="px-3 py-2 text-sm text-gray-500">Загрузка...</li>}
          {!loading &&
            hints.map((hint, idx) => (
              <li key={`${hint.hint_type}-${hint.value}-${idx}`}>
                <button
                  type="button"
                  className={`flex w-full flex-col px-3 py-2 text-left hover:bg-indigo-50 ${
                    idx === highlight ? 'bg-indigo-50' : ''
                  }`}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => applyHint(hint)}
                >
                  <span className="text-sm text-gray-900">{hint.label || hint.value}</span>
                  <span className="text-xs text-gray-500">{HINT_LABELS[hint.hint_type] || hint.hint_type}</span>
                </button>
              </li>
            ))}
        </ul>
      )}
    </div>
  );
}
