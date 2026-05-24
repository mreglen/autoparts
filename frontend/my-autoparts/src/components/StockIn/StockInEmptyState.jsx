import React from 'react';
import { Link } from 'react-router-dom';

export default function StockInEmptyState({ hasSearch }) {
  return (
    <div className="rounded-2xl border border-dashed border-emerald-200 bg-white px-6 py-14 text-center shadow-sm">
      <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-700">
        <svg className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden>
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={1.5}
            d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
          />
        </svg>
      </div>
      <h3 className="text-lg font-semibold text-gray-900">
        {hasSearch ? 'Ничего не найдено' : 'Документов поступления пока нет'}
      </h3>
      <p className="mx-auto mt-2 max-w-sm text-sm text-gray-600">
        {hasSearch
          ? 'Измените поисковый запрос или сбросьте фильтр.'
          : 'Документы появятся после оприходования запчастей в разделе «Мои запчасти».'}
      </p>
      {!hasSearch && (
        <Link
          to="/my-parts"
          className="mt-6 inline-flex rounded-xl bg-emerald-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-emerald-700"
        >
          Перейти к запчастям
        </Link>
      )}
    </div>
  );
}
