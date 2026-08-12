import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import useNewPartsMarkupPercent from '../../../hooks/useNewPartsMarkupPercent';
import { Card } from '../../../components/UI';
import { apiAxiosUnauth } from '../../../utils/apiClient';
import { buildNewPartDetailPath } from '../../../utils/partRoutes';
import { mapPartToStocksData } from './rosskoHelpers';
import {
  formatDeliveryTimeText,
  formatPriceRub,
  getMinStockPrice,
} from './newPartStockUtils';
import NewPartHorizontalScroll from './NewPartHorizontalScroll';

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

function AnalogMobileCard({ part, markupPercent, onNavigateCreate }) {
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

  const linkClass = 'inline-flex min-h-[44px] items-center font-medium text-brand-600 hover:text-brand-800';

  return (
    <Card as="article" padding="sm">
      <div className="flex flex-wrap gap-2 text-xs">
        <span className="rounded bg-surface-subtle px-2 py-0.5 font-medium text-ink-soft">{brand}</span>
        <span className="rounded bg-surface-subtle px-2 py-0.5 font-medium text-ink-soft">{article}</span>
      </div>
      <p className="mt-2 text-sm font-semibold leading-snug text-ink">{name}</p>
      <div className="mt-3 flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs text-ink-muted">Цена от</p>
          <p className="text-lg font-bold text-ink">{minPrice ? `${formatPriceRub(minPrice)} ₽` : '—'}</p>
          <p className="mt-1 text-xs text-ink-muted">{delivery}</p>
        </div>
        {resolving ? (
          <span className="text-xs text-ink-faint">…</span>
        ) : href ? (
          <Link to={href} className={linkClass}>
            Открыть
          </Link>
        ) : (
          <button type="button" onClick={handleClick} className={linkClass}>
            Открыть
          </button>
        )}
      </div>
    </Card>
  );
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

  const linkClass = 'font-medium text-brand-600 hover:text-brand-800';

  return (
    <tr className="border-b border-line-soft last:border-0">
      <td className="px-3 py-2 text-ink-soft">{brand}</td>
      <td className="px-3 py-2 text-ink-soft">{article}</td>
      <td className="px-3 py-2 text-ink-soft">{name}</td>
      <td className="px-3 py-2 font-medium text-ink">
        {minPrice ? `${formatPriceRub(minPrice)} ₽` : '—'}
      </td>
      <td className="px-3 py-2 text-ink-muted">{delivery}</td>
      <td className="px-3 py-2">
        {resolving ? (
          <span className="text-xs text-ink-faint">…</span>
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
  const markupPercent = useNewPartsMarkupPercent('auto');

  if (loading) {
    return <p className="text-sm text-ink-muted">Загрузка аналогов…</p>;
  }
  if (!analogParts.length) {
    return <p className="text-sm text-ink-muted">Аналоги не найдены.</p>;
  }

  return (
    <>
      <div className="space-y-3 md:hidden">
        {analogParts.map((part, idx) => {
          const key = safeText(part?.guid) || `${safeText(part?.brand)}|${safeText(part?.partnumber)}|${idx}`;
          return (
            <AnalogMobileCard
              key={key}
              part={part}
              markupPercent={markupPercent}
              onNavigateCreate={onNavigateCreate}
            />
          );
        })}
      </div>

      <Card padding="none" className="hidden md:block">
        <NewPartHorizontalScroll className="p-0" hint="Листайте таблицу аналогов →" showHint={analogParts.length > 2}>
          <table className="min-w-[52rem] w-full text-left text-sm">
            <thead>
              <tr className="border-b border-line bg-surface-muted text-xs uppercase tracking-wide text-ink-muted">
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
        </NewPartHorizontalScroll>
      </Card>
    </>
  );
}
