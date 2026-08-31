import { useEffect, useMemo, useRef, useState } from 'react';
import { apiRequest } from '../../utils/apiClient';

const pillInputSmClass =
  'block h-9 w-full min-w-0 rounded-full border border-transparent bg-gray-100 px-2.5 text-sm text-ink shadow-none transition hover:bg-gray-50 focus:border-brand-400 focus:bg-white focus:outline-none focus:ring-0 disabled:cursor-not-allowed disabled:opacity-60 max-md:text-base lg:h-8';

function formatMoney(value) {
  const n = Number(value);
  if (Number.isNaN(n)) return '0';
  return n.toLocaleString('ru-RU', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
}

export default function WorkCatalogInput({ value, catalogWorkId, options, onChange, onCreate, disabled }) {
  const rootRef = useRef(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');

  useEffect(() => {
    const onDoc = (e) => {
      if (rootRef.current && !rootRef.current.contains(e.target)) {
        setOpen(false);
        setQuery('');
      }
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, []);

  const selected = options.find((o) => String(o.id) === String(catalogWorkId));

  const filtered = useMemo(() => {
    const q = (open ? query : value || '').trim().toLowerCase();
    if (!q) return options.slice(0, 12);
    return options.filter((o) => o.name.toLowerCase().includes(q)).slice(0, 12);
  }, [options, query, value, open]);

  const exactMatch = options.find((o) => o.name.toLowerCase() === (value || '').trim().toLowerCase());

  const pick = (item) => {
    onChange({
      title: item.name,
      catalog_work_id: String(item.id),
    });
    setOpen(false);
    setQuery('');
  };

  const display = open ? query : value || selected?.name || '';

  return (
    <div ref={rootRef} className="relative min-w-0">
      <input
        type="text"
        className={pillInputSmClass}
        disabled={disabled}
        placeholder="Работа"
        value={display}
        onChange={(e) => {
          const next = e.target.value;
          setQuery(next);
          setOpen(true);
          onChange({ title: next, catalog_work_id: '' });
        }}
        onFocus={() => {
          setOpen(true);
          setQuery(value || '');
        }}
        autoComplete="off"
      />
      {open && !disabled ? (
        <ul className="absolute z-30 mt-1 max-h-52 w-full overflow-y-auto rounded-sg-lg border border-line bg-surface py-1 shadow-sg-md">
          {filtered.map((item) => (
            <li key={item.id}>
              <button
                type="button"
                className="flex w-full min-h-11 items-center justify-between gap-2 px-4 py-2.5 text-left text-sm hover:bg-brand-50 lg:min-h-0"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => pick(item)}
              >
                <span className="truncate text-ink">{item.name}</span>
                <span className="shrink-0 text-ink-muted">{formatMoney(item.default_unit_price)} ₽</span>
              </button>
            </li>
          ))}
          {!exactMatch && onCreate && (query || value || '').trim().length >= 2 ? (
            <li className="border-t border-line-soft">
              <button
                type="button"
                className="w-full min-h-11 px-4 py-2.5 text-left text-sm font-medium text-brand-600 hover:bg-brand-50 lg:min-h-0"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => {
                  const name = (query || value || '').trim();
                  onCreate?.(name);
                  setOpen(false);
                  setQuery('');
                }}
              >
                + «{(query || value || '').trim()}»
              </button>
            </li>
          ) : null}
          {filtered.length === 0 && !(query || value || '').trim() ? (
            <li className="px-4 py-2.5 text-sm text-ink-muted">Начните ввод</li>
          ) : null}
        </ul>
      ) : null}
    </div>
  );
}
