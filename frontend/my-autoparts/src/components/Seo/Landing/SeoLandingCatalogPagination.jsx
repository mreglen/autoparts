import React from 'react';

export default function SeoLandingCatalogPagination({ page, totalPages, loading, onPrev, onNext }) {
  if (totalPages <= 1) return null;
  return (
    <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-center sm:gap-3">
      <button
        type="button"
        disabled={page <= 1 || loading}
        onClick={onPrev}
        className="rounded-lg border border-gray-300 px-4 py-2.5 text-sm disabled:opacity-50 sm:flex-none flex-1 min-h-[44px]"
      >
        Назад
      </button>
      <span className="text-center text-sm text-gray-600">
        Страница {page} из {totalPages}
      </span>
      <button
        type="button"
        disabled={page >= totalPages || loading}
        onClick={onNext}
        className="rounded-lg border border-gray-300 px-4 py-2.5 text-sm disabled:opacity-50 sm:flex-none flex-1 min-h-[44px]"
      >
        Вперёд
      </button>
    </div>
  );
}
