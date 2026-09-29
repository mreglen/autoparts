import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

const defaultInputClass = 'sg-pill-input mt-1';

export default function AutoserviceSearchableSelect({
  value,
  onChange,
  options,
  placeholder = 'Выберите…',
  disabled = false,
  loading = false,
  searching = false,
  emptyMessage = 'Ничего не найдено',
  noResultsMessage = 'Ничего не найдено',
  addOptionLabel = 'Добавить',
  onAddClick,
  className = '',
  inputClassName = defaultInputClass,
  remoteSearch = false,
  onQueryChange,
  onInputChange,
}) {
  const rootRef = useRef(null);
  const listRef = useRef(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [listPos, setListPos] = useState(null);

  const updateListPos = useCallback(() => {
    const rect = rootRef.current?.getBoundingClientRect();
    if (!rect) return;
    const below = window.innerHeight - rect.bottom;
    const openUp = below < 208 && rect.top > below;
    setListPos({
      left: rect.left,
      width: rect.width,
      top: openUp ? undefined : rect.bottom + 4,
      bottom: openUp ? window.innerHeight - rect.top + 4 : undefined,
      maxHeight: Math.max(96, Math.min(192, (openUp ? rect.top - 12 : below - 12))),
    });
  }, []);

  useEffect(() => {
    const onDocClick = (e) => {
      if (rootRef.current?.contains(e.target) || listRef.current?.contains(e.target)) return;
      setOpen(false);
      setQuery('');
    };
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, []);

  useEffect(() => {
    if (!open) {
      setListPos(null);
      return undefined;
    }
    updateListPos();
    window.addEventListener('scroll', updateListPos, true);
    window.addEventListener('resize', updateListPos);
    return () => {
      window.removeEventListener('scroll', updateListPos, true);
      window.removeEventListener('resize', updateListPos);
    };
  }, [open, updateListPos]);

  const selected = options.find((o) => String(o.value) === String(value));

  const filtered = useMemo(() => {
    if (remoteSearch) return options;
    const q = query.trim().toLowerCase();
    if (!q) return options;
    return options.filter((o) => (o.searchText || o.label).toLowerCase().includes(q));
  }, [options, query, remoteSearch]);

  useEffect(() => {
    if (!remoteSearch || !onQueryChange || !open) return undefined;
    const timer = setTimeout(() => {
      onQueryChange(query);
    }, 220);
    return () => clearTimeout(timer);
  }, [query, remoteSearch, onQueryChange, open]);

  const displayValue = open ? query : selected?.label || '';
  const listEmptyMessage = options.length === 0 ? emptyMessage : noResultsMessage;

  return (
    <div ref={rootRef} className={`relative min-w-0 ${className}`}>
      <input
        type="text"
        className={inputClassName}
        disabled={disabled || loading}
        placeholder={loading ? 'Загрузка…' : placeholder}
        value={displayValue}
        onChange={(e) => {
          setQuery(e.target.value);
          onInputChange?.(e.target.value);
          setOpen(true);
        }}
        onFocus={() => {
          setOpen(true);
          if (!remoteSearch) {
            setQuery('');
          }
        }}
        autoComplete="off"
      />
      {open && !disabled && !loading && listPos ? createPortal(
        <ul
          ref={listRef}
          aria-busy={searching}
          className="fixed z-[140] overflow-y-auto rounded-sg-lg border border-line bg-surface py-1 shadow-sg-md"
          style={listPos}
        >
          {searching ? (
            <li className="px-4 py-2 text-xs text-ink-muted">Поиск клиентов…</li>
          ) : null}
          {filtered.length === 0 ? (
            <li className="px-4 py-2.5 text-sm text-ink-muted">
              {searching ? 'Введите ещё символы или дождитесь результатов' : listEmptyMessage}
            </li>
          ) : (
            filtered.map((o) => (
              <li key={String(o.value) || '__empty__'}>
                <button
                  type="button"
                  className={`block w-full min-h-11 px-4 py-2.5 text-left text-sm hover:bg-brand-50 lg:min-h-0 ${
                    String(o.value) === String(value) ? 'bg-brand-50 font-medium text-brand-700' : 'text-ink-soft'
                  }`}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => {
                    onChange(String(o.value));
                    setOpen(false);
                    setQuery('');
                  }}
                >
                  <span className="block font-medium">{o.label}</span>
                  {o.hint ? (
                    <span className="mt-0.5 block text-xs text-brand-600">{o.hint}</span>
                  ) : null}
                </button>
              </li>
            ))
          )}
          {onAddClick ? (
            <li className="sticky bottom-0 border-t border-line-soft bg-surface">
              <button
                type="button"
                className="flex w-full min-h-11 items-center gap-2 px-4 py-2.5 text-left text-sm font-medium text-brand-600 hover:bg-brand-50 lg:min-h-0"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => {
                  setOpen(false);
                  setQuery('');
                  onAddClick();
                }}
              >
                <svg className="h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden>
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                {addOptionLabel}
              </button>
            </li>
          ) : null}
        </ul>,
        document.body,
      ) : null}
    </div>
  );
}
