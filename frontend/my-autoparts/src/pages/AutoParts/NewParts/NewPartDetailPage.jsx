import React, { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { apiAxiosUnauth } from '../../../utils/apiClient';
import { PageSeoHelmet } from '../../../utils/pageSeo';
import { SITE_ORIGIN } from '../../../utils/breadcrumbs';
import { buildNewPartDetailPath, parseNewPartDetailParam } from '../../../utils/partRoutes';
import NewPartProductCard from './NewPartProductCard';
import ProductCard from '../ProductCard';
import {
  buildRosskoLookupText,
  getRosskoParts,
  mapPartToStocksData,
  pickBestRosskoPart,
} from './rosskoHelpers';

const safeText = (value, fallback = '') => {
  if (typeof value === 'string') return value.trim() || fallback;
  if (typeof value === 'number') return String(value);
  if (!value) return fallback;
  if (typeof value === 'object') return value.msg || value.input || fallback;
  return fallback;
};

const formatError = (value) => {
  if (!value) return 'Не удалось загрузить карточку';
  if (typeof value === 'string') return value;
  if (Array.isArray(value)) return value.map((v) => formatError(v)).join('; ');
  if (typeof value === 'object') return safeText(value.msg || value.input, 'Не удалось загрузить карточку');
  return 'Не удалось загрузить карточку';
};

const stocksFromCardApi = (card) => {
  if (!Array.isArray(card?.stocks)) return [];
  return card.stocks
    .filter((stock) => stock?.stock_id)
    .map((stock) => ({
      stock_id: String(stock.stock_id),
      price: Number(stock.price) || 0,
      available_count: Number(stock.available_count) || 0,
      delivery_start: stock.delivery_start || null,
      delivery_end: stock.delivery_end || null,
    }))
    .filter((stock) => stock.price > 0 && stock.available_count > 0);
};

const buildPartFromCard = (card) => ({
  brand: safeText(card?.brand),
  partnumber: safeText(card?.article),
  name: safeText(card?.name),
  guid: safeText(card?.guid) || undefined,
});

const collectCrossParts = (part) => {
  let crossParts = part?.crosses?.Part;
  if (!crossParts) return [];
  return Array.isArray(crossParts) ? crossParts : [crossParts];
};

const dedupeById = (items) => {
  const seen = new Set();
  const unique = [];
  (items || []).forEach((item) => {
    const id = Number(item?.id);
    if (!id || seen.has(id)) return;
    seen.add(id);
    unique.push(item);
  });
  return unique;
};

const mapUsedToProductCard = (part) => ({
  id: part.id,
  title: safeText(part?.name) || `${safeText(part?.brand, '—')} ${safeText(part?.article, '—')}`.trim(),
  price: part?.price ? `${part.price} ₽` : '—',
  brand: safeText(part?.brand, '—'),
  article: safeText(part?.article, '—'),
  location: part?.storage_location?.address || '—',
  isNew: part?.is_new,
  quantity: part?.quantity || part?.available_count || 0,
  photos: part?.photos || [],
  videos: part?.videos || [],
  sellerName: part?.organization?.name || 'Продавец',
  phone: part?.organization?.phone || '+7 (999) 123-45-67',
});

export default function NewPartDetailPage() {
  const { cardId: cardIdParam } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const [rosskoData, setRosskoData] = useState(null);
  const [rosskoStatus, setRosskoStatus] = useState('idle');

  const parsed = useMemo(() => parseNewPartDetailParam(cardIdParam), [cardIdParam]);
  const numericCardId = Number(parsed.productId);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [card, setCard] = useState(null);
  const [usedMatches, setUsedMatches] = useState([]);
  const [usedMatchError, setUsedMatchError] = useState('');
  const [usedMatchLoading, setUsedMatchLoading] = useState(false);

  useEffect(() => {
    if (!numericCardId || Number.isNaN(numericCardId)) {
      setError('Некорректный идентификатор карточки');
      setLoading(false);
      return;
    }

    const run = async () => {
      setLoading(true);
      setError('');
      try {
        const response = await apiAxiosUnauth.get(`/public/new-parts/cards/${numericCardId}`);
        setCard(response?.data || null);
      } catch (e) {
        setError(formatError(e?.response?.data?.detail || e?.message));
      } finally {
        setLoading(false);
      }
    };
    run();
  }, [numericCardId]);

  useEffect(() => {
    if (!card?.brand || !card?.article) return;
    const run = async () => {
      setRosskoStatus('loading');
      try {
        const response = await apiAxiosUnauth.post('/rossko/GetSearch', {
          text: buildRosskoLookupText(card.article, card.brand),
          delivery_id: '000000001',
          address_id: 176458,
        });
        setRosskoData(response?.data || null);
        setRosskoStatus('succeeded');
      } catch (_e) {
        setRosskoData(null);
        setRosskoStatus('failed');
      }
    };
    run();
  }, [card?.brand, card?.article]);

  useEffect(() => {
    if (!card?.brand || !card?.article) {
      setUsedMatches([]);
      return;
    }
    const run = async () => {
      setUsedMatchLoading(true);
      setUsedMatchError('');
      try {
        const brandText = String(card.brand).trim();
        const articleText = String(card.article).trim();
        const queryText = `${brandText} ${articleText}`.trim();

        const [exactResp, catalogResp, analogResp] = await Promise.all([
          apiAxiosUnauth.get('/products/public/find-used-match', {
            params: { brand: brandText, article: articleText, limit: 20 },
          }),
          apiAxiosUnauth.get('/catalog/products', {
            params: {
              q: queryText,
              is_new: false,
              page: 1,
              page_size: 20,
              sort: 'created_at_desc',
            },
          }),
          apiAxiosUnauth.get('/search-products/search-used-parts', {
            params: { q: queryText, only_analogs: true },
          }),
        ]);

        const exactItems = Array.isArray(exactResp?.data) ? exactResp.data : [];
        const catalogItems = Array.isArray(catalogResp?.data?.items) ? catalogResp.data.items : [];
        const analogItems = Array.isArray(analogResp?.data?.analog_parts) ? analogResp.data.analog_parts : [];
        setUsedMatches(dedupeById([...exactItems, ...catalogItems, ...analogItems]));
      } catch (_e) {
        setUsedMatches([]);
        setUsedMatchError('Не удалось загрузить б/у варианты');
      } finally {
        setUsedMatchLoading(false);
      }
    };
    run();
  }, [card?.brand, card?.article]);

  useEffect(() => {
    if (!card?.id) return;
    const canonicalPath = buildNewPartDetailPath(card);
    if (canonicalPath && location.pathname !== canonicalPath) {
      navigate(canonicalPath, { replace: true });
    }
  }, [card, location.pathname, navigate]);

  const livePart = useMemo(() => {
    if (!card) return null;
    const fromRossko = pickBestRosskoPart(rosskoData, card.article, card.brand);
    if (fromRossko) return fromRossko;
    return buildPartFromCard(card);
  }, [card, rosskoData]);

  const liveStocks = useMemo(() => {
    const fromRossko = mapPartToStocksData(livePart);
    if (fromRossko.length > 0) return fromRossko;
    return stocksFromCardApi(card);
  }, [livePart, card]);

  const analogParts = useMemo(() => {
    const bestPart = livePart;
    const rosskoParts = getRosskoParts(rosskoData);
    const sourceParts = rosskoParts.length > 0 ? rosskoParts : (bestPart ? [bestPart] : []);
    if (!sourceParts.length) return [];
    const crosses = sourceParts.flatMap((part) => collectCrossParts(part));
    const mainGuid = safeText(bestPart?.guid);
    const seen = new Set();
    return crosses.filter((part) => {
      const guid = safeText(part?.guid);
      if (mainGuid && guid === mainGuid) return false;
      const key = guid || `${safeText(part?.brand)}|${safeText(part?.partnumber)}`;
      if (!key || seen.has(key)) return false;
      seen.add(key);
      return mapPartToStocksData(part).length > 0;
    });
  }, [livePart, rosskoData]);

  const backToListPath = location.state?.backTo || '/autoparts/new';

  const canonicalPath = card ? buildNewPartDetailPath(card) : `/autoparts/new/part/${cardIdParam || ''}`;

  const seo = useMemo(() => {
    const brand = safeText(card?.brand);
    const article = safeText(card?.article);
    const name = safeText(card?.name) || `${brand} ${article}`.trim();
    const priceText = card?.price != null ? `${Number(card.price).toFixed(2)} ₽. ` : '';
    return {
      title: `${brand} ${article} ${name} — новая запчасть | Свой Гараж`,
      description: `${priceText}${safeText(card?.description, name)} Доставка по России.`,
      canonicalUrl: `${SITE_ORIGIN}${canonicalPath}`,
      robots: 'index, follow',
    };
  }, [card, canonicalPath]);

  if (loading) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-10">
        <PageSeoHelmet seo={seo} />
        <div className="rounded-2xl border border-gray-200 bg-white px-6 py-8 text-center shadow-sm">
          <p className="text-gray-600">Загрузка карточки…</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-10">
        <PageSeoHelmet seo={seo} />
        <p className="text-red-600">{error}</p>
        <button
          type="button"
          onClick={() => navigate('/autoparts/new')}
          className="mt-4 rounded-lg bg-indigo-600 px-4 py-2 text-white hover:bg-indigo-700"
        >
          К новым запчастям
        </button>
      </div>
    );
  }

  const brand = safeText(card?.brand, '—');
  const article = safeText(card?.article, '—');
  const name = safeText(card?.name) || `${brand} ${article}`.trim();
  const description = safeText(card?.description, '');

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name,
    sku: article,
    mpn: article,
    description: description || name,
    brand: { '@type': 'Brand', name: brand },
    offers: {
      '@type': 'Offer',
      url: `${SITE_ORIGIN}${canonicalPath}`,
      priceCurrency: 'RUB',
      price: card?.price != null ? String(Number(card.price).toFixed(2)) : undefined,
      availability: Number(card?.stock_count || 0) > 0 ? 'https://schema.org/InStock' : 'https://schema.org/OutOfStock',
      itemCondition: 'https://schema.org/NewCondition',
    },
  };

  const analogsLoading = rosskoStatus === 'loading' && analogParts.length === 0;
  const hasLiveStocks = Boolean(livePart) && liveStocks.length > 0;

  const mainProductBlock = hasLiveStocks ? (
    <section className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm sm:p-5">
      <NewPartProductCard
        part={livePart}
        stocksData={liveStocks}
        sectionType="available"
        uniqueId={`detail-${numericCardId}`}
        isDetailView
      />
    </section>
  ) : (
    <section className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
      <p className="text-gray-600">Нет доступных складов для заказа.</p>
    </section>
  );

  return (
    <div className="mx-auto max-w-6xl px-4 py-6 sm:py-8">
      <PageSeoHelmet seo={seo} />
      <script type="application/ld+json">{JSON.stringify(jsonLd)}</script>

      <section className="mb-6 rounded-2xl border border-indigo-100 bg-gradient-to-r from-indigo-50 via-white to-sky-50 p-4 shadow-sm sm:p-6">
        <button
          type="button"
          onClick={() => navigate(backToListPath)}
          className="mb-3 text-sm font-medium text-indigo-600 hover:text-indigo-800"
        >
          ← К поиску новых запчастей
        </button>
        <h1 className="text-xl font-bold text-gray-900 sm:text-2xl">{name}</h1>
        <div className="mt-3 flex flex-wrap gap-2 text-xs sm:text-sm">
          <span className="rounded-full bg-white px-3 py-1 text-gray-700 shadow-sm">Бренд: {brand}</span>
          <span className="rounded-full bg-white px-3 py-1 text-gray-700 shadow-sm">Артикул: {article}</span>
        </div>
      </section>

      {mainProductBlock}

      {!usedMatchLoading && usedMatches.length > 0 && (
        <section className="mt-8">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-xl font-bold text-gray-900">Б/у варианты</h2>
            <span className="text-sm text-gray-500">{usedMatches.length} шт.</span>
          </div>
          <div
            className="-mx-4 flex gap-3 overflow-x-auto px-4 pb-1 snap-x snap-mandatory [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden max-md:touch-pan-x md:mx-0 md:grid md:grid-cols-2 md:gap-3 md:overflow-visible md:px-0 md:pb-0 lg:grid-cols-3 xl:grid-cols-4"
            aria-label="Б/у варианты — прокрутка по горизонтали"
          >
            {usedMatches.map((used) => (
              <div
                key={`used-${used.id}`}
                className="w-[78vw] max-w-[300px] shrink-0 snap-start sm:w-[260px] md:w-auto md:max-w-none md:shrink"
              >
                <ProductCard
                  part={mapUsedToProductCard(used)}
                  isTestOrganization
                  hideConditionAndQuantity
                />
              </div>
            ))}
          </div>
        </section>
      )}
      {!usedMatchLoading && usedMatchError && (
        <p className="mt-4 text-sm text-gray-500">{usedMatchError}</p>
      )}

      <section className="mt-8">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-xl font-bold text-gray-900">Аналоги</h2>
          {!analogsLoading && analogParts.length > 0 && (
            <span className="text-sm text-gray-500">{analogParts.length} шт.</span>
          )}
        </div>
        {analogsLoading && <p className="text-sm text-gray-500">Загрузка аналогов…</p>}
        {!analogsLoading && analogParts.length === 0 && (
          <p className="text-sm text-gray-500">Аналоги не найдены.</p>
        )}
        <div className="space-y-4 rounded-2xl border border-gray-200 bg-white p-4 shadow-sm sm:p-5">
          {analogParts.map((part, idx) => {
            const baseKey = safeText(part?.guid) || safeText(part?.partnumber) || 'analog';
            const uniqueId = `detail-analog-${baseKey}-${idx}`;
            return (
              <NewPartProductCard
                key={uniqueId}
                part={part}
                stocksData={mapPartToStocksData(part)}
                sectionType="analog"
                uniqueId={uniqueId}
              />
            );
          })}
        </div>
      </section>
    </div>
  );
}
