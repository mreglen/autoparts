import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { apiAxiosUnauth } from '../../../utils/apiClient';

const chipClass =
  'rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm font-medium text-gray-700 hover:border-indigo-300 hover:bg-indigo-50 hover:text-indigo-700 min-h-[44px] inline-flex items-center';

export default function SeoLandingSimilarCategories({ kind, slug }) {
  const [items, setItems] = useState([]);

  useEffect(() => {
    if (!kind?.startsWith('category_') || !slug) {
      setItems([]);
      return undefined;
    }
    let cancelled = false;
    (async () => {
      try {
        const response = await apiAxiosUnauth.get(
          `/public/seo/landings/${encodeURIComponent(kind)}/${encodeURIComponent(slug)}/crosslinks`,
        );
        if (!cancelled) setItems(response?.data?.related_categories || []);
      } catch (_e) {
        if (!cancelled) setItems([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [kind, slug]);

  if (!items.length) return null;

  return (
    <section className="mb-6 rounded-2xl border border-gray-200 bg-white/90 p-5 shadow-sm sm:p-6">
      <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-gray-500">Похожие категории</h2>
      <div className="flex flex-wrap gap-2">
        {items.map((item) => (
          <Link key={`${item.kind}-${item.slug}`} to={item.path} className={chipClass}>
            {item.label}
          </Link>
        ))}
      </div>
    </section>
  );
}
