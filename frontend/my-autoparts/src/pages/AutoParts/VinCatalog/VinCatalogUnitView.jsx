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

function AvailCell({ row }) {
  if (!row) return <span className="text-gray-400">—</span>;
  const used = row.used?.count ?? 0;
  const rossko = row.rossko?.count ?? 0;
  const parts = [];
  if (rossko > 0 || row.rossko?.available) parts.push(rossko > 0 ? `нов. ${rossko}` : 'нов.');
  if (used > 0 || row.used?.available) parts.push(used > 0 ? `б/у ${used}` : 'б/у');
  if (!parts.length) return <span className="text-gray-400">нет</span>;
  return <span className="text-xs text-gray-600">{parts.join(' · ')}</span>;
}

export default function VinCatalogUnitView({
  title,
  imageUrl,
  imageMap,
  details,
  availability,
  searchEmpty,
  hoverCode,
  onHoverCode,
  onSelectDetail,
  onDetailFilter,
}) {
  const hotspots = (imageMap || []).filter(
    (m) => m.x1 != null && m.y1 != null && m.x2 != null && m.y2 != null
  );

  return (
    <div className="space-y-4">
      <h3 className="text-base font-semibold text-gray-900">{title}</h3>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
        {imageUrl ? (
          <div className="relative overflow-hidden rounded-lg border border-gray-100 bg-gray-50">
            <img src={imageUrl} alt="" className="mx-auto max-h-[360px] w-auto object-contain" />
            {hotspots.length > 0 ? (
              <div className="pointer-events-none absolute inset-0">
                {hotspots.map((m, i) => {
                  const active = hoverCode && String(m.code_on_image) === String(hoverCode);
                  const left = Math.min(Number(m.x1), Number(m.x2));
                  const top = Math.min(Number(m.y1), Number(m.y2));
                  const w = Math.abs(Number(m.x2) - Number(m.x1));
                  const h = Math.abs(Number(m.y2) - Number(m.y1));
                  // Laximo coords often 0–1000 relative; treat as percent of image box
                  const isPct = left <= 100 && top <= 100 && w <= 100 && h <= 100;
                  const style = isPct
                    ? {
                        left: `${left}%`,
                        top: `${top}%`,
                        width: `${Math.max(w, 1)}%`,
                        height: `${Math.max(h, 1)}%`,
                      }
                    : {
                        left: `${left}px`,
                        top: `${top}px`,
                        width: `${Math.max(w, 4)}px`,
                        height: `${Math.max(h, 4)}px`,
                      };
                  return (
                    <div
                      key={`${m.code_on_image}-${i}`}
                      className={`absolute rounded border transition ${
                        active
                          ? 'border-indigo-500 bg-indigo-400/30'
                          : 'border-transparent bg-transparent'
                      }`}
                      style={style}
                    />
                  );
                })}
              </div>
            ) : null}
          </div>
        ) : (
          <div className="flex min-h-[120px] items-center justify-center rounded-lg border border-dashed border-gray-200 text-sm text-gray-400">
            Нет схемы
          </div>
        )}

        <div className="min-w-0 overflow-x-auto">
          {searchEmpty ? (
            <p className="text-sm text-gray-500">Ничего не найдено</p>
          ) : !(details || []).length ? (
            <p className="text-sm text-gray-500">Нет деталей</p>
          ) : (
            <table className="min-w-full text-left text-sm">
              <thead>
                <tr className="border-b border-gray-100 text-xs uppercase tracking-wide text-gray-500">
                  <th className="py-2 pr-2 font-medium">Название</th>
                  <th className="py-2 pr-2 font-medium">Артикул</th>
                  <th className="py-2 font-medium">Наличие</th>
                </tr>
              </thead>
              <tbody>
                {(details || []).map((d, idx) => {
                  const key = d.detail_id || d.oem || idx;
                  const code = d.code_on_image;
                  const isHover = hoverCode && code && String(code) === String(hoverCode);
                  const needsFilter = Boolean(d.filter);
                  return (
                    <tr
                      key={key}
                      className={`cursor-pointer border-b border-gray-50 transition ${
                        isHover ? 'bg-indigo-50' : 'hover:bg-gray-50'
                      }`}
                      onMouseEnter={() => onHoverCode(code || null)}
                      onMouseLeave={() => onHoverCode(null)}
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
                          <span className="ml-1 text-xs text-amber-600">фильтр</span>
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
