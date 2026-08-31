import React, { lazy, Suspense, useState } from 'react';

const PartDetailMap = lazy(() => import('./PartDetailMap'));

function parseCoord(value) {
  if (value == null || value === '') return null;
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : null;
}

export default function PartDetailLocationBlock({ storageLocation }) {
  const [mapOpen, setMapOpen] = useState(false);
  const [mapMounted, setMapMounted] = useState(false);

  if (!storageLocation?.address) return null;

  const latitude = parseCoord(storageLocation.latitude);
  const longitude = parseCoord(storageLocation.longitude);
  const hasCoords = latitude != null && longitude != null;

  const toggleMap = () => {
    setMapOpen((prev) => {
      const next = !prev;
      if (next) setMapMounted(true);
      return next;
    });
  };

  return (
    <section className="border-t border-line pt-6">
      <h2 className="text-base font-semibold text-ink">Расположение</h2>
      <div className="mt-3 flex items-start justify-between gap-3">
        <p className="min-w-0 flex-1 text-sm font-medium leading-snug text-ink">
          {storageLocation.address}
        </p>
        {hasCoords ? (
          <button
            type="button"
            onClick={toggleMap}
            className="shrink-0 text-sm font-medium text-brand-600 transition hover:text-brand-700"
          >
            {mapOpen ? 'Скрыть карту ▴' : 'Показать карту ▾'}
          </button>
        ) : null}
      </div>
      {mapOpen && mapMounted && hasCoords ? (
        <div className="mt-3 overflow-hidden rounded-sg-lg border border-line">
          <Suspense
            fallback={(
              <div className="flex h-[260px] items-center justify-center text-sm text-ink-muted">
                Загрузка карты…
              </div>
            )}
          >
            <PartDetailMap latitude={latitude} longitude={longitude} />
          </Suspense>
        </div>
      ) : null}
    </section>
  );
}
