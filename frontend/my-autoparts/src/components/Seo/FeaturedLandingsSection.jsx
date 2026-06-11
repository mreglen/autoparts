import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { apiAxiosUnauth } from '../../utils/apiClient';

function LinkRow({ title, items }) {
  if (!items?.length) return null;
  return (
    <div className="space-y-2">
      <h3 className="text-sm font-semibold text-gray-800">{title}</h3>
      <div className="flex flex-wrap gap-2">
        {items.map((item) => (
          <Link
            key={`${item.kind}-${item.slug}`}
            to={item.path}
            className="inline-flex items-center rounded-xl border border-indigo-100 bg-white px-4 py-2 text-sm font-medium text-indigo-700 shadow-sm transition hover:border-indigo-200 hover:bg-indigo-50"
          >
            {item.label}
          </Link>
        ))}
      </div>
    </div>
  );
}

export default function FeaturedLandingsSection() {
  const [data, setData] = useState(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const response = await apiAxiosUnauth.get('/public/seo/featured-landings', {
          params: { limit: 8 },
        });
        if (!cancelled) setData(response?.data || null);
      } catch (_e) {
        if (!cancelled) setData(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (!data) return null;

  const hasAny =
    data.brands_new?.length ||
    data.brands_used?.length ||
    data.categories_new?.length ||
    data.categories_used?.length ||
    data.geo?.length;
  if (!hasAny) return null;

  return (
    <section className="relative mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
      <div className="rounded-3xl border border-indigo-100/80 bg-white/90 p-6 shadow-sm sm:p-8">
        <h2 className="text-2xl font-bold text-gray-900">Популярные каталоги</h2>
        <p className="mt-2 text-sm text-gray-600">
          Бренды, категории и гео-посадочные для быстрого перехода к нужным запчастям.
        </p>
        <div className="mt-6 space-y-6">
          <LinkRow title="Новые бренды" items={data.brands_new} />
          <LinkRow title="Б/у бренды" items={data.brands_used} />
          <LinkRow title="Новые категории" items={data.categories_new} />
          <LinkRow title="Б/у категории" items={data.categories_used} />
          <LinkRow title="Гео" items={data.geo} />
        </div>
      </div>
    </section>
  );
}
