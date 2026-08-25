import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { fetchSearchResults, setSearchQuery as setGlobalSearchQuery } from '../../redux/slices/RosskoSlice';
import { searchUsedParts } from '../../redux/slices/ProductSlice';
import { fetchPublicPartTypes } from '../../redux/slices/PartTypeSlice';
import { fetchPublicSiteConfig } from '../../redux/slices/PublicInfoSlice';
import { buildCatalogSeo, PageSeoHelmet } from '../../utils/pageSeo';
import { Badge, Button } from '../../components/UI';
import { COPY } from '../../utils/brandCopy';
import SoftServiceNotice from '../../components/SoftServiceNotice/SoftServiceNotice';
import VinScanModal from '../../components/VinScanner/VinScanModal';
import VinScanTriggerButton from '../../components/VinScanner/VinScanTriggerButton';
import { useAuthReady } from '../../hooks/useAuthReady';
import { apiRequest } from '../../utils/apiClient';
import {
  normalizeVinForLookupOrNull,
  normalizeVinForSearchOrNull,
  queryLooksLikeVin,
  sanitizeVinInput,
  VIN_INPUT_MAX_LENGTH,
} from '../../utils/laximoVin';

const pillInputClass =
  'block h-12 w-full rounded-full border border-transparent bg-surface-muted px-4 text-base text-ink shadow-none transition hover:bg-surface-subtle focus:border-brand-400 focus:bg-white focus:outline-none focus:ring-0 disabled:cursor-not-allowed disabled:opacity-60';

const sectionCardClass =
  'group flex h-full flex-col rounded-sg-lg border border-line bg-surface p-5 shadow-sg-sm transition hover:border-brand-200 hover:shadow-sg-md sm:p-6';

function vehicleChipLabel(vehicle) {
  const title = [vehicle?.make, vehicle?.model].filter(Boolean).join(' ').trim();
  if (title && vehicle?.year) return `${title}, ${vehicle.year}`;
  if (title) return title;
  if (vehicle?.vin) return `VIN …${String(vehicle.vin).slice(-6)}`;
  return 'Автомобиль';
}

function CatalogSectionCard({
  badge,
  badgeTone = 'brand',
  title,
  description,
  to,
  ctaLabel,
  secondaryTo,
  secondaryLabel,
}) {
  return (
    <div className={sectionCardClass}>
      <Badge tone={badgeTone}>{badge}</Badge>
      <h2 className="mt-3 text-sg-subtitle text-ink">{title}</h2>
      <p className="mt-2 flex-1 text-sm leading-relaxed text-ink-muted">{description}</p>
      <div className="mt-5 flex flex-col gap-2 sm:flex-row">
        <Button as={Link} to={to} className="flex-1" variant={badgeTone === 'accent' ? 'accent' : 'primary'}>
          {ctaLabel}
        </Button>
        {secondaryTo ? (
          <Button as={Link} to={secondaryTo} variant="secondary" className="flex-1">
            {secondaryLabel}
          </Button>
        ) : null}
      </div>
    </div>
  );
}

export default function CatalogPage() {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const { isAuthenticated } = useAuthReady();
  const showNewAutoparts = useSelector((state) => state.publicInfo.showNewAutoparts !== false);
  const laximoVinCatalogAvailable = useSelector(
    (state) => state.publicInfo.laximoVinCatalogAvailable === true,
  );
  const partTypes = useSelector((state) => state.partTypes.items || []);

  const [vinInput, setVinInput] = useState('');
  const [query, setQuery] = useState('');
  const [busy, setBusy] = useState(false);
  const [vinScanOpen, setVinScanOpen] = useState(false);
  const [garageVehicles, setGarageVehicles] = useState([]);

  const defaultSearchPath = showNewAutoparts ? '/autoparts/new' : '/autoparts/used';

  useEffect(() => {
    dispatch(fetchPublicPartTypes());
    dispatch(fetchPublicSiteConfig());
  }, [dispatch]);

  useEffect(() => {
    if (!isAuthenticated) {
      setGarageVehicles([]);
      return undefined;
    }
    let cancelled = false;
    (async () => {
      try {
        const data = await apiRequest('/autoservice/garage/vehicles');
        if (!cancelled) {
          setGarageVehicles(Array.isArray(data) ? data : []);
        }
      } catch {
        if (!cancelled) setGarageVehicles([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isAuthenticated]);

  const garageWithVin = useMemo(
    () => garageVehicles.filter((v) => normalizeVinForLookupOrNull(v?.vin)),
    [garageVehicles],
  );

  const openVinCatalog = useCallback(
    (rawVin) => {
      const vin = normalizeVinForLookupOrNull(rawVin);
      if (!vin) {
        return false;
      }
      navigate(`/autoparts/vin?vin=${encodeURIComponent(vin)}`);
      return true;
    },
    [navigate],
  );

  const submitVinHero = (e) => {
    e?.preventDefault();
    if (!openVinCatalog(vinInput)) {
      return;
    }
  };

  const runSearch = (e) => {
    e?.preventDefault();
    const trimmed = query.trim();
    if (!trimmed || busy) return;

    const vin = normalizeVinForSearchOrNull(trimmed);
    if (vin) {
      navigate(`/autoparts/vin?vin=${encodeURIComponent(vin)}`);
      return;
    }

    setBusy(true);
    dispatch(setGlobalSearchQuery(trimmed));
    Promise.all([
      dispatch(searchUsedParts(trimmed)),
      dispatch(fetchSearchResults({ text: trimmed })),
    ])
      .catch(() => {})
      .finally(() => {
        setBusy(false);
        navigate(`${defaultSearchPath}?q=${encodeURIComponent(trimmed)}`);
      });
  };

  const handleVinScanConfirm = useCallback(
    (nextVin) => {
      setVinScanOpen(false);
      setVinInput(nextVin);
      openVinCatalog(nextVin);
    },
    [openVinCatalog],
  );

  const sectionCards = useMemo(() => {
    const cards = [
      {
        id: 'vin',
        badge: 'По авто',
        badgeTone: 'brand',
        title: 'Каталог по VIN',
        description: 'Оригинальные номера по схемам узлов: двигатель, ходовая, кузов и наличие на сайте.',
        to: '/autoparts/vin',
        ctaLabel: 'Открыть',
        secondaryTo: '/autoparts/vin?wizard=1',
        secondaryLabel: 'Без VIN',
      },
    ];
    if (showNewAutoparts) {
      cards.push({
        id: 'new',
        badge: 'Поставщики',
        badgeTone: 'brand',
        title: COPY.catalogNew,
        description: 'Оригиналы и аналоги. Сроки, цены и наличие на складах.',
        to: '/autoparts/new',
        ctaLabel: 'Смотреть',
        secondaryTo: '/autoparts/new/filters',
        secondaryLabel: 'Фильтры',
      });
    }
    cards.push({
      id: 'used',
      badge: 'Продавцы',
      badgeTone: 'accent',
      title: COPY.catalogUsed,
      description: 'Разборки и магазины на платформе. Фото, описание и чат с продавцом.',
      to: '/autoparts/used',
      ctaLabel: 'Смотреть',
      secondaryTo: '/autoparts/used/filters',
      secondaryLabel: 'Фильтры',
    });
    return cards;
  }, [showNewAutoparts]);

  const sectionGridClass =
    sectionCards.length >= 3
      ? 'grid gap-4 md:grid-cols-3'
      : sectionCards.length === 2
        ? 'grid gap-4 md:grid-cols-2'
        : 'max-w-xl';

  const seo = buildCatalogSeo();
  const vinReady = normalizeVinForLookupOrNull(vinInput);

  return (
    <div className="mx-auto max-w-sg-content pb-12">
      <PageSeoHelmet seo={seo} />

      <header className="mb-8">
        <h1 className="text-sg-display text-ink">Каталог</h1>
        <p className="mt-2 max-w-sg-readable text-sg-body text-ink-muted">
          Подберите запчасти по автомобилю или найдите деталь по артикулу и названию — новые и б/у в одном месте.
        </p>
      </header>

      <section className="mb-8 rounded-sg-lg border border-line bg-surface p-4 shadow-sg-sm sm:p-6">
        <div className="mb-4">
          <h2 className="text-sg-subtitle text-ink">Подбор по автомобилю</h2>
          <p className="mt-1 text-sm text-ink-muted">
            VIN → узлы и оригинальные номера с наличием на «Свой Гараж».
          </p>
        </div>

        {!laximoVinCatalogAvailable ? (
          <div className="mb-4">
            <SoftServiceNotice variant="unavailable" />
          </div>
        ) : null}

        <form onSubmit={submitVinHero} className="space-y-3">
          <label htmlFor="catalog-vin" className="sr-only">
            VIN автомобиля
          </label>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <div className="relative min-w-0 flex-1">
              <input
                id="catalog-vin"
                type="text"
                inputMode="text"
                autoCapitalize="characters"
                autoComplete="off"
                value={vinInput}
                onChange={(e) => setVinInput(sanitizeVinInput(e.target.value))}
                maxLength={VIN_INPUT_MAX_LENGTH}
                placeholder="VIN автомобиля"
                className={`${pillInputClass} pr-12`}
              />
              <VinScanTriggerButton
                onClick={() => setVinScanOpen(true)}
                className="absolute inset-y-0 right-2 px-2"
              />
            </div>
            <Button
              type="submit"
              size="lg"
              className="shrink-0 sm:min-w-[10.5rem]"
              disabled={!vinReady}
            >
              Открыть каталог
            </Button>
          </div>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
            <button
              type="button"
              onClick={() => setVinScanOpen(true)}
              className="font-medium text-brand-600 hover:text-brand-700"
            >
              Распознать VIN с камеры
            </button>
            <Link
              to="/autoparts/vin?wizard=1"
              className="font-medium text-brand-600 hover:text-brand-700"
            >
              По марке и модели
            </Link>
          </div>
        </form>

        <VinScanModal
          open={vinScanOpen}
          onClose={() => setVinScanOpen(false)}
          onConfirm={handleVinScanConfirm}
        />
      </section>

      <section className="mb-10 rounded-sg-lg border border-line bg-surface-muted/80 p-4 sm:p-5">
        <h2 className="text-sg-subtitle text-ink">Поиск по артикулу или названию</h2>
        <p className="mt-1 mb-4 text-sm text-ink-muted">
          Если VIN не нужен — ищите среди новых и б/у запчастей на площадке.
        </p>
        <form onSubmit={runSearch}>
          <label htmlFor="catalog-search" className="sr-only">
            Поиск по каталогу
          </label>
          <div className="flex flex-col gap-3 sm:flex-row">
            <input
              id="catalog-search"
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Артикул, бренд, название или VIN"
              disabled={busy}
              className={pillInputClass}
            />
            <Button
              type="submit"
              size="lg"
              className="shrink-0 sm:min-w-[8.5rem]"
              disabled={busy || !query.trim()}
              loading={busy}
            >
              {COPY.searchCta}
            </Button>
          </div>
          {queryLooksLikeVin(query.trim()) ? (
            <p className="mt-2 text-xs text-ink-muted">
              Похоже на VIN — откроем каталог по автомобилю.
            </p>
          ) : null}
        </form>
      </section>

      <section className="mb-10">
        <h2 className="mb-4 text-sg-subtitle text-ink">Разделы</h2>
        <div className={sectionGridClass}>
          {sectionCards.map((card) => (
            <CatalogSectionCard key={card.id} {...card} />
          ))}
        </div>
      </section>

      {garageWithVin.length > 0 ? (
        <section className="mb-10">
          <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
            <div>
              <h2 className="text-sg-subtitle text-ink">Мои автомобили</h2>
              <p className="mt-1 text-sm text-ink-muted">Быстрый вход в каталог по сохранённому VIN</p>
            </div>
            <Link
              to="/garage"
              className="shrink-0 text-sm font-semibold text-brand-700 hover:text-brand-800"
            >
              Гараж
            </Link>
          </div>
          <div className="flex flex-wrap gap-2">
            {garageWithVin.map((vehicle) => {
              const vin = normalizeVinForLookupOrNull(vehicle.vin);
              return (
                <Link
                  key={vehicle.id}
                  to={`/autoparts/vin?vin=${encodeURIComponent(vin)}`}
                  className="rounded-full border border-line bg-surface px-4 py-2.5 text-sm font-medium text-ink-soft shadow-sg-sm transition hover:border-brand-200 hover:bg-brand-50 hover:text-brand-800"
                >
                  {vehicleChipLabel(vehicle)}
                </Link>
              );
            })}
          </div>
        </section>
      ) : null}

      {partTypes.length > 0 ? (
        <section className="mb-4">
          <div className="mb-4 flex items-end justify-between gap-4">
            <div>
              <h2 className="text-sg-subtitle text-ink">Популярные категории</h2>
              <p className="mt-1 text-sm text-ink-muted">Б/у запчасти по типу детали</p>
            </div>
            <Link
              to="/autoparts/used/filters"
              className="shrink-0 text-sm font-semibold text-brand-700 hover:text-brand-800"
            >
              Все фильтры
            </Link>
          </div>
          <div className="flex flex-wrap gap-2">
            {partTypes.slice(0, 12).map((pt) => (
              <Link
                key={pt.id}
                to={`/autoparts/used?part_type=${pt.id}`}
                className="rounded-full border border-line bg-surface px-4 py-2 text-sm font-medium text-ink-soft shadow-sg-sm transition hover:border-brand-200 hover:bg-brand-50 hover:text-brand-800"
              >
                {pt.name}
              </Link>
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
}
