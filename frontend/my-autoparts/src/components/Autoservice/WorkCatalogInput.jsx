import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { apiRequest } from '../../utils/apiClient';

const inputSm =
  'block w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-[#00a046] focus:outline-none focus:ring-1 focus:ring-[#00a046]';

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
      unit_price: String(item.default_unit_price ?? 0),
    });
    setOpen(false);
    setQuery('');
  };

  const display = open ? query : value || selected?.name || '';

  return (
    <div ref={rootRef} className="relative">
      <input
        type="text"
        className={inputSm}
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
        <ul className="absolute z-30 mt-1 max-h-52 w-full overflow-y-auto rounded-xl border border-gray-200 bg-white py-1 shadow-lg">
          {filtered.map((item) => (
            <li key={item.id}>
              <button
                type="button"
                className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-sm hover:bg-gray-50"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => pick(item)}
              >
                <span className="truncate text-gray-900">{item.name}</span>
                <span className="shrink-0 text-gray-500">{formatMoney(item.default_unit_price)} ₽</span>
              </button>
            </li>
          ))}
          {!exactMatch && (query || value || '').trim().length >= 2 ? (
            <li className="border-t border-gray-100">
              <button
                type="button"
                className="w-full px-3 py-2 text-left text-sm font-medium text-[#00a046] hover:bg-green-50"
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
            <li className="px-3 py-2 text-sm text-gray-500">Начните ввод</li>
          ) : null}
        </ul>
      ) : null}
    </div>
  );
}
