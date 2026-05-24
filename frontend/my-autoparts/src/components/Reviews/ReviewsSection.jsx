import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { apiAxiosUnauth } from '../../utils/apiClient';
import ReviewCard from './ReviewCard';
import StarRating from './StarRating';

export default function ReviewsSection() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
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
  }, []);

  if (loading) {
    return (
      <section className="border-y border-gray-200/80 bg-white/90 py-14 md:py-20">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="h-40 animate-pulse rounded-2xl bg-gray-100" />
        </div>
      </section>
    );
  }

  if (!data?.reviews?.length) return null;

  return (
    <section className="relative overflow-hidden border-y border-gray-200/80 bg-white/90 py-14 shadow-[0_-12px_40px_-24px_rgba(30,27,75,0.12)] backdrop-blur-sm md:py-20">
      <div className="pointer-events-none absolute -right-16 bottom-0 h-64 w-64 rounded-full bg-indigo-400/10 blur-3xl" />

      <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-2xl">
            <p className="text-sm font-semibold uppercase tracking-wide text-indigo-600">Отзывы клиентов</p>
            <h2 className="mt-2 text-2xl font-bold tracking-tight text-gray-900 md:text-3xl">
              Нам доверяют покупатели и сервисы
            </h2>
            <p className="mt-3 text-pretty text-gray-600 md:text-lg">
              Честные оценки о подборе запчастей, доставке и работе с продавцами на платформе.
            </p>
          </div>

          <div className="flex shrink-0 items-center gap-4 rounded-2xl border border-amber-100 bg-gradient-to-br from-amber-50 to-white px-5 py-4 shadow-sm">
            <div className="text-center">
              <p className="text-3xl font-extrabold text-gray-900">{data.average_rating.toFixed(1)}</p>
              <StarRating value={Math.round(data.average_rating)} size="sm" className="mt-1 justify-center" />
            </div>
            <div className="h-10 w-px bg-amber-200/80" />
            <div>
              <p className="text-sm font-semibold text-gray-900">{data.total_count} отзывов</p>
              <p className="text-xs text-gray-500">на сайте и площадках</p>
            </div>
          </div>
        </div>

        <div className="mt-10 grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
          {data.reviews.map((review) => (
            <ReviewCard key={review.id} review={review} compact />
          ))}
        </div>

        <div className="mt-10 flex flex-col items-stretch justify-center gap-3 sm:flex-row sm:items-center">
          <Link
            to="/reviews"
            className="inline-flex min-h-11 items-center justify-center rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 px-8 text-sm font-semibold text-white shadow-lg shadow-indigo-600/20 transition hover:from-blue-700 hover:to-indigo-700"
          >
            Все отзывы
          </Link>
          <Link
            to="/about"
            className="inline-flex min-h-11 items-center justify-center rounded-xl border border-gray-200 bg-white px-8 text-sm font-semibold text-gray-700 shadow-sm transition hover:border-indigo-200 hover:bg-indigo-50 hover:text-indigo-800"
          >
            О компании
          </Link>
        </div>
      </div>
    </section>
  );
}
