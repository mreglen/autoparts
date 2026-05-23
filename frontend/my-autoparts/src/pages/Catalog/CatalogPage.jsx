import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { fetchSearchResults, setSearchQuery as setGlobalSearchQuery } from '../../redux/slices/RosskoSlice';
import { searchUsedParts } from '../../redux/slices/ProductSlice';
import { fetchPublicPartTypes } from '../../redux/slices/PartTypeSlice';

const catalogCards = [
  {
    id: 'new',
    title: 'Новые запчасти',
    description: 'Оригиналы и аналоги от поставщиков. Сроки поставки, аналоги и наличие на складах.',
    to: '/autoparts/new',
    filtersTo: '/autoparts/new/filters',
    tone: 'from-blue-600 to-indigo-600',
    ring: 'hover:ring-indigo-200',
    badge: 'Поставщики',
    icon: (
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={1.75}
        d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"
      />
    ),
  },
  {
    id: 'used',
    title: 'Б/У запчасти',
    description: 'Разборки и магазины на платформе. Фото, описание и чат с продавцом перед покупкой.',
    to: '/autoparts/used',
    filtersTo: '/autoparts/used/filters',
    tone: 'from-amber-500 to-orange-600',
    ring: 'hover:ring-amber-200',
    badge: 'Продавцы',
    icon: (
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={1.75}
        d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
      />
    ),
  },
];

const steps = [
  {
    n: '1',
    title: 'Выберите раздел',
    text: 'Новые — с доставкой от поставщика, б/У — от проверенных продавцов на сайте.',
  },
  {
    n: '2',
    title: 'Найдите деталь',
    text: 'Поиск по артикулу, названию или фильтрам: марка, категория, цена.',
  },
  {
    n: '3',
    title: 'Оформите заказ',
    text: 'Добавьте в корзину по организации продавца и оформите доставку в пару шагов.',
  },
];

function CatalogCard({ card, show }) {
  if (!show && card.id === 'new') return null;

  return (
    <article
      className={`group relative flex flex-col overflow-hidden rounded-2xl border border-gray-200 bg-white p-6 shadow-sm ring-1 ring-gray-100 transition hover:-translate-y-0.5 hover:shadow-lg ${card.ring}`}
    >
      <div
        className={`mb-4 inline-flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br ${card.tone} text-white shadow-md`}
      >
        <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
          {card.icon}
        </svg>
      </div>
      <span className="mb-2 inline-flex w-fit rounded-md bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-600">
        {card.badge}
      </span>
      <h2 className="text-xl font-bold text-gray-900">{card.title}</h2>
      <p className="mt-2 flex-1 text-sm leading-relaxed text-gray-600">{card.description}</p>
      <div className="mt-5 flex flex-col gap-2 sm:flex-row">
        <Link
          to={card.to}
          className="inline-flex min-h-11 flex-1 items-center justify-center rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-indigo-700"
        >
          Смотреть каталог
        </Link>
        <Link
          to={card.filtersTo}
          className="inline-flex min-h-11 flex-1 items-center justify-center rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm font-medium text-gray-800 transition hover:bg-gray-50"
        >
          Фильтры
        </Link>
      </div>
    </article>
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

  return (
    <div className="pb-10">
      <div className="mb-8">
        <p className="text-sm font-medium text-indigo-600">Каталог</p>
        <h1 className="mt-1 text-2xl font-bold text-gray-900 sm:text-3xl">Все запчасти в одном месте</h1>
        <p className="mt-2 max-w-2xl text-sm text-gray-600 sm:text-base">
          Единая точка входа: новые детали от поставщиков и б/у от продавцов «Свой Гараж». Поиск сразу по обоим
          разделам.
        </p>
      </div>

      <section className="mb-10 rounded-2xl border border-gray-200 bg-white p-4 shadow-sm sm:p-6">
        <form onSubmit={runSearch}>
          <label htmlFor="catalog-search" className="sr-only">
            Поиск по каталогу
          </label>
          <div className="flex flex-col gap-3 sm:flex-row">
            <div className="relative min-w-0 flex-1">
              <span className="pointer-events-none absolute inset-y-0 left-0 flex w-11 items-center justify-center text-gray-400">
                <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                  />
                </svg>
              </span>
              <input
                id="catalog-search"
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Артикул, бренд, название или VIN"
                disabled={busy}
                className="min-h-12 w-full rounded-xl border border-gray-200 bg-gray-50 py-3 pl-11 pr-4 text-base text-gray-900 outline-none transition focus:border-indigo-500 focus:bg-white focus:ring-2 focus:ring-indigo-500/20 disabled:opacity-60"
              />
            </div>
            <button
              type="submit"
              disabled={busy || !query.trim()}
              className="inline-flex min-h-12 shrink-0 items-center justify-center rounded-xl bg-indigo-600 px-8 text-base font-semibold text-white transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {busy ? 'Поиск…' : 'Найти'}
            </button>
          </div>
          <p className="mt-2 text-xs text-gray-500">
            Результаты откроются в разделе автозапчастей{showNewAutoparts ? ' (новые и б/у)' : ' (б/у)'}.
          </p>
        </form>
      </section>

      <section className="mb-10">
        <h2 className="mb-4 text-lg font-semibold text-gray-900">Разделы каталога</h2>
        <div
          className={`grid gap-6 ${visibleCards.length > 1 ? 'md:grid-cols-2' : 'max-w-xl'}`}
        >
          {visibleCards.map((card) => (
            <CatalogCard key={card.id} card={card} show={showNewAutoparts} />
          ))}
        </div>
      </section>

      {partTypes.length > 0 && (
        <section className="mb-10">
          <div className="mb-4 flex items-end justify-between gap-4">
            <div>
              <h2 className="text-lg font-semibold text-gray-900">Популярные категории</h2>
              <p className="text-sm text-gray-500">Б/У запчасти по типу детали</p>
            </div>
            <Link
              to="/autoparts/used/filters"
              className="shrink-0 text-sm font-medium text-indigo-600 hover:text-indigo-800"
            >
              Все фильтры
            </Link>
          </div>
          <div className="flex flex-wrap gap-2">
            {partTypes.slice(0, 12).map((pt) => (
              <Link
                key={pt.id}
                to={`/autoparts/used?part_type=${pt.id}`}
                className="rounded-full border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm transition hover:border-indigo-200 hover:bg-indigo-50 hover:text-indigo-800"
              >
                {pt.name}
              </Link>
            ))}
          </div>
        </section>
      )}

      <section className="mb-10 grid gap-4 sm:grid-cols-3">
        <Link
          to="/autoparts/used/filters"
          className="flex items-center gap-3 rounded-xl border border-gray-200 bg-white p-4 shadow-sm transition hover:border-indigo-200 hover:shadow-md"
        >
          <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600">
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" />
            </svg>
          </span>
          <div>
            <p className="font-semibold text-gray-900">Расширенный поиск</p>
            <p className="text-xs text-gray-500">Марка, цена, категория</p>
          </div>
        </Link>
        <Link
          to="/cart"
          className="flex items-center gap-3 rounded-xl border border-gray-200 bg-white p-4 shadow-sm transition hover:border-indigo-200 hover:shadow-md"
        >
          <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600">
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" />
            </svg>
          </span>
          <div>
            <p className="font-semibold text-gray-900">Корзина</p>
            <p className="text-xs text-gray-500">Заказы по организациям</p>
          </div>
        </Link>
        <Link
          to="/about"
          className="flex items-center gap-3 rounded-xl border border-gray-200 bg-white p-4 shadow-sm transition hover:border-indigo-200 hover:shadow-md"
        >
          <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600">
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </span>
          <div>
            <p className="font-semibold text-gray-900">О платформе</p>
            <p className="text-xs text-gray-500">Как покупать и продавать</p>
          </div>
        </Link>
      </section>

      <section className="rounded-2xl border border-indigo-100 bg-gradient-to-br from-indigo-50/80 to-white p-6 sm:p-8">
        <h2 className="text-lg font-semibold text-gray-900">Как пользоваться каталогом</h2>
        <ol className="mt-6 grid gap-6 sm:grid-cols-3">
          {steps.map((step) => (
            <li key={step.n} className="flex gap-4">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-indigo-600 text-sm font-bold text-white">
                {step.n}
              </span>
              <div>
                <p className="font-semibold text-gray-900">{step.title}</p>
                <p className="mt-1 text-sm text-gray-600">{step.text}</p>
              </div>
            </li>
          ))}
        </ol>
      </section>
    </div>
  );
}
