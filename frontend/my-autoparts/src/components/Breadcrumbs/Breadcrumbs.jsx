import React from 'react';
import { Link } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { buildBreadcrumbJsonLd } from '../../utils/breadcrumbs';

export default function Breadcrumbs({ items, includeJsonLd = true }) {
  if (!items?.length) return null;

  const jsonLd = includeJsonLd ? buildBreadcrumbJsonLd(items) : null;

  return (
    <>
      {jsonLd ? (
        <Helmet>
          <script type="application/ld+json">{JSON.stringify(jsonLd)}</script>
        </Helmet>
      ) : null}
      <nav aria-label="Хлебные крошки" className="mb-4 text-sm text-gray-600">
        <ol className="flex flex-wrap items-center gap-1.5">
          {items.map((item, index) => {
            const isLast = index === items.length - 1;
            return (
              <li key={`${item.label}-${index}`} className="inline-flex items-center gap-1.5">
                {index > 0 ? <span className="text-gray-400" aria-hidden="true">/</span> : null}
                {item.href && !isLast ? (
                  <Link to={item.href} className="font-medium text-indigo-600 hover:text-indigo-800 hover:underline">
                    {item.label}
                  </Link>
                ) : (
                  <span className={isLast ? 'font-medium text-gray-900' : undefined}>{item.label}</span>
                )}
              </li>
            );
          })}
        </ol>
      </nav>
    </>
  );
}
