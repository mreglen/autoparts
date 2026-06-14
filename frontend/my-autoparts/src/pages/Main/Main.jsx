import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useSelector } from 'react-redux';
import { useShowSiteReviews } from '../../utils/siteReviewsPublic';
import ReviewsSection from '../../components/Reviews/ReviewsSection';
import FeaturedLandingsSection from '../../components/Seo/FeaturedLandingsSection';
import PageAmbientBackground from '../../components/PageAmbientBackground/PageAmbientBackground';
import YandexWebmasterCounter from '../../components/Seo/YandexWebmasterCounter';
import { buildHomeSeo, buildHomeStructuredData, PageSeoHelmet } from '../../utils/pageSeo';

const featureItems = [
  {
    title: 'Умный поиск',
    text: 'По артикулу, бренду, названию и кроссам поставщиков.',
    icon: (
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
    ),
    tone: 'from-blue-500 to-indigo-600',
  },
  {
    title: 'Чаты с продавцом',
    text: 'Уточняйте детали и договаривайтесь без лишних звонков.',
    icon: (
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
    ),
    tone: 'from-indigo-500 to-violet-600',
  },
  {
    title: 'Склад и продажи',
    text: 'Учёт, заказы и инструменты для магазинов в одном кабинете.',
    icon: (
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
    ),
    tone: 'from-sky-500 to-blue-600',
  },
];

function Main() {
  const navigate = useNavigate();
  const showNewAutoparts = useSelector((state) => state.publicInfo.showNewAutoparts !== false);
  const showSiteReviews = useShowSiteReviews();
  const quickLinks = useSelector((state) => state.publicInfo.quickLinks) || [];
  const [query, setQuery] = useState('');
  const [busy, setBusy] = useState(false);

  const autopartsPath = showNewAutoparts ? '/autoparts/new' : '/autoparts/used';
  const seo = buildHomeSeo();
  const homeStructuredData = buildHomeStructuredData();

  const runSearch = (e) => {
    e?.preventDefault();
    const trimmed = query.trim();
    if (!trimmed || busy) return;
    setBusy(true);
    navigate(`/find?q=${encodeURIComponent(trimmed)}`);
    setBusy(false);
  };

  return (
    <div className="relative w-full text-gray-900">
      <PageSeoHelmet seo={seo} />
      <script type="application/ld+json">{JSON.stringify(homeStructuredData)}</script>
      <PageAmbientBackground />

      {/* Герой */}
      <section className="relative overflow-hidden pt-14 pb-20 sm:pt-16 sm:pb-24 md:pt-20 md:pb-28">
        <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 items-center gap-12 lg:grid-cols-12 lg:gap-10 xl:gap-14">
            <div className="space-y-10 lg:col-span-6 xl:col-span-6">
              <div className="space-y-6">
                <div className="inline-flex items-center gap-2 rounded-full border border-blue-100/80 bg-white/90 px-4 py-2 text-sm font-medium text-blue-800 shadow-sm shadow-blue-500/5 backdrop-blur-sm">
                  <span className="relative flex h-2 w-2">
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-blue-400 opacity-60" />
                    <span className="relative inline-flex h-2 w-2 rounded-full bg-blue-500" />
                  </span>
                  Добро пожаловать в «Свой Гараж»
                </div>
                <h1 className="text-balance text-4xl font-extrabold leading-[1.12] tracking-tight text-gray-900 sm:text-5xl lg:text-[3.25rem] lg:leading-[1.08] xl:text-6xl">
                  Найдите любую
                  <span className="mt-1 block bg-gradient-to-r from-blue-600 via-indigo-600 to-violet-600 bg-clip-text text-transparent sm:mt-0 sm:inline sm:pl-2">
                    автозапчасть
                  </span>
                </h1>
                <p className="max-w-xl text-pretty text-lg leading-relaxed text-gray-600 sm:text-xl">
                  Новые и б/у детали, честные цены и прозрачные продавцы. Каталог, переписка и складской учёт — в одной
                  экосистеме для покупателей и магазинов.
                </p>
              </div>

              <div className="max-w-xl rounded-2xl border border-white/60 bg-white/80 p-1 shadow-xl shadow-indigo-950/10 ring-1 ring-gray-200/60 backdrop-blur-md">
                <form onSubmit={runSearch} className="rounded-[0.9rem] bg-white/95 p-4 sm:p-5">
                  <label htmlFor="main-search" className="sr-only">
                    Поиск запчастей
                  </label>
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-stretch">
                    <div className="relative min-w-0 flex-1">
                      <span className="pointer-events-none absolute inset-y-0 left-0 flex w-11 items-center justify-center text-gray-400">
                        <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                        </svg>
                      </span>
                      <input
                        id="main-search"
                        type="search"
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        placeholder="Артикул, бренд, название или VIN"
                        disabled={busy}
                        className="min-h-[3rem] w-full rounded-xl border border-gray-200 bg-gray-50/80 py-2.5 pl-11 pr-4 text-base text-gray-900 shadow-inner placeholder:text-gray-400 transition focus:border-indigo-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/25 disabled:opacity-60"
                      />
                    </div>
                    <button
                      type="submit"
                      disabled={busy || !query.trim()}
                      className="inline-flex min-h-[3rem] shrink-0 items-center justify-center rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 px-7 text-base font-semibold text-white shadow-lg shadow-indigo-600/25 transition hover:from-blue-700 hover:to-indigo-700 hover:shadow-indigo-600/35 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-45 disabled:shadow-none disabled:active:scale-100"
                    >
                      {busy ? (
                        <span className="flex items-center gap-2">
                          <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />
                          Поиск…
                        </span>
                      ) : (
                        'Найти'
                      )}
                    </button>
                  </div>
                  <p className="mt-3 text-xs leading-relaxed text-gray-500 sm:text-sm">
                    Поиск по артикулу, бренду или названию. При точном совпадении откроется карточка товара.
                  </p>
                </form>
              </div>

            {quickLinks.length > 0 ? (
              <div className="space-y-3">
                <h2 className="text-lg font-semibold text-gray-900">Популярные разделы</h2>
                <div className="flex flex-wrap gap-2">
                  {quickLinks.map((link) => (
                    <Link
                      key={link.id}
                      to={link.url}
                      className="inline-flex items-center rounded-xl border border-indigo-100 bg-white px-4 py-2.5 text-sm font-medium text-indigo-700 shadow-sm transition hover:border-indigo-200 hover:bg-indigo-50"
                    >
                      {link.title}
                    </Link>
                  ))}
                </div>
              </div>
            ) : null}

            <div className="flex flex-wrap gap-2">
                <span className="rounded-full bg-white/90 px-3 py-1 text-xs font-medium text-gray-700 ring-1 ring-gray-200/80 shadow-sm">
                  Новые и б/у
                </span>
                <span className="rounded-full bg-white/90 px-3 py-1 text-xs font-medium text-gray-700 ring-1 ring-gray-200/80 shadow-sm">
                  Чаты на платформе
                </span>
                <Link
                  to="/delivery"
                  className="rounded-full bg-white/90 px-3 py-1 text-xs font-medium text-indigo-700 ring-1 ring-indigo-200/80 shadow-sm transition hover:bg-indigo-50 hover:text-indigo-900"
                >
                  Доставка
                </Link>
                {showSiteReviews && (
                <Link
                  to="/reviews"
                  className="rounded-full bg-white/90 px-3 py-1 text-xs font-medium text-indigo-700 ring-1 ring-indigo-200/80 shadow-sm transition hover:bg-indigo-50 hover:text-indigo-900"
                >
                  Отзывы
                </Link>
                )}
                <span className="rounded-full bg-white/90 px-3 py-1 text-xs font-medium text-gray-700 ring-1 ring-gray-200/80 shadow-sm">
                  Для бизнеса
                </span>
              </div>

              <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
                <Link
                  to={autopartsPath}
                  className="inline-flex min-h-12 items-center justify-center rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 px-8 py-3 text-center text-base font-semibold text-white shadow-lg shadow-indigo-600/25 transition hover:from-blue-700 hover:to-indigo-700 hover:shadow-xl"
                >
                  Открыть каталог
                </Link>
                <Link
                  to="/delivery"
                  className="inline-flex min-h-12 items-center justify-center rounded-xl border border-indigo-200 bg-white px-8 py-3 text-center text-base font-semibold text-indigo-700 shadow-sm transition hover:border-indigo-300 hover:bg-indigo-50 hover:shadow-md"
                >
                  Условия доставки
                </Link>
                <Link
                  to="/auth"
                  className="inline-flex min-h-12 items-center justify-center rounded-xl border border-gray-300/90 bg-white px-8 py-3 text-center text-base font-semibold text-gray-800 shadow-sm transition hover:border-indigo-300 hover:bg-indigo-50/60 hover:text-indigo-900 hover:shadow-md"
                >
                  Войти или зарегистрироваться
                </Link>
              </div>
            </div>

            <div className="relative lg:col-span-6">
              <div className="pointer-events-none absolute -right-6 top-0 h-64 w-64 rounded-full bg-gradient-to-br from-blue-400/30 to-indigo-500/20 blur-2xl sm:h-80 sm:w-80 lg:right-0" />
              <div className="pointer-events-none absolute bottom-4 left-0 h-48 w-48 rounded-full bg-gradient-to-tr from-violet-400/25 to-transparent blur-2xl lg:-left-4" />
              <div className="relative mx-auto max-w-md lg:max-w-none">
                <div className="absolute -inset-1 rounded-[1.35rem] bg-gradient-to-br from-blue-500 via-indigo-500 to-violet-600 opacity-[0.22] blur-sm" />
                <div className="relative rotate-[0.5deg] rounded-2xl border border-white/70 bg-white p-4 shadow-2xl shadow-indigo-950/15 ring-1 ring-gray-200/50 sm:p-6 lg:rotate-1">
                  <div className="overflow-hidden rounded-xl bg-gradient-to-br from-indigo-50/95 via-white to-blue-50/90 ring-1 ring-indigo-100/70">
                    <div className="flex min-h-[min(48vh,13rem)] flex-col items-center justify-center gap-5 px-6 py-12 sm:min-h-[15rem] sm:py-14">
                      <div className="flex h-28 w-28 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-600 to-indigo-600 shadow-lg shadow-indigo-600/35 sm:h-32 sm:w-32">
                        <svg className="h-14 w-14 text-white sm:h-16 sm:w-16" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                        </svg>
                      </div>
                      <p className="max-w-xs text-center text-sm font-medium leading-snug text-gray-600">
                        Поиск по каталогу новых и б/у запчастей
                      </p>
                    </div>
                  </div>
                  <div className="mt-4 flex items-center justify-between gap-3 rounded-xl bg-gradient-to-r from-slate-50 to-indigo-50/40 px-4 py-3 ring-1 ring-indigo-100/60">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-gray-900">Каталог в один клик</p>
                      <p className="truncate text-xs text-gray-500">Новые и б/у — с телефона и с компьютера</p>
                    </div>
                    <Link
                      to={autopartsPath}
                      className="shrink-0 rounded-lg bg-white px-3 py-2 text-xs font-semibold text-indigo-700 shadow ring-1 ring-indigo-100 transition hover:bg-indigo-50"
                    >
                      Смотреть
                    </Link>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Преимущества */}
      <section className="relative border-y border-gray-200/80 bg-white/90 py-14 shadow-[0_-12px_40px_-24px_rgba(30,27,75,0.12)] backdrop-blur-sm md:py-20">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="text-2xl font-bold tracking-tight text-gray-900 md:text-3xl">Почему удобно на «Свой Гараж»</h2>
            <p className="mt-3 text-pretty text-gray-600 md:text-lg">
              Всё, что нужно для поиска запчастей и работы магазина — без лишних вкладок и сервисов.
            </p>
          </div>
          <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-3 lg:gap-8">
            {featureItems.map((item) => (
              <div
                key={item.title}
                className="group relative overflow-hidden rounded-2xl border border-gray-100 bg-gradient-to-b from-white to-gray-50/90 p-6 shadow-md shadow-gray-900/5 transition duration-300 hover:-translate-y-0.5 hover:border-indigo-100 hover:shadow-lg hover:shadow-indigo-900/10"
              >
                <div
                  className={`mb-4 inline-flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br ${item.tone} text-white shadow-md`}
                >
                  <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
                    {item.icon}
                  </svg>
                </div>
                <h3 className="text-lg font-semibold text-gray-900">{item.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-gray-600">{item.text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Платформа */}
      <section className="py-16 md:py-20">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="text-2xl font-bold tracking-tight text-gray-900 md:text-3xl">Платформа продажи и учёта</h2>
            <p className="mt-3 text-pretty text-lg text-gray-600">
              Покупайте запчасти и ведите складской учёт в одном месте — с чатами и ролями для команды.
            </p>
          </div>
          <div className="mt-12 grid gap-8 md:grid-cols-2 md:gap-10">
            <div className="relative overflow-hidden rounded-2xl border border-gray-200/90 bg-white p-8 shadow-xl shadow-gray-900/5 ring-1 ring-gray-100 transition hover:ring-indigo-200/80">
              <div className="absolute -right-16 -top-16 h-40 w-40 rounded-full bg-indigo-500/10 blur-2xl" />
              <div className="relative">
                <div className="inline-flex items-center gap-2 rounded-full bg-indigo-50 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-indigo-800">
                  Покупатель
                </div>
                <h3 className="mt-4 text-xl font-bold text-gray-900">Каталог и заказы</h3>
                <p className="mt-3 leading-relaxed text-gray-600">
                  После регистрации доступны новые и б/у позиции, фильтры и карточки товара. Уточнить детали можно в чате
                  с продавцом прямо на платформе.
                </p>
              </div>
            </div>
            <div className="relative overflow-hidden rounded-2xl border border-gray-200/90 bg-white p-8 shadow-xl shadow-gray-900/5 ring-1 ring-gray-100 transition hover:ring-blue-200/80">
              <div className="absolute -right-16 -top-16 h-40 w-40 rounded-full bg-blue-500/10 blur-2xl" />
              <div className="relative">
                <div className="inline-flex items-center gap-2 rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-blue-800">
                  Продавец
                </div>
                <h3 className="mt-4 text-xl font-bold text-gray-900">Склад и выгода</h3>
                <p className="mt-3 leading-relaxed text-gray-600">
                  Продавайте свои позиции, ведите остатки и операции. Для продавцов действует{' '}
                  <span className="font-semibold text-gray-900">скидка на покупку новых запчастей</span> — удобно
                  пополнять склад через ту же экосистему.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <FeaturedLandingsSection />

      {showSiteReviews && <ReviewsSection />}

      {/* CTA */}
      <section className="relative overflow-hidden bg-gradient-to-br from-blue-600 via-indigo-600 to-violet-700 py-16 md:py-20">
        <div className="pointer-events-none absolute inset-0 opacity-40">
          <div className="absolute left-0 top-0 h-72 w-72 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white blur-3xl" />
          <div className="absolute bottom-0 right-0 h-96 w-96 translate-x-1/3 translate-y-1/3 rounded-full bg-indigo-400 blur-3xl" />
        </div>
        <div className="relative mx-auto max-w-3xl px-4 text-center sm:px-6">
          <h2 className="text-2xl font-bold tracking-tight text-white drop-shadow-sm md:text-3xl">
            Готовы найти нужную деталь?
          </h2>
          <p className="mt-4 text-pretty text-lg text-indigo-100 md:text-xl">
            Начните с поиска или каталога. Тип аккаунта можно выбрать при регистрации.
          </p>
          <div className="mt-10 flex flex-col items-stretch justify-center gap-3 sm:flex-row sm:justify-center">
            <Link
              to={autopartsPath}
              className="inline-flex min-h-12 items-center justify-center rounded-xl bg-white px-8 py-3 text-center text-base font-semibold text-indigo-700 shadow-lg shadow-indigo-950/20 transition hover:bg-indigo-50 hover:shadow-xl"
            >
              Перейти в каталог
            </Link>
            <Link
              to="/auth"
              className="inline-flex min-h-12 items-center justify-center rounded-xl border-2 border-white/80 bg-white/10 px-8 py-3 text-center text-base font-semibold text-white backdrop-blur-sm transition hover:bg-white/20"
            >
              Зарегистрироваться
            </Link>
          </div>
        </div>
      </section>

      <YandexWebmasterCounter />
    </div>
  );
}

export default Main;
