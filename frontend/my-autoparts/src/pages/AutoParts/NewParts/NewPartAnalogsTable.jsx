import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import useNewPartsMarkupPercent from '../../../hooks/useNewPartsMarkupPercent';
import { Badge, Card, SkeletonCard } from '../../../components/UI';
import { apiAxiosUnauth } from '../../../utils/apiClient';
import { buildNewPartDetailPath } from '../../../utils/partRoutes';
import { extractProductDescription } from '../../../utils/productDisplayName';
import { mapPartToStocksData } from './rosskoHelpers';
import {
  formatDeliveryParts,
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

function pickEarliestStock(stocks) {
  return stocks.reduce((best, stock) => {
    if (!best) return stock;
    const a = new Date(stock.delivery_start).getTime();
    const b = new Date(best.delivery_start).getTime();
    return Number.isFinite(a) && a < b ? stock : best;
  }, null);
}

function AnalogItem({ part, markupPercent, onNavigateCreate }) {
  const [href, setHref] = useState(null);
  const stocks = mapPartToStocksData(part).filter(
    (stock) => stock.price > 0 && stock.available_count > 0,
  );
  const minPrice = getMinStockPrice(stocks, markupPercent);
  const totalQty = stocks.reduce((sum, stock) => sum + (Number(stock.available_count) || 0), 0);
  const earliest = pickEarliestStock(stocks);
  const delivery = earliest ? formatDeliveryParts(earliest.delivery_start, earliest.delivery_end) : null;
  const soon = delivery?.dateLine === 'Сегодня' || delivery?.dateLine === 'Завтра';
  const brand = safeText(part?.brand);
  const article = safeText(part?.partnumber || part?.article);
  const name = extractProductDescription(safeText(part?.name, ''), brand, article) || `${brand} ${article}`.trim();

  useEffect(() => {
    let cancelled = false;
    resolveAnalogUrl(part).then((url) => {
      if (!cancelled) setHref(url);
    });
    return () => {
      cancelled = true;
    };
  }, [part]);

  const body = (
    <>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-1.5">
          <Badge>{brand}</Badge>
          <Badge className="font-mono">{article}</Badge>
          {soon ? <Badge tone="success">Быстро</Badge> : null}
        </div>
        <p className="mt-2 line-clamp-2 text-sm font-medium leading-snug text-ink">{name}</p>
        <p className="mt-1 text-xs text-ink-muted">
          {delivery ? `${delivery.dateLine}, ${delivery.timeLine}` : 'Срок уточняется'}
          {totalQty ? ` · ${totalQty} шт.` : ''}
        </p>
      </div>
      <div className="flex shrink-0 items-center justify-between gap-3 sm:flex-col sm:items-end sm:justify-center">
        <div className="text-left sm:text-right">
          <p className="text-[11px] text-ink-muted">Цена от</p>
          <p className="text-lg font-bold tabular-nums leading-tight text-ink">
            {minPrice ? `${formatPriceRub(minPrice)} ₽` : '—'}
          </p>
        </div>
        <span className="inline-flex h-9 items-center rounded-lg bg-brand-50 px-3 text-sm font-semibold text-brand-700 transition group-hover:bg-brand-600 group-hover:text-white">
          Открыть
        </span>
      </div>
    </>
  );

  const className = 'group flex w-full flex-col gap-3 rounded-sg-lg border border-line bg-surface p-4 text-left shadow-sg transition hover:border-brand-200 hover:shadow-sg-md sm:flex-row sm:items-center';

  if (href) {
    return (
      <Link to={href} className={className}>
        {body}
      </Link>
    );
  }
  return (
    <button type="button" onClick={() => onNavigateCreate(part)} className={className}>
      {body}
    </button>
  );
}

export default function NewPartAnalogsTable({ analogParts, loading, onNavigateCreate }) {
  const markupPercent = useNewPartsMarkupPercent('auto');

  if (loading) {
    return (
      <div className="grid gap-3 lg:grid-cols-2">
        <SkeletonCard lines={3} />
        <SkeletonCard lines={3} />
      </div>
    );
  }
  if (!analogParts.length) {
    return (
      <Card padding="sm">
        <p className="text-sm text-ink-muted">Аналоги по этому запросу не найдены.</p>
      </Card>
    );
  }

  return (
    <div className="grid gap-3 lg:grid-cols-2">
      {analogParts.map((part, idx) => {
        const key = safeText(part?.guid) || `${safeText(part?.brand)}|${safeText(part?.partnumber)}|${idx}`;
        return (
          <AnalogItem
            key={key}
            part={part}
            markupPercent={markupPercent}
            onNavigateCreate={onNavigateCreate}
          />
        );
      })}
    </div>
  );
}
