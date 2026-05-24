import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { apiAxiosUnauth } from '../../utils/apiClient';
import ReviewCard from '../../components/Reviews/ReviewCard';
import StarRating from '../../components/Reviews/StarRating';
import ReviewSubmitForm from '../../components/Reviews/ReviewSubmitForm';
import PageAmbientBackground from '../../components/PageAmbientBackground/PageAmbientBackground';
import { reviewSourceLabel } from '../../components/Reviews/reviewUtils';
import YandexReviewsEmbed from '../../components/Reviews/YandexReviewsEmbed';

const FILTER_OPTIONS = [
  { id: 'all', label: 'Все' },
  { id: 'platform', label: 'Свой Гараж' },
  { id: 'yandex', label: 'Яндекс' },
  { id: 'avito', label: 'Авито' },
];

export default function ReviewsPage() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [sourceFilter, setSourceFilter] = useState('all');

  const loadReviews = async () => {
    try {
      const res = await apiAxiosUnauth.get('/public/site-reviews');
      setData(res.data);
      setError(null);
    } catch (e) {
      setError(e?.response?.data?.detail || 'Не удалось загрузить отзывы');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadReviews();
  }, []);

  const filteredReviews = useMemo(() => {
    const reviews = data?.reviews || [];
    if (sourceFilter === 'all') return reviews;
    return reviews.filter((item) => item.source === sourceFilter);
  }, [data?.reviews, sourceFilter]);

  const ratingBuckets = useMemo(() => {
    const buckets = { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 };
    (data?.reviews || []).forEach((item) => {
      const key = Math.min(5, Math.max(1, Number(item.rating) || 5));
      buckets[key] += 1;
    });
    return buckets;
  }, [data?.reviews]);

  const total = data?.total_count || 0;

  return (
    <>
      <Helmet>
        <title>Отзывы — Свой Гараж</title>
        <meta
          name="description"
          content="Отзывы покупателей и партнёров о магазине «Свой Гараж»: подбор запчастей, доставка, чаты с продавцами и работа платформы."
        />
      </Helmet>

      <div className="relative w-full pb-16 md:pb-20">
        <PageAmbientBackground />

        <div className="relative mx-auto max-w-6xl px-4 py-6 sm:px-6 sm:py-8 lg:px-8">
        <header className="relative overflow-hidden rounded-3xl border border-white/70 bg-gradient-to-br from-white via-white to-indigo-50/60 p-6 shadow-xl shadow-indigo-950/5 ring-1 ring-gray-200/60 sm:p-8 md:p-10">
          <div className="pointer-events-none absolute -right-10 -top-10 h-40 w-40 rounded-full bg-indigo-500/10 blur-2xl" />
          <div className="relative grid gap-8 lg:grid-cols-[1.2fr_0.8fr] lg:items-center">
            <div>
              <p className="text-sm font-semibold uppercase tracking-wide text-indigo-600">Мнение клиентов</p>
              <h1 className="mt-2 text-3xl font-extrabold tracking-tight text-gray-900 sm:text-4xl">
                Отзывы о «Свой Гараж»
              </h1>
              <p className="mt-4 max-w-2xl text-base leading-relaxed text-gray-600 sm:text-lg">
                Подбор запчастей, доставка, общение с продавцами и работа магазина — как это видят покупатели
                и партнёры платформы.
              </p>
            </div>

            {!loading && data ? (
              <div className="rounded-2xl border border-indigo-100 bg-white/90 p-5 shadow-sm backdrop-blur-sm">
                <div className="flex items-center gap-4">
                  <div>
                    <p className="text-4xl font-extrabold text-gray-900">{data.average_rating.toFixed(1)}</p>
                    <StarRating value={Math.round(data.average_rating)} size="lg" className="mt-2" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-gray-900">Средняя оценка</p>
                    <p className="text-sm text-gray-500">{total} отзывов на сайте</p>
                  </div>
                </div>
                <div className="mt-5 space-y-2">
                  {[5, 4, 3, 2, 1].map((stars) => {
                    const count = ratingBuckets[stars] || 0;
                    const width = total ? `${Math.round((count / total) * 100)}%` : '0%';
                    return (
                      <div key={stars} className="flex items-center gap-2 text-xs text-gray-600">
                        <span className="w-3">{stars}</span>
                        <div className="h-2 flex-1 overflow-hidden rounded-full bg-gray-100">
                          <div className="h-full rounded-full bg-indigo-500" style={{ width }} />
                        </div>
                        <span className="w-6 text-right tabular-nums">{count}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : null}
          </div>
        </header>

        <div className="mt-8">
          <ReviewSubmitForm onSubmitted={loadReviews} />
        </div>

        <section className="mt-10">
          <div className="mb-5 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <h2 className="text-xl font-bold text-gray-900">Отзывы на сайте</h2>
            <div className="flex flex-wrap gap-2">
              {FILTER_OPTIONS.map((option) => (
                <button
                  key={option.id}
                  type="button"
                  onClick={() => setSourceFilter(option.id)}
                  className={`rounded-full px-3.5 py-1.5 text-xs font-medium transition ${
                    sourceFilter === option.id
                      ? 'bg-indigo-600 text-white shadow-sm'
                      : 'bg-white text-gray-600 ring-1 ring-gray-200 hover:bg-gray-50'
                  }`}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>

          {loading && <p className="text-sm text-gray-500">Загрузка отзывов…</p>}
          {error && (
            <div className="rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-800">
              {error}
            </div>
          )}

          {!loading && !error && filteredReviews.length === 0 && (
            <p className="rounded-xl border border-gray-200 bg-white px-4 py-8 text-center text-sm text-gray-500">
              По выбранному фильтру отзывов пока нет.
            </p>
          )}

          {!loading && !error && filteredReviews.length > 0 && (
            <div className="grid gap-5 md:grid-cols-2">
              {filteredReviews.map((review) => (
                <ReviewCard key={review.id} review={review} />
              ))}
            </div>
          )}
        </section>

        <section className="mt-12">
          <div className="mb-5">
            <h2 className="text-xl font-bold text-gray-900">Отзывы на Яндекс Картах</h2>
            <p className="mt-2 text-sm text-gray-600">
              Также можно оставить оценку в карточке организации — она появится в виджете ниже.
            </p>
          </div>
          <YandexReviewsEmbed />
        </section>

        <section className="mt-10 rounded-2xl border border-gray-200 bg-white/80 p-6 sm:p-8">
          <h2 className="text-lg font-semibold text-gray-900">Другие площадки</h2>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-gray-600">
            Отзыв можно также оставить на {reviewSourceLabel('yandex')} — они отображаются в виджете ниже.
          </p>
          <div className="mt-5 flex flex-wrap gap-3">
            <Link
              to="/autoparts/used"
              className="inline-flex items-center rounded-xl bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-indigo-700"
            >
              Перейти в каталог
            </Link>
            <Link
              to="/about"
              className="inline-flex items-center rounded-xl border border-gray-200 bg-white px-5 py-2.5 text-sm font-semibold text-gray-700 transition hover:bg-gray-50"
            >
              Контакты компании
            </Link>
          </div>
        </section>
        </div>
      </div>
    </>
  );
}
