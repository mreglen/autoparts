import { useEffect, useId, useMemo, useRef, useState } from 'react';

function PinIcon({ className = 'h-5 w-5' }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"
      />
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
    </svg>
  );
}

function CheckIcon({ className = 'h-4 w-4' }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5} aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
    </svg>
  );
}

function CloseIcon({ className = 'h-5 w-5' }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
    </svg>
  );
}

function SearchIcon({ className = 'h-4 w-4' }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
    </svg>
  );
}

function CitySkeletonList() {
  return (
    <ul className="space-y-2 p-2" aria-hidden>
      {Array.from({ length: 5 }).map((_, index) => (
        <li key={index} className="flex items-center gap-3 rounded-xl px-3 py-3">
          <div className="h-9 w-9 shrink-0 animate-pulse rounded-full bg-gray-100" />
          <div className="h-4 flex-1 animate-pulse rounded bg-gray-100" />
        </li>
      ))}
    </ul>
  );
}

function EmptyCitiesState() {
  return (
    <div className="flex flex-col items-center px-6 py-10 text-center">
      <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-indigo-50 text-indigo-500">
        <PinIcon className="h-8 w-8" />
      </div>
      <p className="text-base font-semibold text-gray-900">Упс, пока ещё нет товаров</p>
      <p className="mt-2 max-w-xs text-sm leading-relaxed text-gray-500">
        но скоро появятся. Загляните чуть позже — мы уже готовим ассортимент.
      </p>
    </div>
  );
}

/**
 * @param {{
 *   isOpen: boolean,
 *   onClose: () => void,
 *   selectedCity: string,
 *   cities: string[],
 *   citiesStatus: 'idle' | 'loading' | 'succeeded' | 'failed',
 *   citiesError?: string | null,
 *   onSelect: (city: string) => void,
 *   onRetry?: () => void,
 * }} props
 */
export default function CitySelectModal({
  isOpen,
  onClose,
  selectedCity,
  cities,
  citiesStatus,
  citiesError = null,
  onSelect,
  onRetry,
}) {
  const titleId = useId();
  const searchId = useId();
  const panelRef = useRef(null);
  const searchRef = useRef(null);
  const [query, setQuery] = useState('');

  const showSearch = cities.length >= 6;

  const filteredCities = useMemo(() => {
    const q = query.replace(/\s+/g, ' ').trim().toLowerCase();
    if (!q) return cities;
    return cities.filter((city) => city.toLowerCase().includes(q));
  }, [cities, query]);

  useEffect(() => {
    if (!isOpen) {
      setQuery('');
      return undefined;
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const onKeyDown = (event) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        onClose();
      }
    };
    window.addEventListener('keydown', onKeyDown);

    const focusTimer = window.setTimeout(() => {
      if (showSearch && searchRef.current) {
        searchRef.current.focus();
      } else if (panelRef.current) {
        panelRef.current.focus();
      }
    }, 30);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', onKeyDown);
      window.clearTimeout(focusTimer);
    };
  }, [isOpen, onClose, showSearch]);

  if (!isOpen) return null;

  const isLoading = citiesStatus === 'loading' || citiesStatus === 'idle';
  const isEmpty = citiesStatus === 'succeeded' && cities.length === 0;
  const isFailed = citiesStatus === 'failed';

  return (
    <div
      className="fixed inset-0 z-[120] flex items-end justify-center bg-black/40 p-0 backdrop-blur-sm sm:items-center sm:p-4"
      role="presentation"
      onClick={onClose}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        className="flex max-h-[min(88dvh,640px)] w-full max-w-md flex-col rounded-t-3xl bg-white shadow-2xl outline-none sm:rounded-2xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex justify-center pt-3 sm:hidden" aria-hidden>
          <div className="h-1.5 w-10 rounded-full bg-gray-200" />
        </div>

        <div className="flex items-start justify-between gap-3 border-b border-gray-100 px-5 pb-4 pt-3 sm:pt-5">
          <div className="min-w-0">
            <p className="text-xs font-medium uppercase tracking-wide text-indigo-500">Регион</p>
            <h2 id={titleId} className="mt-0.5 text-xl font-semibold text-gray-900">
              Ваш город
            </h2>
            <p className="mt-1 text-sm text-gray-500">Выберите город, чтобы видеть местные предложения</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-gray-400 transition hover:bg-gray-50 hover:text-gray-700"
            aria-label="Закрыть"
          >
            <CloseIcon />
          </button>
        </div>

        {showSearch && !isEmpty && !isFailed ? (
          <div className="border-b border-gray-100 px-5 py-3">
            <label htmlFor={searchId} className="sr-only">
              Поиск города
            </label>
            <div className="relative">
              <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-gray-400">
                <SearchIcon />
              </span>
              <input
                ref={searchRef}
                id={searchId}
                type="search"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Найти город"
                autoComplete="off"
                className="w-full rounded-xl border border-gray-200 bg-gray-50 py-2.5 pl-10 pr-3 text-sm text-gray-900 placeholder:text-gray-400 outline-none transition focus:border-indigo-400 focus:bg-white focus:ring-2 focus:ring-indigo-500/20"
              />
            </div>
          </div>
        ) : null}

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
          {isLoading ? <CitySkeletonList /> : null}

          {isFailed ? (
            <div className="flex flex-col items-center px-6 py-10 text-center">
              <p className="text-sm font-medium text-gray-900">Не удалось загрузить города</p>
              <p className="mt-1 text-sm text-gray-500">{citiesError || 'Проверьте соединение и попробуйте снова'}</p>
              {onRetry ? (
                <button
                  type="button"
                  onClick={onRetry}
                  className="mt-4 rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-indigo-700"
                >
                  Повторить
                </button>
              ) : null}
            </div>
          ) : null}

          {isEmpty ? <EmptyCitiesState /> : null}

          {!isLoading && !isFailed && !isEmpty ? (
            filteredCities.length === 0 ? (
              <div className="px-6 py-10 text-center">
                <p className="text-sm font-medium text-gray-900">Ничего не найдено</p>
                <p className="mt-1 text-sm text-gray-500">Попробуйте другой запрос</p>
              </div>
            ) : (
              <ul className="space-y-1 p-2 pb-4" role="listbox" aria-label="Список городов">
                {filteredCities.map((city) => {
                  const isSelected = city.toLowerCase() === String(selectedCity || '').toLowerCase();
                  return (
                    <li key={city} role="option" aria-selected={isSelected}>
                      <button
                        type="button"
                        onClick={() => onSelect(city)}
                        className={`flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left transition ${
                          isSelected
                            ? 'bg-indigo-50 text-indigo-900 ring-1 ring-indigo-200'
                            : 'text-gray-800 hover:bg-gray-50 active:bg-gray-100'
                        }`}
                      >
                        <span
                          className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${
                            isSelected ? 'bg-indigo-100 text-indigo-600' : 'bg-gray-100 text-gray-500'
                          }`}
                        >
                          <PinIcon className="h-4 w-4" />
                        </span>
                        <span className="min-w-0 flex-1 truncate text-sm font-medium sm:text-[15px]">
                          {city}
                        </span>
                        {isSelected ? (
                          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-indigo-600 text-white">
                            <CheckIcon className="h-3.5 w-3.5" />
                          </span>
                        ) : null}
                      </button>
                    </li>
                  );
                })}
              </ul>
            )
          ) : null}
        </div>
      </div>
    </div>
  );
}
