import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useSelector } from 'react-redux';
import { useShowSiteReviews } from '../../utils/siteReviewsPublic';
import ReviewsSection from '../../components/Reviews/ReviewsSection';
import FeaturedLandingsSection from '../../components/Seo/FeaturedLandingsSection';
import YandexWebmasterCounter from '../../components/Seo/YandexWebmasterCounter';
import SellerRegistrationForm from '../../components/SellerRegistration/SellerRegistrationForm';
import { buildHomeSeo, buildHomeStructuredData, PageSeoHelmet } from '../../utils/pageSeo';
import { Button, Card, SectionHeader } from '../../components/UI';
import { COPY } from '../../utils/brandCopy';

const sellerBenefits = [
  'Публикация новых и б/у позиций в общем каталоге',
  'Складской учёт, приход и расход в одном кабинете',
  'Чаты с покупателями и управление заказами',
  'Скидка на закупку новых запчастей для пополнения склада',
];

const searchExamples = ['Тормозные колодки', 'Артикул детали', 'VIN автомобиля'];

const buyerSteps = [
  {
    number: '01',
    title: 'Найдите деталь',
    text: 'Ищите по названию, бренду, артикулу или VIN автомобиля.',
  },
  {
    number: '02',
    title: 'Сравните предложения',
    text: 'Проверьте цену, состояние, наличие и срок получения.',
  },
  {
    number: '03',
    title: 'Оформите заказ',
    text: 'Добавьте товар в корзину или задайте вопрос продавцу.',
  },
];

function Main() {
  const navigate = useNavigate();
  const showNewAutoparts = useSelector((state) => state.publicInfo.showNewAutoparts !== false);
  const showSiteReviews = useShowSiteReviews();
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

  const scrollToSellerForm = (e) => {
    e?.preventDefault();
    document.getElementById('seller-registration')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  return (
    <div className="relative w-full bg-surface-muted text-ink">
      <PageSeoHelmet seo={seo} />
      <script type="application/ld+json">{JSON.stringify(homeStructuredData)}</script>

      <section className="relative pb-12 pt-8 sm:pb-16 sm:pt-12 lg:pb-20 lg:pt-16">
        <div className="relative mx-auto max-w-sg-content px-4 sm:px-6 lg:px-8">
          <div className="grid items-stretch gap-6 lg:grid-cols-[minmax(0,1.45fr)_minmax(19rem,0.55fr)] lg:gap-8">
            <Card as="div" padding="lg" className="flex flex-col justify-center border-line-strong">
              <div className="max-w-3xl">
                <div className="inline-flex items-center gap-2 rounded-full bg-brand-50 px-3 py-1.5 text-sm font-semibold text-brand-700">
                  <span className="h-2 w-2 rounded-full bg-brand-600" />
                  Маркетплейс автозапчастей
                </div>
                <h1 className="mt-5 text-balance text-3xl font-bold tracking-tight text-ink sm:text-4xl lg:text-5xl">
                  Запчасти для вашего автомобиля — в одном месте
                </h1>
                <p className="mt-4 max-w-2xl text-pretty text-base leading-relaxed text-ink-muted sm:text-lg">
                  Найдите новую или б/у деталь, сравните предложения продавцов и оформите заказ на сайте.
                </p>
              </div>

              <form onSubmit={runSearch} className="mt-7">
                <label htmlFor="main-search" className="mb-2 block text-sm font-semibold text-ink">
                  Что нужно найти?
                </label>
                <div className="flex flex-col gap-3 sm:flex-row">
                  <div className="relative min-w-0 flex-1">
                    <span className="pointer-events-none absolute inset-y-0 left-0 flex w-12 items-center justify-center text-ink-faint">
                      <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                      </svg>
                    </span>
                    <input
                      id="main-search"
                      type="search"
                      value={query}
                      onChange={(e) => setQuery(e.target.value)}
                      placeholder={COPY.searchPlaceholder}
                      disabled={busy}
                      className="min-h-14 w-full rounded-sg border border-line-strong bg-surface-muted py-3 pl-12 pr-4 text-base text-ink shadow-inner placeholder:text-ink-faint focus:border-brand-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-brand-500/20 disabled:opacity-60"
                    />
                  </div>
                  <Button type="submit" size="lg" disabled={busy || !query.trim()} loading={busy} className="min-h-14 sm:px-7">
                    {COPY.searchCta}
                  </Button>
                </div>
                <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-2 text-xs text-ink-muted">
                  <span>Например:</span>
                  {searchExamples.map((example) => (
                    <button
                      key={example}
                      type="button"
                      onClick={() => setQuery(example)}
                      className="font-medium text-brand-700 hover:text-brand-800 hover:underline"
                    >
                      {example}
                    </button>
                  ))}
                </div>
              </form>
            </Card>

            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-1">
              {showNewAutoparts ? (
                <Link
                  to="/autoparts/new"
                  className="group flex min-h-44 flex-col justify-between rounded-sg-lg bg-brand-700 p-5 text-white shadow-sg-md transition-colors hover:bg-brand-800"
                >
                  <div className="flex items-start justify-between gap-4">
                    <span className="rounded-full bg-white/15 px-2.5 py-1 text-xs font-semibold">Новые</span>
                    <span className="text-xl transition-transform group-hover:translate-x-1">→</span>
                  </div>
                  <div>
                    <h2 className="text-xl font-bold">Новые запчасти</h2>
                    <p className="mt-2 text-sm leading-relaxed text-brand-100">Поиск по предложениям поставщиков с ценами и сроками.</p>
                  </div>
                </Link>
              ) : null}
              <Link
                to="/autoparts/used"
                className="group flex min-h-44 flex-col justify-between rounded-sg-lg border border-line-strong bg-surface p-5 text-ink shadow-sg transition-colors hover:border-brand-200"
              >
                <div className="flex items-start justify-between gap-4">
                  <span className="rounded-full bg-accent-50 px-2.5 py-1 text-xs font-semibold text-accent-700">Б/у</span>
                  <span className="text-xl text-brand-700 transition-transform group-hover:translate-x-1">→</span>
                </div>
                <div>
                  <h2 className="text-xl font-bold">Б/у запчасти</h2>
                  <p className="mt-2 text-sm leading-relaxed text-ink-muted">Детали от магазинов и авторазборов с фотографиями.</p>
                </div>
              </Link>
            </div>
          </div>
        </div>
      </section>

      <section className="border-y border-line bg-surface py-12 md:py-16">
        <div className="mx-auto max-w-sg-content px-4 sm:px-6 lg:px-8">
          <SectionHeader
            eyebrow="Как это работает"
            title="От поиска до заказа — три шага"
            subtitle="Всё необходимое для покупки находится на одной площадке."
            className="mb-8"
          />
          <div className="grid gap-6 md:grid-cols-3">
            {buyerSteps.map((step) => (
              <div key={step.number} className="border-t-2 border-brand-600 pt-5">
                <p className="text-xs font-bold tracking-widest text-brand-700">{step.number}</p>
                <h3 className="mt-3 text-lg font-bold text-ink">{step.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-ink-muted">{step.text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <div className="bg-surface-muted">
        <FeaturedLandingsSection />
      </div>

      <section className="border-y border-line bg-surface py-12 md:py-16">
        <div className="mx-auto max-w-sg-content px-4 sm:px-6 lg:px-8">
          <div className="grid gap-6 lg:grid-cols-2">
            <Card>
              <p className="text-xs font-semibold uppercase tracking-wide text-brand-700">Покупателям</p>
              <h2 className="mt-2 text-xl font-bold text-ink">Быстрый поиск и заказ</h2>
              <p className="mt-3 text-sm leading-relaxed text-ink-muted">
                После регистрации доступны избранное, заказы и переписка с продавцами. Можно искать новые и б/у детали.
              </p>
              <div className="mt-6">
                <Button as={Link} to="/auth" variant="soft">
                  Создать аккаунт
                </Button>
              </div>
            </Card>
            <Card>
              <p className="text-xs font-semibold uppercase tracking-wide text-accent-700">Продавцам</p>
              <h2 className="mt-2 text-xl font-bold text-ink">Склад и продажи в одном кабинете</h2>
              <p className="mt-3 text-sm leading-relaxed text-ink-muted">
                Публикуйте ассортимент, ведите остатки и отвечайте покупателям без лишних таблиц и мессенджеров.
              </p>
              <div className="mt-6">
                <Button type="button" variant="accent" onClick={scrollToSellerForm}>
                  Оставить заявку
                </Button>
              </div>
            </Card>
          </div>
        </div>
      </section>

      <section className="py-12 md:py-16">
        <div className="mx-auto max-w-sg-content px-4 sm:px-6 lg:px-8">
          <div className="grid items-start gap-10 lg:grid-cols-12 lg:gap-12">
            <div className="lg:col-span-5">
              <h2 className="text-2xl font-bold tracking-tight text-ink md:text-3xl">
                Зарегистрироваться как продавец
              </h2>
              <p className="mt-4 text-pretty leading-relaxed text-ink-muted">
                Оставьте заявку. После проверки администратором на email придёт письмо с доступом в кабинет.
              </p>
              <ul className="mt-6 space-y-3">
                {sellerBenefits.map((line) => (
                  <li key={line} className="flex gap-3 text-sm text-ink-soft">
                    <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-brand-50 text-brand-700">
                      <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
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

      {showSiteReviews && <ReviewsSection />}

      <section className="border-t border-line bg-ink py-12 md:py-14">
        <div className="mx-auto max-w-2xl px-4 text-center sm:px-6">
          <h2 className="text-2xl font-bold tracking-tight text-white">Готовы найти деталь?</h2>
          <p className="mt-3 text-base text-slate-300">
            Откройте каталог или создайте аккаунт. Магазинам — форма заявки выше на этой странице.
          </p>
          <div className="mt-8 flex flex-col items-stretch justify-center gap-3 sm:flex-row">
            <Button as={Link} to={autopartsPath} size="lg" className="!bg-white !text-brand-700 hover:!bg-brand-50">
              Перейти в каталог
            </Button>
            <Button
              as={Link}
              to="/auth"
              variant="secondary"
              size="lg"
              className="!border-slate-600 !bg-transparent !text-white hover:!bg-white/10"
            >
              Регистрация
            </Button>
          </div>
        </div>
      </section>

      <YandexWebmasterCounter />
    </div>
  );
}

export default Main;
