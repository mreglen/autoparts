import React from 'react';
import { Link } from 'react-router-dom';

const chipClass =
  'rounded-full border border-gray-200 bg-white px-3 py-2 text-xs font-medium text-gray-700 hover:border-indigo-300 hover:text-indigo-700 min-h-[44px] inline-flex items-center sm:py-1.5';

export default function SeoLandingPopularQueries({ queries, title = 'Популярные запросы' }) {
  if (!queries?.length) return null;
  return (
    <section className="mb-6 rounded-2xl border border-gray-200 bg-white/90 p-5 shadow-sm sm:p-6">
      <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-gray-500">{title}</h2>
      <div className="flex flex-wrap gap-2">
        {queries.map((query) => {
          const path = query.path?.startsWith('http')
            ? query.path.replace(/^https?:\/\/[^/]+/, '')
            : query.path;
          return (
            <Link key={`${path}-${query.label}`} to={path || '#'} className={chipClass}>
              {query.label}
            </Link>
          );
        })}
      </div>
    </section>
  );
}
