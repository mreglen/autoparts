import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { apiAxiosUnauth } from '../../utils/apiClient';

function LinkRow({ title, items }) {
  if (!items?.length) return null;
  return (
    <div className="space-y-2">
      <h3 className="text-sm font-semibold text-ink-soft">{title}</h3>
      <div className="flex flex-wrap gap-2">
        {items.map((item) => (
          <Link
            key={`${item.kind}-${item.slug}`}
            to={item.path}
            className="inline-flex items-center rounded-full border border-brand-100/80 bg-[#f5f6f8] px-4 py-2 text-sm font-medium text-brand-700 transition hover:border-brand-200 hover:bg-brand-50"
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
    <section className="relative mx-auto max-w-sg-content px-4 py-10 sm:px-6 sm:py-12 lg:px-8">
      <div className="rounded-[1.75rem] border border-white/70 bg-white/85 p-6 shadow-[0_8px_32px_rgba(15,23,42,0.06)] backdrop-blur-sm sm:rounded-[2rem] sm:p-8">
        <p className="text-sm font-semibold text-brand-600">Популярное</p>
        <h2 className="mt-1 text-2xl font-bold text-ink">Каталоги и подборки</h2>
        <p className="mt-2 text-sm text-ink-muted">
          Бренды, категории и города — быстрый переход к нужным запчастям.
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
