import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { fetchSearchResults, setSearchQuery as setGlobalSearchQuery } from '../../redux/slices/RosskoSlice';
import { searchUsedParts } from '../../redux/slices/ProductSlice';
import { fetchPublicPartTypes } from '../../redux/slices/PartTypeSlice';
import { buildCatalogSeo, PageSeoHelmet } from '../../utils/pageSeo';
import { Badge, Button, Card, PageHeader } from '../../components/UI';
import { COPY } from '../../utils/brandCopy';

const catalogCards = [
  {
    id: 'new',
    title: COPY.catalogNew,
    description: 'Оригиналы и аналоги от поставщиков. Сроки, аналоги и наличие на складах.',
    to: '/autoparts/new',
    filtersTo: '/autoparts/new/filters',
    tone: 'brand',
    badge: 'Поставщики',
  },
  {
    id: 'used',
    title: COPY.catalogUsed,
    description: 'Разборки и магазины на платформе. Фото, описание и чат с продавцом.',
    to: '/autoparts/used',
    filtersTo: '/autoparts/used/filters',
    tone: 'accent',
    badge: 'Продавцы',
  },
];

function CatalogCard({ card }) {
  const isUsed = card.tone === 'accent';
  return (
    <Card className="flex h-full flex-col" hover>
      <Badge tone={isUsed ? 'accent' : 'brand'}>{card.badge}</Badge>
      <h2 className="mt-3 text-xl font-bold text-ink">{card.title}</h2>
      <p className="mt-2 flex-1 text-sm leading-relaxed text-ink-muted">{card.description}</p>
      <div className="mt-5 flex flex-col gap-2 sm:flex-row">
        <Button as={Link} to={card.to} className="flex-1" variant={isUsed ? 'accent' : 'primary'}>
          Смотреть
        </Button>
        <Button as={Link} to={card.filtersTo} variant="secondary" className="flex-1">
          Фильтры
        </Button>
      </div>
    </Card>
  );
}

export default function CatalogPage() {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const showNewAutoparts = useSelector((state) => state.publicInfo.showNewAutoparts !== false);
  const partTypes = useSelector((state) => state.partTypes.items || []);
  const [query, setQuery] = useState('');
  const [busy, setBusy] = useState(false);

  const defaultSearchPath = showNewAutoparts ? '/autoparts/new' : '/autoparts/used';

  useEffect(() => {
    dispatch(fetchPublicPartTypes());
  }, [dispatch]);

  const runSearch = (e) => {
    e?.preventDefault();
    const trimmed = query.trim();
    if (!trimmed || busy) return;
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

  const visibleCards = catalogCards.filter((c) => c.id !== 'new' || showNewAutoparts);
  const seo = buildCatalogSeo();

  return (
    <div className="pb-10">
      <PageSeoHelmet seo={seo} />
      <PageHeader
        title="Каталог запчастей"
        subtitle="Новые детали от поставщиков и б/у от продавцов «Свой Гараж»."
      />

      <Card className="mb-8" padding="sm">
        <form onSubmit={runSearch} className="p-2 sm:p-3">
          <label htmlFor="catalog-search" className="sr-only">Поиск по каталогу</label>
          <div className="flex flex-col gap-3 sm:flex-row">
            <input
              id="catalog-search"
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Артикул, бренд, название или VIN"
              disabled={busy}
              className="min-h-12 w-full flex-1 rounded-sg border border-line bg-surface-muted px-4 text-base text-ink focus:border-brand-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-brand-500/20 disabled:opacity-60"
            />
            <Button type="submit" size="lg" disabled={busy || !query.trim()} loading={busy}>
              {COPY.searchCta}
            </Button>
          </div>
        </form>
      </Card>

      <section className="mb-10">
        <h2 className="mb-4 text-lg font-semibold text-ink">Разделы</h2>
        <div className={`grid gap-4 ${visibleCards.length > 1 ? 'md:grid-cols-2' : 'max-w-xl'}`}>
          {visibleCards.map((card) => (
            <CatalogCard key={card.id} card={card} />
          ))}
        </div>
      </section>

      {partTypes.length > 0 && (
        <section className="mb-10">
          <div className="mb-4 flex items-end justify-between gap-4">
            <div>
              <h2 className="text-lg font-semibold text-ink">Популярные категории</h2>
              <p className="text-sm text-ink-muted">Б/у запчасти по типу детали</p>
            </div>
            <Link to="/autoparts/used/filters" className="shrink-0 text-sm font-semibold text-brand-700 hover:text-brand-800">
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
      )}
    </div>
  );
}
