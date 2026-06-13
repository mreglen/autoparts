import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate, useParams, Link } from 'react-router-dom';
import { useSelector } from 'react-redux';
import { Helmet } from 'react-helmet-async';
import { apiAxiosUnauth } from '../../../utils/apiClient';
import { PageSeoHelmet } from '../../../utils/pageSeo';
import { SITE_ORIGIN } from '../../../utils/breadcrumbs';
import { resolveOgImageUrl } from '../../../utils/seoConstants';
import { buildNewPartDetailPath, parseNewPartDetailParam } from '../../../utils/partRoutes';
import { extractProductDescription, formatProductDisplayTitle } from '../../../utils/productDisplayName';
import NewPartProductCard from './NewPartProductCard';
import NewPartDeliveryStockBlock from './NewPartDeliveryStockBlock';
import NewPartAnalogsTable from './NewPartAnalogsTable';
import NewPartUsedMatchesBlock from './NewPartUsedMatchesBlock';
import { buildNewPartCardJsonLd, parseJsonLdString } from '../../../utils/productJsonLd';
import { buildNewPartStructuredDataGraph } from '../../../utils/productSeo';
import { buildNewPartCardKeywords } from '../../../utils/pageKeywords';
import {
  buildNewPartH1,
  buildNewPartSearchDescription,
  buildNewPartSearchTitle,
} from '../../../utils/productSearchSeo';
import { getMinStockPrice } from './newPartStockUtils';
import {
  buildRosskoLookupText,
  getRosskoParts,
  mapPartToStocksData,
  pickBestRosskoPart,
} from './rosskoHelpers';
import { extractCityFromAddress } from '../../../utils/organizationCity';
import { slugifyBrand } from '../../../utils/slugUtils';
import NewPartHorizontalScroll from './NewPartHorizontalScroll';

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

function normalizeUsedMatch(item) {
  const photo = item?.photos?.[0];
  const photoUrl = item?.photo_url
    || photo?.photo_url
    || photo?.list_photo_url
    || null;
  const org = item?.organization || null;
  const orgAddress = item?.organization_address || org?.address || null;
  return {
    id: item.id,
    brand: item.brand,
    article: item.article,
    name: item.name,
    price: item.price,
    photo_url: photoUrl,
    organization_name: item.organization_name || org?.name || null,
    organization_address: orgAddress,
    city: item.city || extractCityFromAddress(orgAddress),
    compatible_vehicles: Array.isArray(item.compatible_vehicles) ? item.compatible_vehicles : [],
  };
}

export default function NewPartDetailPage() {
  const { cardId: cardIdParam } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const markupPercent = useSelector((state) => state.publicInfo.newPartsMarkupPercent ?? 15);
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
  const [seoMeta, setSeoMeta] = useState(null);
  const [seoJsonLd, setSeoJsonLd] = useState(null);

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
        setUsedMatches(
          dedupeById([...exactItems, ...catalogItems, ...analogItems]).map(normalizeUsedMatch)
        );
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

  useEffect(() => {
    if (!card?.id) {
      setSeoMeta(null);
      setSeoJsonLd(null);
      return;
    }
    const path = buildNewPartDetailPath(card);
    if (!path) return;

    const run = async () => {
      try {
        const response = await apiAxiosUnauth.get('/public/new-part-meta', { params: { path } });
        const data = response?.data || null;
        if (data?.title && data?.description && data?.canonical_url) {
          setSeoMeta({
            title: data.title,
            description: data.description,
            canonicalUrl: data.canonical_url,
            robots: 'index, follow',
            ogType: 'product',
            ogImage: data.image_url || resolveOgImageUrl(card?.image_url),
            price: data.price,
            keywords: data.keywords || '',
          });
        } else {
          setSeoMeta(null);
        }
        setSeoJsonLd(parseJsonLdString(data?.json_ld));
      } catch (_e) {
        setSeoMeta(null);
        setSeoJsonLd(null);
      }
    };
    run();
  }, [card]);

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

  const displayPrice = useMemo(
    () => getMinStockPrice(liveStocks, markupPercent) ?? getMinStockPrice(stocksFromCardApi(card), markupPercent),
    [liveStocks, card, markupPercent]
  );

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
    if (seoMeta) return seoMeta;
    if (!card) return null;
    const brand = safeText(card?.brand);
    const article = safeText(card?.article);
    const ogImageRaw = card?.image_url;
    const ogImage = ogImageRaw
      ? (ogImageRaw.startsWith('http') ? ogImageRaw : resolveOgImageUrl(ogImageRaw.startsWith('/') ? ogImageRaw : `/${ogImageRaw}`))
      : resolveOgImageUrl(null);
    return {
      title: buildNewPartSearchTitle({
        brand,
        article,
        rawName: card?.name,
        cardId: card.id,
        price: displayPrice,
      }),
      description: buildNewPartSearchDescription({
        brand,
        article,
        rawName: card?.name,
        cardId: card.id,
        price: displayPrice,
        inStock: (card?.stock_count || 0) > 0,
        uniqueDescription: card?.description,
      }),
      canonicalUrl: `${SITE_ORIGIN}${canonicalPath}`,
      robots: 'index, follow',
      ogType: 'product',
      ogImage,
      price: displayPrice,
      keywords: buildNewPartCardKeywords({ brand, article }),
    };
  }, [seoMeta, card, canonicalPath, displayPrice]);

  const handleAnalogNavigateCreate = useCallback(async (part) => {
    const brand = safeText(part?.brand);
    const article = safeText(part?.partnumber || part?.article);
    const stocks = mapPartToStocksData(part);
    const mainStock = stocks[0];
    const displayTitle = formatProductDisplayTitle(brand, article, safeText(part?.name));
    try {
      const payload = {
        source: 'rossko',
        supplier_stock_id: String(mainStock?.stock_id || ''),
        brand,
        article,
        name: displayTitle,
        description: extractProductDescription(part?.name, brand, article),
        price: mainStock?.price ?? null,
        currency: 'RUB',
        stock_count: Number(mainStock?.available_count) || 0,
        delivery_start: mainStock?.delivery_start || null,
        delivery_end: mainStock?.delivery_end || null,
        image_url: null,
        guid: part?.guid ? String(part.guid) : null,
        stocks: stocks.map((stock) => ({
          stock_id: String(stock.stock_id),
          price: stock.price,
          available_count: Number(stock.available_count) || 0,
          delivery_start: stock.delivery_start || null,
          delivery_end: stock.delivery_end || null,
        })),
      };
      const response = await apiAxiosUnauth.post('/public/new-parts/cards/create-or-get', payload);
      const cardData = response?.data;
      const cardId = Number(cardData?.id);
      if (cardId > 0) {
        navigate(
          buildNewPartDetailPath(cardData) || cardData?.canonical_url || `/autoparts/new/part/${cardId}`,
          { state: { backTo: backToListPath } }
        );
      }
    } catch (_e) {
      // ignore
    }
  }, [navigate, backToListPath]);

  if (loading) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-10">
        {seo ? <PageSeoHelmet seo={seo} /> : null}
        <div className="rounded-2xl border border-gray-200 bg-white px-6 py-8 text-center shadow-sm">
          <p className="text-gray-600">Загрузка карточки…</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-10">
        <Helmet>
          <title>Карточка не найдена | Свой Гараж</title>
          <meta name="robots" content="noindex, nofollow" />
        </Helmet>
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
  const pageH1 = buildNewPartH1({ brand, article, rawName: card?.name });
  const canonicalUrl = `${SITE_ORIGIN}${canonicalPath}`;

  const parsedApiJsonLd = seoJsonLd;
  const productJsonLd = parsedApiJsonLd?.['@graph']
    ? parsedApiJsonLd['@graph'].find((node) => node?.['@type'] === 'Product')
    : parsedApiJsonLd?.['@type'] === 'Product'
      ? parsedApiJsonLd
      : buildNewPartCardJsonLd(card, { canonicalUrl, displayPrice });

  const structuredData = parsedApiJsonLd?.['@graph']
    ? parsedApiJsonLd
    : buildNewPartStructuredDataGraph({
        productJsonLd,
        canonicalUrl,
        title: seo?.title,
        description: seo?.description,
        brand,
        article,
        cardName: card?.name,
      });

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
    <div className="mx-auto max-w-6xl px-3 py-4 sm:px-4 sm:py-6 md:py-8">
      <PageSeoHelmet seo={seo} />
      {structuredData ? <script type="application/ld+json">{JSON.stringify(structuredData)}</script> : null}

      <section className="mb-4 rounded-2xl border border-indigo-100 bg-gradient-to-r from-indigo-50 via-white to-sky-50 p-4 shadow-sm sm:mb-6 sm:p-6">
        <button
          type="button"
          onClick={() => navigate(backToListPath)}
          className="mb-3 min-h-[44px] text-sm font-medium text-indigo-600 hover:text-indigo-800"
        >
          ← К поиску новых запчастей
        </button>
        <h1 className="text-lg font-bold leading-snug text-gray-900 sm:text-2xl">{pageH1}</h1>
        <NewPartHorizontalScroll className="mt-3" hint="Листайте теги →" showHint={false}>
          <div className="flex flex-nowrap gap-2 pb-0.5 text-xs sm:flex-wrap sm:text-sm">
            <span className="shrink-0 rounded-full bg-white px-3 py-1.5 text-gray-700 shadow-sm">Бренд: {brand}</span>
            <span className="shrink-0 rounded-full bg-white px-3 py-1.5 text-gray-700 shadow-sm">Артикул: {article}</span>
            {slugifyBrand(brand) ? (
              <Link
                to={`/autoparts/new/brand/${encodeURIComponent(slugifyBrand(brand))}`}
                className="shrink-0 rounded-full border border-indigo-200 bg-indigo-50 px-3 py-1.5 font-medium text-indigo-700 shadow-sm hover:bg-indigo-100"
              >
                Все новые {brand}
              </Link>
            ) : null}
          </div>
        </NewPartHorizontalScroll>
      </section>

      <NewPartDeliveryStockBlock
        stocks={liveStocks}
        inStock={(card?.stock_count || 0) > 0}
      />

      {mainProductBlock}

      <NewPartUsedMatchesBlock
        brand={brand}
        article={article}
        items={usedMatches}
        loading={usedMatchLoading}
        error={usedMatchError}
      />

      <section className="mt-8">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-xl font-bold text-gray-900">Аналоги</h2>
          {!analogsLoading && analogParts.length > 0 && (
            <span className="text-sm text-gray-500">{analogParts.length} шт.</span>
          )}
        </div>
        <NewPartAnalogsTable
          analogParts={analogParts}
          loading={analogsLoading}
          onNavigateCreate={handleAnalogNavigateCreate}
        />
      </section>
    </div>
  );
}
