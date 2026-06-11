import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useSelector } from 'react-redux';
import { apiAxiosUnauth } from '../../../utils/apiClient';
import { buildNewPartDetailPath } from '../../../utils/partRoutes';
import { mapPartToStocksData } from './rosskoHelpers';
import {
  applyMarkup,
  formatDeliveryTimeText,
  formatPriceRub,
  getMinStockPrice,
} from './newPartStockUtils';

const safeText = (value, fallback = '—') => {
  if (typeof value === 'string') return value.trim() || fallback;
  if (typeof value === 'number') return String(value);
  return fallback;
};

async function resolveAnalogUrl(part) {
  const brand = safeText(part?.brand, '');
  const article = safeText(part?.partnumber || part?.article, '');
  if (!brand || !article || brand === '—' || article === '—') return null;
  try {
    const response = await apiAxiosUnauth.get('/public/new-parts/cards/resolve', {
      params: { brand, article },
    });
    const data = response?.data;
    if (data?.canonical_url) return data.canonical_url;
    if (data?.card_id) {
      return buildNewPartDetailPath({ id: data.card_id, brand, article });
    }
  } catch (_e) {
    return null;
  }
  return null;
}

function AnalogRow({ part, markupPercent, onNavigateCreate }) {
  const [href, setHref] = useState(null);
  const [resolving, setResolving] = useState(true);
  const stocks = mapPartToStocksData(part);
  const minPrice = getMinStockPrice(stocks, markupPercent);
  const delivery = stocks[0]
    ? formatDeliveryTimeText(stocks[0].delivery_start, stocks[0].delivery_end)
    : '—';
  const brand = safeText(part?.brand);
  const article = safeText(part?.partnumber || part?.article);
  const name = safeText(part?.name, `${brand} ${article}`.trim());

  useEffect(() => {
    let cancelled = false;
    setResolving(true);
    resolveAnalogUrl(part).then((url) => {
      if (!cancelled) {
        setHref(url);
        setResolving(false);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [part]);

  const handleClick = (event) => {
    if (href) return;
    event.preventDefault();
    onNavigateCreate(part);
  };

  const linkClass = 'font-medium text-indigo-600 hover:text-indigo-800';

  return (
    <tr className="border-b border-gray-100 last:border-0">
      <td className="px-3 py-2 text-gray-800">{brand}</td>
      <td className="px-3 py-2 text-gray-800">{article}</td>
      <td className="px-3 py-2 text-gray-700">{name}</td>
      <td className="px-3 py-2 font-medium text-gray-900">
        {minPrice ? `${formatPriceRub(minPrice)} ₽` : '—'}
      </td>
      <td className="px-3 py-2 text-gray-600">{delivery}</td>
      <td className="px-3 py-2">
        {resolving ? (
          <span className="text-xs text-gray-400">…</span>
        ) : href ? (
          <Link to={href} className={linkClass}>
            Открыть
          </Link>
        ) : (
          <button type="button" onClick={handleClick} className={linkClass}>
            Открыть
          </button>
        )}
      </td>
    </tr>
  );
}

export default function NewPartAnalogsTable({ analogParts, loading, onNavigateCreate }) {
  const markupPercent = useSelector((state) => state.publicInfo.newPartsMarkupPercent ?? 15);

  if (loading) {
    return <p className="text-sm text-gray-500">Загрузка аналогов…</p>;
  }
  if (!analogParts.length) {
    return <p className="text-sm text-gray-500">Аналоги не найдены.</p>;
  }

  return (
    <div className="overflow-x-auto rounded-2xl border border-gray-200 bg-white shadow-sm">
      <table className="min-w-full text-left text-sm">
        <thead>
          <tr className="border-b border-gray-200 bg-gray-50 text-xs uppercase tracking-wide text-gray-500">
            <th className="px-3 py-2 font-medium">Бренд</th>
            <th className="px-3 py-2 font-medium">Артикул</th>
            <th className="px-3 py-2 font-medium">Название</th>
            <th className="px-3 py-2 font-medium">Цена от</th>
            <th className="px-3 py-2 font-medium">Поставка</th>
            <th className="px-3 py-2 font-medium">Ссылка</th>
          </tr>
        </thead>
        <tbody>
          {analogParts.map((part, idx) => {
            const key = safeText(part?.guid) || `${safeText(part?.brand)}|${safeText(part?.partnumber)}|${idx}`;
            return (
              <AnalogRow
                key={key}
                part={part}
                markupPercent={markupPercent}
                onNavigateCreate={onNavigateCreate}
              />
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
