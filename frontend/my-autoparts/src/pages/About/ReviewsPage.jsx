import React, { useEffect, useMemo, useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { buildReviewsSeo, PageSeoHelmet } from '../../utils/pageSeo';
import { apiAxiosUnauth } from '../../utils/apiClient';
import ReviewCard from '../../components/Reviews/ReviewCard';
import StarRating from '../../components/Reviews/StarRating';
import ReviewSubmitForm from '../../components/Reviews/ReviewSubmitForm';
import PageAmbientBackground from '../../components/PageAmbientBackground/PageAmbientBackground';
import { useShowSiteReviews } from '../../utils/siteReviewsPublic';
import { reviewSourceLabel } from '../../components/Reviews/reviewUtils';
import YandexReviewsEmbed from '../../components/Reviews/YandexReviewsEmbed';
import YandexWebmasterCounter from '../../components/Seo/YandexWebmasterCounter';
import { Badge, Button, Card, PageHeader } from '../../components/UI';

const FILTER_OPTIONS = [
  { id: 'all', label: 'Все' },
  { id: 'platform', label: 'Свой Гараж' },
  { id: 'yandex', label: 'Яндекс' },
  { id: 'avito', label: 'Авито' },
];

export default function ReviewsPage() {
  const showSiteReviews = useShowSiteReviews();
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
  const seo = buildReviewsSeo();

  if (!showSiteReviews) {
    return <Navigate to="/" replace />;
  }

  return (
    <>
      <PageSeoHelmet seo={seo} />

      <div className="relative w-full pb-16 md:pb-20">
        <PageAmbientBackground />

        <div className="relative mx-auto max-w-6xl px-4 py-6 sm:px-6 sm:py-8 lg:px-8">
          <Card padding="lg" className="overflow-hidden">
            <div className="grid gap-8 lg:grid-cols-[1.2fr_0.8fr] lg:items-center">
              <div>
                <Badge tone="brand" className="mb-3">Мнение клиентов</Badge>
                <PageHeader
                  className="mb-0"
                  title="Отзывы о «Свой Гараж»"
                  subtitle="Подбор запчастей, доставка, общение с продавцами и работа магазина — как это видят покупатели и партнёры платформы."
                />
              </div>

              {!loading && data ? (
                <Card padding="md" className="bg-surface-muted shadow-none">
                  <div className="flex items-center gap-4">
                    <div>
                      <p className="text-4xl font-bold text-ink">{data.average_rating.toFixed(1)}</p>
                      <StarRating value={Math.round(data.average_rating)} size="lg" className="mt-2" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-ink">Средняя оценка</p>
                      <p className="text-sm text-ink-muted">{total} отзывов на сайте</p>
                    </div>
                  </div>
                  <div className="mt-5 space-y-2">
                    {[5, 4, 3, 2, 1].map((stars) => {
                      const count = ratingBuckets[stars] || 0;
                      const width = total ? `${Math.round((count / total) * 100)}%` : '0%';
                      return (
                        <div key={stars} className="flex items-center gap-2 text-xs text-ink-muted">
                          <span className="w-3">{stars}</span>
                          <div className="h-2 flex-1 overflow-hidden rounded-full bg-surface-subtle">
                            <div className="h-full rounded-full bg-brand-600" style={{ width }} />
                          </div>
                          <span className="w-6 text-right tabular-nums">{count}</span>
                        </div>
                      );
                    })}
                  </div>
                </Card>
              ) : null}
            </div>
          </Card>

          <div className="mt-8">
            <ReviewSubmitForm onSubmitted={loadReviews} />
          </div>

          <section className="mt-10">
            <div className="mb-5 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <h2 className="text-sg-subtitle text-ink">Отзывы на сайте</h2>
              <div className="flex flex-wrap gap-2">
                {FILTER_OPTIONS.map((option) => (
                  <button
                    key={option.id}
                    type="button"
                    onClick={() => setSourceFilter(option.id)}
                    className={`rounded-full px-3.5 py-1.5 text-xs font-medium transition-colors ${
                      sourceFilter === option.id
                        ? 'bg-brand-600 text-white shadow-sg-sm'
                        : 'border border-line bg-surface text-ink-soft hover:bg-surface-muted'
                    }`}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </div>

            {loading && <p className="text-sm text-ink-muted">Загрузка отзывов…</p>}
            {error && (
              <div className="rounded-sg border border-danger-100 bg-danger-50 px-4 py-3 text-sm text-danger-700">
                {error}
              </div>
            )}

            {!loading && !error && filteredReviews.length === 0 && (
              <Card className="px-4 py-8 text-center text-sm text-ink-muted" padding="md">
                По выбранному фильтру отзывов пока нет.
              </Card>
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
              <h2 className="text-sg-subtitle text-ink">Отзывы на Яндекс Картах</h2>
              <p className="mt-2 text-sm text-ink-muted">
                Также можно оставить оценку в карточке организации — она появится в виджете ниже.
              </p>
            </div>
            <YandexReviewsEmbed />
          </section>

          <Card className="mt-10" padding="lg">
            <h2 className="text-lg font-semibold text-ink">Другие площадки</h2>
            <p className="mt-2 max-w-2xl text-sm leading-relaxed text-ink-muted">
              Отзыв можно также оставить на {reviewSourceLabel('yandex')} — они отображаются в виджете ниже.
            </p>
            <div className="mt-5 flex flex-wrap gap-3">
              <Button as={Link} to="/autoparts/used">
                Перейти в каталог
              </Button>
              <Button as={Link} to="/about" variant="secondary">
                Контакты компании
              </Button>
            </div>
          </Card>
        </div>
      </div>
      <YandexWebmasterCounter />
    </>
  );
}
