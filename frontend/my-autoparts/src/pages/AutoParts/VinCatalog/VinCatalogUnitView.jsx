import { useState } from 'react';

function normalizeOemKey(oem) {
  return String(oem || '')
    .replace(/[^A-Za-z0-9А-Яа-яЁё]/g, '')
    .toUpperCase();
}

function lookupAvail(availability, oem) {
  if (!oem || !availability) return null;
  const key = normalizeOemKey(oem);
  return availability[key] || availability[String(oem).toUpperCase()] || null;
}

function detailRowKey(d, idx) {
  return String(d.detail_id || `${d.oem || 'd'}-${idx}`);
}

function AvailCell({ row }) {
  if (!row) return <span className="text-gray-400">—</span>;
  const used = row.used?.count ?? 0;
  const rossko = row.rossko?.count ?? 0;
  const parts = [];
  if (rossko > 0 || row.rossko?.available) parts.push(rossko > 0 ? `нов. ${rossko}` : 'нов.');
  if (used > 0 || row.used?.available) parts.push(used > 0 ? `б/у ${used}` : 'б/у');
  if (!parts.length) return <span className="text-gray-400">нет</span>;
  return <span className="text-xs font-medium text-emerald-700">{parts.join(' · ')}</span>;
}

function SchemaImage({ src, alt }) {
  const [zoomed, setZoomed] = useState(false);
  if (!src) {
    return (
      <div className="flex min-h-[160px] items-center justify-center rounded-lg bg-gray-50 text-sm text-gray-400">
        Нет схемы
      </div>
    );
  }
  return (
    <>
      <button
        type="button"
        onClick={() => setZoomed(true)}
        className="group relative w-full overflow-hidden rounded-lg bg-white ring-1 ring-gray-200"
        title="Увеличить"
      >
        <img
          src={src}
          alt={alt || ''}
          className="mx-auto max-h-[480px] w-full object-contain p-2 transition group-hover:opacity-95"
        />
        <span className="pointer-events-none absolute bottom-2 right-2 rounded-md bg-black/50 px-2 py-1 text-[11px] font-medium text-white opacity-0 transition group-hover:opacity-100">
          Увеличить
        </span>
      </button>
      {zoomed ? (
        <div
          className="fixed inset-0 z-[80] flex items-center justify-center bg-black/70 p-4"
          onClick={() => setZoomed(false)}
          role="presentation"
        >
          <img
            src={src}
            alt={alt || ''}
            className="max-h-[92vh] max-w-[96vw] object-contain"
            onClick={(e) => e.stopPropagation()}
          />
          <button
            type="button"
            onClick={() => setZoomed(false)}
            className="absolute right-4 top-4 rounded-full bg-white/90 px-3 py-1.5 text-sm font-medium text-gray-800 shadow"
          >
            Закрыть
          </button>
        </div>
      ) : null}
    </>
  );
}

export default function VinCatalogUnitView({
  title,
  imageUrl,
  details,
  availability,
  searchEmpty,
  hoverRowKey,
  onHoverRowKey,
  onSelectDetail,
  onDetailFilter,
}) {
  return (
    <div className="space-y-3">
      {title ? <h3 className="text-base font-semibold text-gray-900">{title}</h3> : null}

      <div className={`grid gap-4 ${imageUrl ? 'lg:grid-cols-[1.2fr_1fr]' : ''}`}>
        {imageUrl ? <SchemaImage src={imageUrl} alt={title} /> : null}

        <div className="min-w-0 overflow-x-auto">
          {searchEmpty ? (
            <p className="py-8 text-center text-sm text-gray-500">Ничего не найдено</p>
          ) : !(details || []).length ? (
            <p className="py-8 text-center text-sm text-gray-500">Нет деталей</p>
          ) : (
            <table className="min-w-full text-left text-sm">
              <thead>
                <tr className="border-b border-gray-200 text-xs text-gray-500">
                  <th className="py-2 pr-2 font-medium">Деталь</th>
                  <th className="py-2 pr-2 font-medium">OEM</th>
                  <th className="py-2 font-medium">Наличие</th>
                </tr>
              </thead>
              <tbody>
                {(details || []).map((d, idx) => {
                  const key = detailRowKey(d, idx);
                  const isHover = hoverRowKey && hoverRowKey === key;
                  const needsFilter = Boolean(d.filter);
                  const matched = d.match === true || d.match === 't' || d.match === 'true';
                  return (
                    <tr
                      key={key}
                      className={`cursor-pointer border-b border-gray-50 transition ${
                        isHover ? 'bg-indigo-50' : matched ? 'bg-indigo-50/40 hover:bg-indigo-50' : 'hover:bg-gray-50'
                      }`}
                      onMouseEnter={() => onHoverRowKey?.(key)}
                      onMouseLeave={() => onHoverRowKey?.(null)}
                      onClick={() => {
                        if (needsFilter && onDetailFilter) {
                          onDetailFilter(d);
                          return;
                        }
                        onSelectDetail(d);
                      }}
                    >
                      <td className="py-2.5 pr-2 text-gray-900">
                        {d.name || '—'}
                        {needsFilter ? (
                          <span className="ml-1 text-xs text-amber-600">?</span>
                        ) : null}
                      </td>
                      <td className="py-2.5 pr-2 font-mono text-xs text-indigo-700">{d.oem || '—'}</td>
                      <td className="py-2.5">
                        <AvailCell row={lookupAvail(availability, d.oem)} />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
