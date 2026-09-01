import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useSelector } from 'react-redux';
import { useShowSiteReviews } from '../../utils/siteReviewsPublic';
import { MOBILE_PULL_REFRESH_EVENT } from '../../utils/mobileRouteRefresh';
import { navigateToVinCatalog } from '../../utils/vinCatalogNavigation';
import { normalizeVinForSearchOrNull } from '../../utils/laximoVin';
import VinScanModal from '../../components/VinScanner/VinScanModal';
import VinScanTriggerButton from '../../components/VinScanner/VinScanTriggerButton';
import ReviewsSection from '../../components/Reviews/ReviewsSection';
import FeaturedLandingsSection from '../../components/Seo/FeaturedLandingsSection';
import HomeAmbientBackground from '../../components/Home/HomeAmbientBackground';
import SellerRegistrationForm from '../../components/SellerRegistration/SellerRegistrationForm';
import { buildHomeSeo, buildHomeStructuredData, PageSeoHelmet } from '../../utils/pageSeo';
import { Button } from '../../components/UI';
import { COPY } from '../../utils/brandCopy';

const softCardClass =
  'rounded-[1.75rem] border border-white/70 bg-white/85 shadow-[0_8px_32px_rgba(15,23,42,0.06)] backdrop-blur-sm sm:rounded-[2rem]';

const sellerBenefits = [
  'Публикация новых и б/у позиций в общем каталоге',
  'Складской учёт, приход и расход в одном кабинете',
  'Чаты с покупателями и управление заказами',
  'Скидка на закупку новых запчастей для пополнения склада',
];

const searchExamples = ['Тормозные колодки', 'Артикул детали', 'VIN автомобиля'];

const buyerSteps = [
  {
    title: 'Найдите деталь',
    text: 'По названию, бренду, артикулу или VIN автомобиля.',
  },
  {
    title: 'Сравните предложения',
    text: 'Цена, состояние, наличие и срок получения — в одном месте.',
  },
  {
    title: 'Оформите заказ',
    text: 'Корзина, чат с продавцом и доставка без лишних звонков.',
  },
];

function QuickLinkCard({ to, badge, badgeClass, title, description, accent }) {
  return (
    <Link
      to={to}
      className={`group flex min-h-[8.5rem] flex-col justify-between p-5 transition duration-200 hover:-translate-y-0.5 hover:shadow-[0_12px_40px_rgba(15,23,42,0.1)] sm:min-h-[9.5rem] sm:p-6 ${softCardClass} ${
        accent ? 'bg-gradient-to-br from-brand-600 to-brand-700 text-white border-transparent' : ''
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <span
          className={`rounded-full px-3 py-1 text-xs font-semibold ${
            accent ? 'bg-white/20 text-white' : badgeClass
          }`}
        >
          {badge}
        </span>
        <span
          className={`text-lg transition-transform group-hover:translate-x-0.5 ${
            accent ? 'text-white/90' : 'text-brand-600'
          }`}
        >
          →
        </span>
      </div>
      <div>
        <h2 className={`text-lg font-bold sm:text-xl ${accent ? 'text-white' : 'text-ink'}`}>{title}</h2>
        <p className={`mt-2 text-sm leading-relaxed ${accent ? 'text-brand-100' : 'text-ink-muted'}`}>
          {description}
        </p>
      </div>
    </Link>
  );
}

function Main() {
  const navigate = useNavigate();
  const showNewAutoparts = useSelector((state) => state.publicInfo.showNewAutoparts !== false);
  const showSiteReviews = useShowSiteReviews();
  const [query, setQuery] = useState('');
  const [busy, setBusy] = useState(false);
  const [vinScanOpen, setVinScanOpen] = useState(false);
  const [homeRefreshKey, setHomeRefreshKey] = useState(0);

  useEffect(() => {
    const onPullRefresh = (event) => {
      if (event.detail?.pathname === '/') {
        setHomeRefreshKey((key) => key + 1);
      }
    };
    window.addEventListener(MOBILE_PULL_REFRESH_EVENT, onPullRefresh);
    return () => window.removeEventListener(MOBILE_PULL_REFRESH_EVENT, onPullRefresh);
  }, []);

  const autopartsPath = showNewAutoparts ? '/autoparts/new' : '/autoparts/used';
  const seo = buildHomeSeo();
  const homeStructuredData = buildHomeStructuredData();

  const runSearch = (e) => {
    e?.preventDefault();
    const trimmed = query.trim();
    if (!trimmed || busy) return;
    setBusy(true);
    const vin = normalizeVinForSearchOrNull(trimmed);
    if (vin) {
      navigateToVinCatalog(navigate, vin);
      setBusy(false);
      return;
    }
    navigate(`/find?q=${encodeURIComponent(trimmed)}`);
    setBusy(false);
  };

  const handleVinScanConfirm = (vin) => {
    setVinScanOpen(false);
    setQuery(vin);
    navigateToVinCatalog(navigate, vin);
  };

  const scrollToSellerForm = (e) => {
    e?.preventDefault();
    document.getElementById('seller-registration')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  return (
    <div className="relative w-full overflow-hidden text-ink">
      <PageSeoHelmet seo={seo} />
      <script type="application/ld+json">{JSON.stringify(homeStructuredData)}</script>
      <HomeAmbientBackground />

      {/* Hero — визитка */}
      <section className="relative px-4 pb-10 pt-6 sm:px-6 sm:pb-14 sm:pt-10 lg:px-8 lg:pt-14">
        <div className="relative mx-auto max-w-sg-content">
          <div className={`relative overflow-hidden p-6 sm:p-10 lg:p-12 ${softCardClass}`}>
            <div
              className="pointer-events-none absolute -right-20 -top-20 h-56 w-56 rounded-full bg-[#fff4cc]/50 blur-2xl"
              aria-hidden
            />
            <div
              className="pointer-events-none absolute -bottom-16 -left-16 h-48 w-48 rounded-full bg-brand-100/40 blur-2xl"
              aria-hidden
            />

            <div className="relative max-w-3xl">
              <div className="inline-flex items-center gap-2 rounded-full bg-[#fff8e6] px-4 py-1.5 text-sm font-medium text-[#9a6700] ring-1 ring-[#ffe8a3]/80">
                <span className="h-2 w-2 rounded-full bg-[#ffcc00]" />
                Маркетплейс автозапчастей · Екатеринбург и вся Россия
              </div>
              <h1 className="mt-6 text-balance text-[1.75rem] font-bold leading-[1.15] tracking-tight text-ink sm:text-4xl lg:text-[2.75rem]">
                Свой Гараж — запчасти для вашего авто
              </h1>
              <p className="mt-4 max-w-2xl text-pretty text-base leading-relaxed text-ink-muted sm:text-lg">
                {COPY.trustLine}. Новые и б/у детали, подбор по VIN и честные отзывы покупателей.
              </p>
            </div>

            <form onSubmit={runSearch} className="relative mt-8 max-w-3xl">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                <div className="relative min-w-0 flex-1">
                  <span className="pointer-events-none absolute inset-y-0 left-0 flex w-12 items-center justify-center text-ink-faint">
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
                    id="main-search"
                    type="search"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder={COPY.searchPlaceholder}
                    disabled={busy}
                    className="h-14 w-full rounded-full border border-line/80 bg-[#f5f6f8] py-3 pl-12 pr-14 text-base text-ink shadow-inner placeholder:text-ink-faint transition focus:border-brand-400 focus:bg-white focus:outline-none focus:ring-4 focus:ring-brand-500/15 disabled:opacity-60"
                  />
                  <VinScanTriggerButton
                    onClick={() => setVinScanOpen(true)}
                    disabled={busy}
                    className="absolute right-2 top-1/2 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-white shadow-sm ring-1 ring-line/60 transition hover:bg-brand-50"
                  />
                </div>
                <Button
                  type="submit"
                  size="lg"
                  disabled={busy || !query.trim()}
                  loading={busy}
                  className="h-14 shrink-0 rounded-full px-8 shadow-[0_4px_14px_rgba(79,70,229,0.35)]"
                >
                  {COPY.searchCta}
                </Button>
              </div>
              <div className="mt-4 flex flex-wrap items-center gap-2">
                <span className="text-xs text-ink-muted">Попробуйте:</span>
                {searchExamples.map((example) => (
                  <button
                    key={example}
                    type="button"
                    onClick={() => setQuery(example)}
                    className="rounded-full bg-[#f0f1f5] px-3 py-1.5 text-xs font-medium text-ink-soft transition hover:bg-brand-50 hover:text-brand-700"
                  >
                    {example}
                  </button>
                ))}
              </div>
            </form>
          </div>

          <div
            className={`mt-5 grid gap-4 sm:grid-cols-2 ${showNewAutoparts ? 'lg:grid-cols-3' : 'lg:grid-cols-2'}`}
          >
            {showNewAutoparts ? (
              <QuickLinkCard
                to="/autoparts/new"
                badge="Новые"
                badgeClass="bg-brand-50 text-brand-700"
                title="Новые запчасти"
                description="Предложения поставщиков с ценами и сроками доставки."
                accent
              />
            ) : null}
            <QuickLinkCard
              to="/autoparts/used"
              badge="Б/у"
              badgeClass="bg-accent-50 text-accent-700"
              title="Б/у запчасти"
              description="Детали от магазинов и разборов с фото и описанием."
            />
            <QuickLinkCard
              to="/catalog"
              badge="Каталог"
              badgeClass="bg-surface-subtle text-ink-soft"
              title="Весь каталог"
              description="Поиск по VIN, категориям и артикулам в одном окне."
            />
          </div>
        </div>
      </section>

      {/* Как это работает */}
      <section className="relative px-4 py-10 sm:px-6 sm:py-14 lg:px-8">
        <div className="mx-auto max-w-sg-content">
          <div className="mb-8 text-center sm:mb-10">
            <p className="text-sm font-semibold text-brand-600">Просто и понятно</p>
            <h2 className="mt-2 text-2xl font-bold tracking-tight text-ink sm:text-3xl">
              Три шага до нужной детали
            </h2>
          </div>
          <div className="grid gap-4 md:grid-cols-3 md:gap-5">
            {buyerSteps.map((step, index) => (
              <div
                key={step.title}
                className={`flex flex-col p-6 sm:p-7 ${softCardClass}`}
              >
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-brand-50 to-[#eef2ff] text-sm font-bold text-brand-700">
                  {index + 1}
                </div>
                <p className="mt-4 text-xs font-bold uppercase tracking-wider text-brand-600">
                  Шаг {index + 1}
                </p>
                <h3 className="mt-2 text-lg font-bold text-ink">{step.title}</h3>
                <p className="mt-2 flex-1 text-sm leading-relaxed text-ink-muted">{step.text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <div className="relative">
        <FeaturedLandingsSection key={homeRefreshKey} />
      </div>

      {/* Покупателям и продавцам */}
      <section className="relative px-4 py-10 sm:px-6 sm:py-14 lg:px-8">
        <div className="mx-auto grid max-w-sg-content gap-5 lg:grid-cols-2">
          <div className={`flex flex-col p-6 sm:p-8 ${softCardClass}`}>
            <span className="inline-flex w-fit rounded-full bg-brand-50 px-3 py-1 text-xs font-semibold text-brand-700">
              Покупателям
            </span>
            <h2 className="mt-4 text-xl font-bold text-ink sm:text-2xl">Быстрый поиск и заказ</h2>
            <p className="mt-3 flex-1 text-sm leading-relaxed text-ink-muted sm:text-base">
              Избранное, история заказов и переписка с продавцами — после бесплатной регистрации.
            </p>
            <Button as={Link} to="/auth" variant="soft" className="mt-6 w-fit rounded-full px-6">
              Создать аккаунт
            </Button>
          </div>
          <div className={`flex flex-col p-6 sm:p-8 ${softCardClass}`}>
            <span className="inline-flex w-fit rounded-full bg-accent-50 px-3 py-1 text-xs font-semibold text-accent-700">
              Продавцам
            </span>
            <h2 className="mt-4 text-xl font-bold text-ink sm:text-2xl">Склад и продажи в одном кабинете</h2>
            <p className="mt-3 flex-1 text-sm leading-relaxed text-ink-muted sm:text-base">
              Публикуйте ассортимент, ведите остатки и отвечайте покупателям без таблиц и лишних мессенджеров.
            </p>
            <Button type="button" variant="accent" className="mt-6 w-fit rounded-full px-6" onClick={scrollToSellerForm}>
              Оставить заявку
            </Button>
          </div>
        </div>
      </section>

      {/* Регистрация продавца */}
      <section className="relative px-4 pb-10 sm:px-6 sm:pb-14 lg:px-8">
        <div className={`mx-auto max-w-sg-content p-6 sm:p-8 lg:p-10 ${softCardClass}`}>
          <div className="grid items-start gap-10 lg:grid-cols-12 lg:gap-12">
            <div className="lg:col-span-5">
              <p className="text-sm font-semibold text-brand-600">Для магазинов и сервисов</p>
              <h2 className="mt-2 text-2xl font-bold tracking-tight text-ink md:text-3xl">
                Подключиться как продавец
              </h2>
              <p className="mt-4 text-pretty leading-relaxed text-ink-muted">
                Оставьте заявку — после проверки пришлём доступ в кабинет на email.
              </p>
              <ul className="mt-6 space-y-3">
                {sellerBenefits.map((line) => (
                  <li key={line} className="flex gap-3 text-sm text-ink-soft">
                    <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#eef2ff] text-brand-600">
                      <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                      </svg>
                    </span>
                    <span>{line}</span>
                  </li>
                ))}
              </ul>
            </div>
            <div className="lg:col-span-7">
              <SellerRegistrationForm id="seller-registration" />
            </div>
          </div>
        </div>
      </section>

      {showSiteReviews ? (
        <div className="relative [&_section]:border-0 [&_section]:bg-transparent [&_section]:py-10">
          <ReviewsSection />
        </div>
      ) : null}

      {/* CTA */}
      <section className="relative px-4 pb-12 pt-4 sm:px-6 sm:pb-16 lg:px-8">
        <div className="mx-auto max-w-sg-content overflow-hidden rounded-[2rem] bg-gradient-to-br from-brand-600 via-brand-600 to-brand-800 p-8 text-center shadow-[0_16px_48px_rgba(79,70,229,0.25)] sm:p-12">
          <div
            className="pointer-events-none absolute -right-10 -top-10 h-40 w-40 rounded-full bg-white/10 blur-2xl"
            aria-hidden
          />
          <h2 className="relative text-2xl font-bold tracking-tight text-white sm:text-3xl">
            Готовы найти деталь?
          </h2>
          <p className="relative mx-auto mt-3 max-w-lg text-base text-brand-100">
            Откройте каталог или создайте аккаунт — магазинам доступна заявка на подключение выше.
          </p>
          <div className="relative mt-8 flex flex-col items-stretch justify-center gap-3 sm:flex-row sm:justify-center">
            <Button
              as={Link}
              to={autopartsPath}
              size="lg"
              className="rounded-full !bg-white !text-brand-700 shadow-md hover:!bg-brand-50"
            >
              {COPY.buyerCta}
            </Button>
            <Button
              as={Link}
              to="/auth"
              variant="secondary"
              size="lg"
              className="rounded-full !border-white/40 !bg-white/10 !text-white backdrop-blur-sm hover:!bg-white/20"
            >
              Регистрация
            </Button>
          </div>
        </div>
      </section>

      <VinScanModal
        open={vinScanOpen}
        onClose={() => setVinScanOpen(false)}
        onConfirm={handleVinScanConfirm}
      />
    </div>
  );
}

export default Main;
