import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

function normalizeOemKey(oem) {
  return String(oem || '')
    .replace(/[^A-Za-z0-9А-Яа-яЁё]/g, '')
    .toUpperCase();
}

function normalizeCode(code) {
  const text = String(code ?? '').trim();
  return text || '';
}

function lookupAvail(availability, oem) {
  if (!oem || !availability) return null;
  const key = normalizeOemKey(oem);
  return availability[key] || availability[String(oem).toUpperCase()] || null;
}

function detailRowKey(d, idx) {
  return String(d.detail_id || `${d.oem || 'd'}-${idx}`);
}

function AvailCell({ row, loading }) {
  if (loading && !row) return <span className="text-xs text-gray-400">…</span>;
  if (!row) return <span className="text-gray-400">—</span>;
  const used = row.used?.count ?? 0;
  const rossko = row.rossko?.count ?? 0;
  const parts = [];
  if (rossko > 0 || row.rossko?.available) parts.push(rossko > 0 ? `нов. ${rossko}` : 'нов.');
  if (used > 0 || row.used?.available) parts.push(used > 0 ? `б/у ${used}` : 'б/у');
  if (!parts.length) return <span className="text-gray-400">нет</span>;
  return <span className="text-xs font-medium text-emerald-700">{parts.join(' · ')}</span>;
}

function toNum(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

/** Map Laximo pixel coords onto object-contain / object-top content box. */
function containLayout(cssW, cssH, natW, natH) {
  if (!cssW || !cssH || !natW || !natH) return null;
  const scale = Math.min(cssW / natW, cssH / natH);
  const w = natW * scale;
  const h = natH * scale;
  return {
    left: (cssW - w) / 2,
    top: 0,
    w,
    h,
    scale,
  };
}

function SchemaImage({
  src,
  alt,
  imageMap,
  hoverCode,
  onHoverCode,
  onSelectCode,
}) {
  const wrapRef = useRef(null);
  const imgRef = useRef(null);
  const [zoomed, setZoomed] = useState(false);
  const [layout, setLayout] = useState(null);

  const recompute = useCallback(() => {
    const img = imgRef.current;
    if (!img) return;
    const natW = img.naturalWidth;
    const natH = img.naturalHeight;
    if (!natW || !natH) return;
    // client* = CSS box of <img>; with object-contain object-top content sits at top.
    setLayout(containLayout(img.clientWidth, img.clientHeight, natW, natH));
  }, []);

  useEffect(() => {
    recompute();
    const img = imgRef.current;
    if (!img || typeof ResizeObserver === 'undefined') return undefined;
    const ro = new ResizeObserver(() => recompute());
    ro.observe(img);
    window.addEventListener('resize', recompute);
    return () => {
      ro.disconnect();
      window.removeEventListener('resize', recompute);
    };
  }, [recompute, src]);

  const areas = useMemo(() => {
    if (!layout) return [];
    return (imageMap || [])
      .map((area, idx) => {
        const x1 = toNum(area.x1);
        const y1 = toNum(area.y1);
        const x2 = toNum(area.x2);
        const y2 = toNum(area.y2);
        const code = normalizeCode(area.code_on_image);
        if (x1 == null || y1 == null || x2 == null || y2 == null || !code) return null;
        const left = Math.min(x1, x2);
        const top = Math.min(y1, y2);
        const width = Math.abs(x2 - x1);
        const height = Math.abs(y2 - y1);
        if (width < 1 || height < 1) return null;
        // Expand tiny hotspots from their center so the number stays in the middle.
        // Slight up/left nudge — Laximo boxes sit a bit low/right of the digit.
        const rawW = width * layout.scale;
        const rawH = height * layout.scale;
        const w = Math.max(rawW, 14);
        const h = Math.max(rawH, 14);
        const cx = layout.left + (left + width / 2) * layout.scale;
        const cy = layout.top + (top + height / 2) * layout.scale;
        const nudgeX = -1.5;
        const nudgeY = -2.5;
        return {
          key: `${code}-${idx}`,
          code,
          style: {
            left: cx - w / 2 + nudgeX,
            top: cy - h / 2 + nudgeY,
            width: w,
            height: h,
          },
        };
      })
      .filter(Boolean);
  }, [imageMap, layout]);

  if (!src) {
    return (
      <div className="flex min-h-[120px] items-center justify-center rounded-lg bg-gray-50 text-sm text-gray-400">
        Нет схемы
      </div>
    );
  }

  return (
    <>
      <div className="relative overflow-hidden rounded-lg bg-white ring-1 ring-gray-200">
        <div ref={wrapRef} className="relative mx-auto w-full leading-none">
          <img
            ref={imgRef}
            src={src}
            alt={alt || ''}
            className="mx-auto block max-h-[min(70vh,640px)] w-full object-contain object-top"
            onLoad={recompute}
            draggable={false}
          />
          {areas.map((area) => {
            const active = hoverCode && hoverCode === area.code;
            return (
              <button
                key={area.key}
                type="button"
                title={`№ ${area.code}`}
                aria-label={`Позиция ${area.code}`}
                className={`absolute z-10 rounded-sm border transition ${
                  active
                    ? 'border-indigo-500 bg-indigo-500/40 shadow-sm'
                    : 'border-transparent bg-indigo-500/0 hover:border-indigo-400 hover:bg-indigo-500/25'
                }`}
                style={area.style}
                onMouseEnter={() => onHoverCode?.(area.code)}
                onMouseLeave={() => onHoverCode?.(null)}
                onFocus={() => onHoverCode?.(area.code)}
                onBlur={() => onHoverCode?.(null)}
                onClick={(e) => {
                  e.stopPropagation();
                  onSelectCode?.(area.code);
                }}
              />
            );
          })}
        </div>
        <button
          type="button"
          onClick={() => setZoomed(true)}
          className="absolute bottom-2 right-2 z-20 rounded-md bg-black/50 px-2 py-1 text-[11px] font-medium text-white hover:bg-black/70"
        >
          Увеличить
        </button>
      </div>
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

/** Scroll table row into the list panel only when it is outside the visible area. */
function scrollRowIntoPanel(rowEl, panelEl) {
  if (!rowEl || !panelEl) return;
  const panelRect = panelEl.getBoundingClientRect();
  const rowRect = rowEl.getBoundingClientRect();
  const sticky = panelEl.querySelector('thead');
  const stickyH = sticky ? sticky.getBoundingClientRect().height : 0;
  const topEdge = panelRect.top + stickyH;
  const bottomEdge = panelRect.bottom;
  const pad = 4;

  if (rowRect.top >= topEdge + pad && rowRect.bottom <= bottomEdge - pad) {
    return;
  }

  const deltaTop = rowRect.top - topEdge - pad;
  const deltaBottom = rowRect.bottom - (bottomEdge - pad);
  if (deltaTop < 0) {
    panelEl.scrollTop += deltaTop;
  } else if (deltaBottom > 0) {
    panelEl.scrollTop += deltaBottom;
  }
}

export default function VinCatalogUnitView({
  title,
  imageUrl,
  imageMap,
  details,
  availability,
  availabilityLoading = false,
  searchEmpty,
  hoverRowKey,
  onHoverRowKey,
  onSelectDetail,
  onDetailFilter,
}) {
  const [hoverCode, setHoverCode] = useState(null);
  const rowRefs = useRef({});
  const listPanelRef = useRef(null);

  const detailsList = details || [];

  const codeToRows = useMemo(() => {
    const map = new Map();
    detailsList.forEach((d, idx) => {
      const code = normalizeCode(d.code_on_image);
      if (!code) return;
      if (!map.has(code)) map.set(code, []);
      map.get(code).push({ detail: d, idx, key: detailRowKey(d, idx) });
    });
    return map;
  }, [detailsList]);

  const setHover = useCallback(
    (code, rowKey = null) => {
      setHoverCode(code || null);
      onHoverRowKey?.(rowKey || null);
    },
    [onHoverRowKey]
  );

  const ensureRowVisible = useCallback((rowKey) => {
    if (!rowKey) return;
    const el = rowRefs.current[rowKey];
    const panel = listPanelRef.current;
    if (!el || !panel) return;
    scrollRowIntoPanel(el, panel);
  }, []);

  const onSelectCode = useCallback(
    (code) => {
      const rows = codeToRows.get(normalizeCode(code)) || [];
      const first = rows.find((r) => (r.detail?.oem || '').trim())?.detail || rows[0]?.detail;
      if (!first) return;
      if (rows[0]?.key) ensureRowVisible(rows[0].key);
      if (first.filter && onDetailFilter) {
        onDetailFilter(first);
        return;
      }
      if (!(first.oem || '').trim()) return;
      onSelectDetail?.(first);
    },
    [codeToRows, ensureRowVisible, onDetailFilter, onSelectDetail]
  );

  return (
    <div className="space-y-2">
      <div className={`grid gap-3 items-start ${imageUrl ? 'lg:grid-cols-[1.2fr_1fr]' : ''}`}>
        {imageUrl ? (
          <SchemaImage
            src={imageUrl}
            alt={title}
            imageMap={imageMap}
            hoverCode={hoverCode}
            onHoverCode={(code) => {
              if (!code) {
                setHover(null, null);
                return;
              }
              const rows = codeToRows.get(code) || [];
              const rowKey = rows[0]?.key || null;
              setHover(code, rowKey);
              ensureRowVisible(rowKey);
            }}
            onSelectCode={onSelectCode}
          />
        ) : null}

        <div
          ref={listPanelRef}
          className="min-w-0 overflow-x-auto lg:max-h-[min(70vh,640px)] lg:overflow-y-auto"
        >
          {title ? (
            <h3 className="mb-2 text-sm font-semibold text-gray-900">{title}</h3>
          ) : null}
          {searchEmpty ? (
            <p className="py-8 text-center text-sm text-gray-500">Ничего не найдено</p>
          ) : !detailsList.length ? (
            <p className="py-8 text-center text-sm text-gray-500">Нет деталей</p>
          ) : (
            <table className="min-w-full text-left text-sm">
              <thead className="sticky top-0 bg-white">
                <tr className="border-b border-gray-200 text-xs text-gray-500">
                  <th className="w-10 py-2 pr-2 font-medium">№</th>
                  <th className="py-2 pr-2 font-medium">Деталь</th>
                  <th className="py-2 pr-2 font-medium">OEM</th>
                  <th className="py-2 font-medium">Наличие</th>
                </tr>
              </thead>
              <tbody>
                {detailsList.map((d, idx) => {
                  const key = detailRowKey(d, idx);
                  const code = normalizeCode(d.code_on_image);
                  const isHover =
                    (hoverCode && code && hoverCode === code)
                    || (hoverRowKey && hoverRowKey === key);
                  const needsFilter = Boolean(d.filter);
                  const matched = d.match === true || d.match === 't' || d.match === 'true';
                  return (
                    <tr
                      key={key}
                      ref={(el) => {
                        if (el) rowRefs.current[key] = el;
                        else delete rowRefs.current[key];
                      }}
                      className={`cursor-pointer border-b border-gray-50 transition ${
                        isHover
                          ? 'bg-indigo-100'
                          : matched
                            ? 'bg-indigo-50/40 hover:bg-indigo-50'
                            : 'hover:bg-gray-50'
                      }`}
                      onMouseEnter={() => setHover(code || null, key)}
                      onMouseLeave={() => setHover(null, null)}
                      onClick={() => {
                        if (needsFilter && onDetailFilter) {
                          onDetailFilter(d);
                          return;
                        }
                        if (!(d.oem || '').trim()) return;
                        onSelectDetail(d);
                      }}
                    >
                      <td className="py-2.5 pr-2 font-mono text-xs text-gray-500">
                        {code || '—'}
                      </td>
                      <td className="py-2.5 pr-2 text-gray-900">
                        {d.name || '—'}
                        {needsFilter ? (
                          <span className="ml-1 text-xs text-amber-600">?</span>
                        ) : null}
                      </td>
                      <td className="py-2.5 pr-2 font-mono text-xs text-indigo-700">{d.oem || '—'}</td>
                      <td className="py-2.5">
                        <AvailCell
                          row={lookupAvail(availability, d.oem)}
                          loading={availabilityLoading}
                        />
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
