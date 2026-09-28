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
  if (rossko > 0) parts.push(`нов. ${rossko}`);
  if (used > 0) parts.push(`б/у ${used}`);
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
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [layout, setLayout] = useState(null);
  const [naturalSize, setNaturalSize] = useState({ width: 0, height: 0 });
  const gestureRef = useRef(null);

  const recompute = useCallback(() => {
    const img = imgRef.current;
    if (!img) return;
    const natW = img.naturalWidth;
    const natH = img.naturalHeight;
    if (!natW || !natH) return;
    // client* = CSS box of <img>; with object-contain object-top content sits at top.
    setNaturalSize({ width: natW, height: natH });
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

  const resetViewer = () => {
    setZoomed(false);
    setZoom(1);
    setPan({ x: 0, y: 0 });
    gestureRef.current = null;
  };

  const touchDistance = (touches) => Math.hypot(
    touches[0].clientX - touches[1].clientX,
    touches[0].clientY - touches[1].clientY
  );

  const handleTouchStart = (event) => {
    event.stopPropagation();
    if (event.touches.length === 2) {
      gestureRef.current = {
        type: 'pinch',
        distance: touchDistance(event.touches),
        zoom,
      };
      return;
    }
    if (event.touches.length === 1 && zoom > 1) {
      gestureRef.current = {
        type: 'pan',
        x: event.touches[0].clientX,
        y: event.touches[0].clientY,
        pan,
      };
    }
  };

  const handleTouchMove = (event) => {
    const gesture = gestureRef.current;
    if (!gesture) return;
    event.preventDefault();
    event.stopPropagation();
    if (gesture.type === 'pinch' && event.touches.length === 2) {
      const nextZoom = Math.min(4, Math.max(1, gesture.zoom * touchDistance(event.touches) / gesture.distance));
      setZoom(nextZoom);
      if (nextZoom === 1) setPan({ x: 0, y: 0 });
      return;
    }
    if (gesture.type === 'pan' && event.touches.length === 1) {
      setPan({
        x: gesture.pan.x + event.touches[0].clientX - gesture.x,
        y: gesture.pan.y + event.touches[0].clientY - gesture.y,
      });
    }
  };

  const handleTouchEnd = (event) => {
    event.stopPropagation();
    if (event.touches.length === 1 && zoom > 1) {
      gestureRef.current = {
        type: 'pan',
        x: event.touches[0].clientX,
        y: event.touches[0].clientY,
        pan,
      };
      return;
    }
    gestureRef.current = null;
  };

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

  const fullscreenAreas = useMemo(() => {
    const natW = naturalSize.width;
    const natH = naturalSize.height;
    if (!natW || !natH) return [];
    return (imageMap || []).map((area, idx) => {
      const x1 = toNum(area.x1);
      const y1 = toNum(area.y1);
      const x2 = toNum(area.x2);
      const y2 = toNum(area.y2);
      const code = normalizeCode(area.code_on_image);
      if (x1 == null || y1 == null || x2 == null || y2 == null || !code) return null;
      const centerX = (Math.min(x1, x2) + Math.abs(x2 - x1) / 2) / natW * 100;
      const centerY = (Math.min(y1, y2) + Math.abs(y2 - y1) / 2) / natH * 100;
      return {
        key: `fullscreen-${code}-${idx}`,
        code,
        style: { left: `calc(${centerX}% - 14px)`, top: `calc(${centerY}% - 14px)` },
      };
    }).filter(Boolean);
  }, [imageMap, naturalSize]);

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
          className="fixed inset-0 z-[80] bg-black/80"
          onClick={resetViewer}
          role="presentation"
        >
          <div
            className="h-full w-full touch-none overflow-hidden p-6 pt-16"
            data-testid="schema-touch-viewer"
            onTouchStart={handleTouchStart}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleTouchEnd}
            onTouchCancel={handleTouchEnd}
          >
            <div className="flex h-full w-full items-center justify-center">
              <div
                className="relative inline-flex max-h-full max-w-full"
                style={{ transform: `translate3d(${pan.x}px, ${pan.y}px, 0) scale(${zoom})` }}
                onClick={(e) => e.stopPropagation()}
              >
                <img
                  src={src}
                  alt={alt || ''}
                  className="block max-h-[calc(100dvh-7rem)] max-w-[calc(100vw-1rem)] select-none object-contain"
                  draggable={false}
                />
                {fullscreenAreas.map((area) => (
                  <button
                    key={area.key}
                    type="button"
                    aria-label={`Выбрать позицию ${area.code}`}
                    onClick={(e) => {
                      e.stopPropagation();
                      onSelectCode?.(area.code, { fullscreen: true });
                    }}
                    className="absolute z-20 flex h-7 w-7 items-center justify-center rounded-full border-2 border-indigo-600 bg-white/90 text-[10px] font-bold text-indigo-700 shadow-md md:hidden"
                    style={area.style}
                  >
                    {area.code}
                  </button>
                ))}
              </div>
            </div>
          </div>
          <div className="absolute left-1/2 top-3 flex -translate-x-1/2 items-center gap-1 rounded-lg bg-white/95 p-1 shadow">
            <button type="button" onClick={(e) => { e.stopPropagation(); setZoom((v) => { const next = Math.max(1, v - 0.5); if (next === 1) setPan({ x: 0, y: 0 }); return next; }); }} className="h-9 w-9 rounded-md text-lg text-gray-800 hover:bg-gray-100" aria-label="Уменьшить">−</button>
            <span className="min-w-14 text-center text-xs font-medium text-gray-600">{Math.round(zoom * 100)}%</span>
            <button type="button" onClick={(e) => { e.stopPropagation(); setZoom((v) => Math.min(4, v + 0.5)); }} className="h-9 w-9 rounded-md text-lg text-gray-800 hover:bg-gray-100" aria-label="Увеличить">+</button>
          </div>
          <button
            type="button"
            onClick={resetViewer}
            className="absolute right-4 top-3 rounded-lg bg-white/95 px-3 py-2 text-sm font-medium text-gray-800 shadow"
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
  schemas = [],
  onLoadSchemaImageMap,
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
  const [activeSchemaIndex, setActiveSchemaIndex] = useState(0);
  const [codeOptions, setCodeOptions] = useState(null);
  const rowRefs = useRef({});
  const requestedSchemaMaps = useRef(new Set());
  const listPanelRef = useRef(null);

  const allDetails = details || [];

  // Группа может содержать несколько узлов — показываем все их схемы.
  const schemaList = useMemo(() => {
    const list = (Array.isArray(schemas) ? schemas : []).filter((s) => s?.image_url);
    if (list.length) return list;
    if (imageUrl) return [{ image_url: imageUrl, name: title, imageMap }];
    return [];
  }, [schemas, imageUrl, imageMap, title]);

  const hasSchemas = schemaList.length > 0;
  const activeSchema = schemaList[Math.min(activeSchemaIndex, Math.max(schemaList.length - 1, 0))] || null;
  const detailsList = activeSchema?.details?.length ? activeSchema.details : allDetails;

  useEffect(() => {
    setActiveSchemaIndex(0);
    setCodeOptions(null);
    requestedSchemaMaps.current.clear();
  }, [title]);

  useEffect(() => {
    const key = activeSchema?.unit_id;
    if (!key || activeSchema.imageMapLoaded || requestedSchemaMaps.current.has(key)) return;
    requestedSchemaMaps.current.add(key);
    onLoadSchemaImageMap?.(activeSchema);
  }, [activeSchema, onLoadSchemaImageMap]);

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

  const selectDetail = useCallback((detail) => {
    setCodeOptions(null);
    if (detail?.filter && onDetailFilter) {
      onDetailFilter(detail);
      return;
    }
    if ((detail?.oem || '').trim()) onSelectDetail?.(detail);
  }, [onDetailFilter, onSelectDetail]);

  const onSelectCode = useCallback(
    (code, options = {}) => {
      const normalizedCode = normalizeCode(code);
      const rows = codeToRows.get(normalizedCode) || [];
      if (!rows.length) return;
      if (options.fullscreen) {
        setCodeOptions({ code: normalizedCode, rows });
        return;
      }
      if (rows[0]?.key) ensureRowVisible(rows[0].key);
      const first = rows.find((r) => (r.detail?.oem || '').trim())?.detail || rows[0]?.detail;
      selectDetail(first);
    },
    [codeToRows, ensureRowVisible, selectDetail]
  );

  return (
    <div className="space-y-2">
      <div className={`grid gap-3 items-start ${hasSchemas ? 'lg:grid-cols-[1.2fr_1fr]' : ''}`}>
        {hasSchemas ? (
          <div className="min-w-0 space-y-2">
            {schemaList.length > 1 ? (
              <div className="flex items-center justify-between gap-2">
                <button type="button" onClick={() => setActiveSchemaIndex((v) => (v - 1 + schemaList.length) % schemaList.length)} className="rounded-md border border-gray-200 px-2.5 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50">←</button>
                <span className="text-xs font-medium text-gray-600">Схема {activeSchemaIndex + 1} из {schemaList.length}</span>
                <button type="button" onClick={() => setActiveSchemaIndex((v) => (v + 1) % schemaList.length)} className="rounded-md border border-gray-200 px-2.5 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50">→</button>
              </div>
            ) : null}
            {activeSchema?.name ? (
              <p className="truncate text-xs font-medium text-gray-700" title={activeSchema.name}>{activeSchema.name}</p>
            ) : null}
            <SchemaImage
              src={activeSchema?.image_url}
              alt={activeSchema?.name || title}
              imageMap={activeSchema?.imageMap || []}
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
            {schemaList.length > 1 ? (
              <div className="flex gap-2 overflow-x-auto pb-1">
                {schemaList.map((schema, idx) => (
                  <button
                    key={`${schema.unit_id || 'schema'}-${idx}`}
                    type="button"
                    onClick={() => setActiveSchemaIndex(idx)}
                    className={`w-24 shrink-0 overflow-hidden rounded-md border bg-white text-left ${idx === activeSchemaIndex ? 'border-indigo-500 ring-1 ring-indigo-500' : 'border-gray-200 hover:border-indigo-300'}`}
                    title={schema.name || `Схема ${idx + 1}`}
                  >
                    <div className="flex h-16 items-center justify-center bg-gray-50 p-1">
                      <img src={schema.image_url} alt="" className="max-h-full max-w-full object-contain" loading="lazy" />
                    </div>
                    <span className="block truncate px-1.5 py-1 text-[10px] text-gray-600">{schema.name || `Схема ${idx + 1}`}</span>
                  </button>
                ))}
              </div>
            ) : null}
          </div>
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
            <>
              <div className="space-y-2 md:hidden">
                {detailsList.map((d, idx) => {
                  const code = normalizeCode(d.code_on_image);
                  const needsFilter = Boolean(d.filter);
                  return (
                    <button
                      key={detailRowKey(d, idx)}
                      type="button"
                      onClick={() => {
                        if (needsFilter && onDetailFilter) {
                          onDetailFilter(d);
                          return;
                        }
                        if ((d.oem || '').trim()) onSelectDetail(d);
                      }}
                      className="flex min-h-16 w-full items-center gap-3 rounded-xl border border-gray-200 bg-white p-3 text-left active:bg-indigo-50"
                    >
                      <span className="flex h-9 min-w-9 shrink-0 items-center justify-center rounded-lg bg-indigo-50 px-2 font-mono text-xs font-semibold text-indigo-700">
                        {code || '—'}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="line-clamp-2 block text-sm font-medium leading-snug text-gray-900">{d.name || 'Без названия'}</span>
                        <span className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5">
                          <span className="font-mono text-xs text-indigo-700">{d.oem || 'OEM не указан'}</span>
                          <AvailCell row={lookupAvail(availability, d.oem)} loading={availabilityLoading} />
                        </span>
                      </span>
                      <span className="shrink-0 text-gray-400">{needsFilter ? '?' : '›'}</span>
                    </button>
                  );
                })}
              </div>
              <table className="hidden min-w-full text-left text-sm md:table">
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
            </>
          )}
        </div>
      </div>

      {codeOptions ? (
        <div className="fixed inset-0 z-[90] md:hidden" role="dialog" aria-modal="true" aria-label={`Артикулы позиции ${codeOptions.code}`}>
          <button type="button" aria-label="Закрыть выбор артикула" onClick={() => setCodeOptions(null)} className="absolute inset-0 bg-black/35" />
          <div className="absolute inset-x-0 bottom-0 max-h-[65dvh] overflow-y-auto rounded-t-2xl bg-white px-3 pb-[max(1rem,env(safe-area-inset-bottom))] pt-3 shadow-2xl">
            <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-gray-300" />
            <div className="mb-3 flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-gray-900">Позиция № {codeOptions.code}</p>
                <p className="text-xs text-gray-500">Выберите артикул</p>
              </div>
              <button type="button" onClick={() => setCodeOptions(null)} className="min-h-10 rounded-lg px-3 text-sm font-medium text-indigo-600">Закрыть</button>
            </div>
            <div className="space-y-2">
              {codeOptions.rows.map(({ detail, key }) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => selectDetail(detail)}
                  className="flex min-h-16 w-full items-center justify-between gap-3 rounded-xl border border-gray-200 bg-white p-3 text-left active:bg-indigo-50"
                >
                  <span className="min-w-0 flex-1">
                    <span className="line-clamp-2 block text-sm font-medium text-gray-900">{detail.name || 'Без названия'}</span>
                    <span className="mt-1 block font-mono text-xs font-semibold text-indigo-700">{detail.oem || 'Требуется уточнение'}</span>
                  </span>
                  <span className="shrink-0 text-gray-400">›</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
