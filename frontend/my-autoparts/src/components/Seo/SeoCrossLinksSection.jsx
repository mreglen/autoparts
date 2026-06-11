import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { apiAxiosUnauth } from '../../utils/apiClient';

function LinkGroup({ title, items }) {
  if (!items?.length) return null;
  return (
    <div>
      <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-gray-500">{title}</h2>
      <div className="flex flex-wrap gap-2">
        {items.map((item) => (
          <Link
            key={`${item.kind}-${item.slug}`}
            to={item.path}
            className="rounded-full border border-gray-200 bg-white px-3 py-1.5 text-xs font-medium text-gray-700 hover:border-indigo-300 hover:text-indigo-700"
          >
            {item.label}
          </Link>
        ))}
      </div>
    </div>
  );
}

export default function SeoCrossLinksSection({ kind, slug }) {
  const [data, setData] = useState(null);

  useEffect(() => {
    if (!kind || !slug) {
      setData(null);
      return undefined;
    }
    let cancelled = false;
    (async () => {
      try {
        const response = await apiAxiosUnauth.get(
          `/public/seo/landings/${encodeURIComponent(kind)}/${encodeURIComponent(slug)}/crosslinks`,
        );
        if (!cancelled) setData(response?.data || null);
      } catch (_e) {
        if (!cancelled) setData(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [kind, slug]);

  if (!data) return null;

  const counterpart = data.counterpart;
  const hasLinks =
    counterpart ||
    (data.brands || []).length ||
    (data.categories || []).length ||
    (data.geo || []).length;
  if (!hasLinks) return null;

  return (
    <section className="mb-8 space-y-6 rounded-2xl border border-gray-200 bg-white/90 p-5 shadow-sm">
      {counterpart ? (
        <div>
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-gray-500">
            Смежный раздел
          </h2>
          <Link
            to={counterpart.path}
            className="inline-flex items-center rounded-lg border border-indigo-200 bg-indigo-50 px-3 py-2 text-sm font-medium text-indigo-700 hover:bg-indigo-100"
          >
            {counterpart.label}
          </Link>
        </div>
      ) : null}
      <LinkGroup title="Бренды" items={data.brands} />
      <LinkGroup title="Категории" items={data.categories} />
      <LinkGroup title="Гео" items={data.geo} />
    </section>
  );
}
