import React, { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useSelector } from 'react-redux';
import {
  selectAnalogsLoading,
  selectCatalogLoading,
  selectCatalogTotal,
} from '../../../redux/slices/ProductSlice';

const selectUsedAnalogCount = (state) => (state.products.usedPartsData?.analog_parts || []).length;

/**
 * Счётчик б/у запчастей по текущему поисковому запросу (для вкладки «Новые»).
 */
export default function UsedPartsSearchCount({ query, variant = 'inline' }) {
  const catalogTotal = useSelector(selectCatalogTotal);
  const catalogLoading = useSelector(selectCatalogLoading);
  const analogsLoading = useSelector(selectAnalogsLoading);
  const analogCount = useSelector(selectUsedAnalogCount);

  const trimmedQuery = String(query || '').trim();
  const usedTotal = useMemo(() => catalogTotal + analogCount, [catalogTotal, analogCount]);
  const loading = catalogLoading || analogsLoading;

  if (!trimmedQuery) return null;

  const usedHref = `/autoparts/used?q=${encodeURIComponent(trimmedQuery)}`;

  if (variant === 'block') {
    if (loading && usedTotal === 0) {
      return (
        <p className="mt-4 text-sm text-gray-500">Проверяем б/у раздел…</p>
      );
    }
    return (
      <p className="mt-4 text-sm text-gray-600">
        В разделе{' '}
        <Link to={usedHref} className="font-medium text-indigo-600 hover:text-indigo-800">
          Б/У
        </Link>
        {' '}найдено:{' '}
        <span className="font-semibold text-gray-900">{usedTotal}</span>
      </p>
    );
  }

  if (loading && usedTotal === 0) {
    return <span className="text-gray-400"> · б/у: …</span>;
  }

  return (
    <span className="text-gray-500">
      {' · '}
      <Link to={usedHref} className="font-medium text-indigo-600 hover:text-indigo-800">
        б/у: {usedTotal}
      </Link>
    </span>
  );
}
