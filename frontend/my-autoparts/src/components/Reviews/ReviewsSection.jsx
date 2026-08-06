import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { apiAxiosUnauth } from '../../utils/apiClient';
import { useShowSiteReviews } from '../../utils/siteReviewsPublic';
import ReviewCard from './ReviewCard';
import StarRating from './StarRating';
import { Button, Card } from '../UI';

export default function ReviewsSection() {
  const showSiteReviews = useShowSiteReviews();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!showSiteReviews) return undefined;
    let cancelled = false;
    (async () => {
      try {
        const res = await apiAxiosUnauth.get('/public/site-reviews', {
          params: { featured: true, limit: 6 },
        });
        if (!cancelled) setData(res.data);
      } catch {
        if (!cancelled) setData(null);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [showSiteReviews]);

  if (!showSiteReviews) return null;

  if (loading) {
    return (
      <section className="border-y border-line bg-surface py-14 md:py-20">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="h-40 animate-pulse rounded-sg-lg bg-surface-muted" />
        </div>
      </section>
    );
  }

  if (!data?.reviews?.length) return null;

  return (
    <section className="border-y border-line bg-surface py-14 md:py-20">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-2xl">
            <p className="text-sm font-semibold text-brand-700">Отзывы клиентов</p>
            <h2 className="mt-2 text-2xl font-bold tracking-tight text-ink md:text-3xl">
              Нам доверяют покупатели и сервисы
            </h2>
            <p className="mt-3 text-pretty text-ink-muted md:text-lg">
              Честные оценки о подборе запчастей, доставке и работе с продавцами на платформе.
            </p>
          </div>

          <Card padding="sm" className="flex shrink-0 items-center gap-4 px-5 py-4">
            <div className="text-center">
              <p className="text-3xl font-bold text-ink">{data.average_rating.toFixed(1)}</p>
              <StarRating value={Math.round(data.average_rating)} size="sm" className="mt-1 justify-center" />
            </div>
            <div className="h-10 w-px bg-line" />
            <div>
              <p className="text-sm font-semibold text-ink">{data.total_count} отзывов</p>
              <p className="text-xs text-ink-muted">на сайте и площадках</p>
            </div>
          </Card>
        </div>

        <div className="mt-10 grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
          {data.reviews.map((review) => (
            <ReviewCard key={review.id} review={review} compact />
          ))}
        </div>

        <div className="mt-10 flex flex-col items-stretch justify-center gap-3 sm:flex-row sm:items-center">
          <Button as={Link} to="/reviews" size="lg">
            Все отзывы
          </Button>
          <Button as={Link} to="/about" variant="secondary" size="lg">
            О компании
          </Button>
        </div>
      </div>
    </section>
  );
}
