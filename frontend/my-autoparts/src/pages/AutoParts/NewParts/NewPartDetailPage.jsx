import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate, useParams, Link } from 'react-router-dom';
import { useSelector } from 'react-redux';
import { Helmet } from 'react-helmet-async';
import { apiAxiosUnauth } from '../../../utils/apiClient';
import { PageSeoHelmet } from '../../../utils/pageSeo';
import { SITE_ORIGIN, buildBreadcrumbJsonLd, buildBreadcrumbsForPath } from '../../../utils/breadcrumbs';
import { resolveOgImageUrl } from '../../../utils/seoConstants';
import { buildNewPartDetailPath, parseNewPartDetailParam } from '../../../utils/partRoutes';
import { extractProductDescription, formatProductDisplayTitle } from '../../../utils/productDisplayName';
import Breadcrumbs from '../../../components/Breadcrumbs/Breadcrumbs';
import PartDetailFaqBlock from '../../PartDetail/PartDetailFaqBlock';
import PartDetailAboutBlock from '../../PartDetail/PartDetailAboutBlock';
import PartDetailFitmentBlock from '../../PartDetail/PartDetailFitmentBlock';
import PartDetailSeoCrossLinks from '../../PartDetail/PartDetailSeoCrossLinks';
import { mapLaximoApplicableVehicles } from '../../../utils/fitmentDisplay';
import NewPartProductCard from './NewPartProductCard';
import NewPartDeliveryStockBlock from './NewPartDeliveryStockBlock';
import NewPartAnalogsTable from './NewPartAnalogsTable';
import NewPartUsedMatchesBlock from './NewPartUsedMatchesBlock';
import { buildNewPartCardJsonLd } from '../../../utils/productJsonLd';
import { buildProductStructuredDataBlocks, seoFromNewPartMetaResponse } from '../../../utils/productSeo';
import { buildProductFaqJsonLd } from '../../../utils/partDetailFaq';
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
import useHistoryBack from '../../../hooks/useHistoryBack';
import useDeferredMount from '../../../hooks/useDeferredMount';
import {
  PART_DETAIL_CACHE,
  readPartDetailCache,
  writePartDetailCache,
} from '../../../utils/partDetailCache';
import { Badge, Button, Card, EmptyState, SectionHeader, SkeletonCard } from '../../../components/UI';

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
  const markupPercent = useSelector((state) => state.publicInfo.newPartsMarkupPercent ?? 30);
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
  const [apiSeo, setApiSeo] = useState(null);
  const [referenceVehicles, setReferenceVehicles] = useState([]);
  const [fitmentLoading, setFitmentLoading] = useState(false);
  const [fitmentMeta, setFitmentMeta] = useState(null);

  const cardReady = Boolean(card?.id);
  const { enabled: secondaryEnabled } = useDeferredMount({
    mode: 'idle',
    active: cardReady && !loading && !error,
    idleTimeoutMs: 1200,
  });
  const { enabled: analogsVisible, sentinelRef: analogsSentinelRef } = useDeferredMount({
    mode: 'idle-or-visible',
    active: cardReady && !loading && !error,
    rootMargin: '200px',
    idleTimeoutMs: 1800,
  });

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
    if (!secondaryEnabled || !card?.brand || !card?.article) {
      if (!card?.brand || !card?.article) setUsedMatches([]);
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
  }, [secondaryEnabled, card?.brand, card?.article]);

  useEffect(() => {
    if (!card?.id) return;
    const canonicalPath = buildNewPartDetailPath(card);
    if (canonicalPath && location.pathname !== canonicalPath) {
      navigate(canonicalPath, { replace: true });
    }
  }, [card, location.pathname, navigate]);

  useEffect(() => {
    if (!secondaryEnabled || !card?.id) {
      if (!card?.id) setApiSeo(null);
      return;
    }
    const path = buildNewPartDetailPath(card);
    if (!path) return;

    const run = async () => {
      try {
        const response = await apiAxiosUnauth.get('/public/new-part-meta', { params: { path } });
        setApiSeo(seoFromNewPartMetaResponse(response?.data));
      } catch (_e) {
        setApiSeo(null);
      }
    };
    run();
  }, [secondaryEnabled, card]);

  useEffect(() => {
    if (!secondaryEnabled || !card?.brand || !card?.article) {
      if (!card?.brand || !card?.article) {
        setReferenceVehicles([]);
        setFitmentMeta(null);
      }
      return undefined;
    }
    const brandText = String(card.brand).trim();
    const articleText = String(card.article).trim();
    const fitmentKey = `${brandText}|${articleText}|new`;
    const cached = readPartDetailCache(PART_DETAIL_CACHE.referenceFitment, fitmentKey);
    if (cached !== null) {
      setReferenceVehicles(Array.isArray(cached) ? cached : []);
      setFitmentMeta({ checked: true });
      setFitmentLoading(false);
      return undefined;
    }

    let cancelled = false;
    setFitmentLoading(true);
    (async () => {
      try {
        const [refResponse, laximoResponse] = await Promise.all([
          apiAxiosUnauth.get('/public/part-reference-fitment', {
            params: { brand: brandText, article: articleText },
          }),
          apiAxiosUnauth
            .post('/public/laximo/oem/applicable-vehicles', {
              oem: articleText,
              brand: brandText,
            })
            .catch(() => null),
        ]);
        const vehicles = Array.isArray(refResponse?.data?.vehicles)
          ? refResponse.data.vehicles
          : [];
        const laximoData = laximoResponse?.data;
        const laximoOk = laximoData?.ok !== false;
        const laximoRows = laximoOk
          ? mapLaximoApplicableVehicles(laximoData?.vehicles)
          : [];
        const merged = [...vehicles, ...laximoRows];
        if (!cancelled) {
          writePartDetailCache(PART_DETAIL_CACHE.referenceFitment, fitmentKey, merged);
          setReferenceVehicles(merged);
          setFitmentMeta({
            checked: true,
            laximoOk,
            coverage: laximoData?.coverage || (laximoRows.length ? 'full' : 'none'),
            dataSource: laximoData?.data_source || (laximoRows.length ? 'laximo' : 'none'),
            fitmentStatus: laximoData?.fitment_status || null,
          });
        }
      } catch (_e) {
        if (!cancelled) {
          writePartDetailCache(PART_DETAIL_CACHE.referenceFitment, fitmentKey, []);
          setReferenceVehicles([]);
          setFitmentMeta({ checked: true, laximoOk: false, coverage: 'none' });
        }
      } finally {
        if (!cancelled) setFitmentLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [secondaryEnabled, card?.brand, card?.article]);

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

  const seoPrice = useMemo(
    () => getMinStockPrice(liveStocks, 0) ?? getMinStockPrice(stocksFromCardApi(card), 0),
    [liveStocks, card]
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
  const handleBackToList = useHistoryBack('/autoparts/new');
  const canonicalPath = card ? buildNewPartDetailPath(card) : `/autoparts/new/part/${cardIdParam || ''}`;

  const seo = useMemo(() => {
    if (apiSeo) return apiSeo;
    if (!card) return null;
    const brand = safeText(card?.brand);
    const article = safeText(card?.article);
    const ogImageRaw = card?.image_url;
    const ogImage = ogImageRaw
      ? (ogImageRaw.startsWith('http') ? ogImageRaw : resolveOgImageUrl(ogImageRaw.startsWith('/') ? ogImageRaw : `/${ogImageRaw}`))
      : resolveOgImageUrl(null);
    const inStock = (card?.stock_count || 0) > 0 || liveStocks.length > 0;
    return {
      title: buildNewPartSearchTitle({
        brand,
        article,
        rawName: card?.name,
        cardId: card.id,
        price: seoPrice,
      }),
      description: buildNewPartSearchDescription({
        brand,
        article,
        rawName: card?.name,
        cardId: card.id,
        price: seoPrice,
        inStock,
        uniqueDescription: card?.description,
      }),
      canonicalUrl: `${SITE_ORIGIN}${canonicalPath}`,
      robots: inStock ? 'index, follow' : 'noindex, follow',
      ogType: 'product',
      ogImage,
      price: displayPrice,
      inStock,
      keywords: buildNewPartCardKeywords({ brand, article }),
    };
  }, [apiSeo, card, canonicalPath, displayPrice, seoPrice, liveStocks.length]);

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
      <div className="mx-auto max-w-6xl px-3 py-6 sm:px-4">
        {seo ? <PageSeoHelmet seo={seo} /> : null}
        <SkeletonCard lines={5} className="min-h-56" />
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
        <EmptyState
          illustration="error"
          title="Карточка не найдена"
          description={error}
          actionLabel="К новым запчастям"
          onAction={handleBackToList}
        />
      </div>
    );
  }

  const brand = safeText(card?.brand, '—');
  const article = safeText(card?.article, '—');
  const pageH1 = apiSeo?.h1 || buildNewPartH1({ brand, article, rawName: card?.name });
  const canonicalUrl = `${SITE_ORIGIN}${canonicalPath}`;
  const inStock = apiSeo?.inStock ?? ((card?.stock_count || 0) > 0 || liveStocks.length > 0);
  const partTypeName = apiSeo?.partTypeName || extractProductDescription(card?.name, brand, article);
  const bodyDescription = apiSeo?.bodyDescription || apiSeo?.seoSummary || '';
  const usedCatalogPath = apiSeo?.usedCatalogPath
    || `/autoparts/used?q=${encodeURIComponent(`${brand} ${article}`.trim())}`;

  const parsedApiJsonLd = apiSeo?.jsonLd;
  const productJsonLd = parsedApiJsonLd?.['@graph']
    ? parsedApiJsonLd['@graph'].find((node) => node?.['@type'] === 'Product')
    : parsedApiJsonLd?.['@type'] === 'Product'
      ? parsedApiJsonLd
      : buildNewPartCardJsonLd(card, {
          canonicalUrl,
          displayPrice,
          schemaName: apiSeo?.schemaName,
        });

  const breadcrumbItems = buildBreadcrumbsForPath(canonicalPath, { brand, article, cardName: card?.name });
  const breadcrumbJsonLd = buildBreadcrumbJsonLd(breadcrumbItems);
  const faqJsonLd = apiSeo?.faqJsonLd || buildProductFaqJsonLd({
    canonicalUrl,
    brand,
    article,
    partTypeName,
    isNew: true,
    city: apiSeo?.city,
    fitmentText: apiSeo?.fitmentText,
    inStock,
    quantity: apiSeo?.quantity || liveStocks.reduce((sum, row) => sum + (Number(row.available_count) || 0), 0),
    price: seoPrice ?? displayPrice,
    stockSummary: apiSeo?.stockSummary,
  });
  const faqItems = apiSeo?.faqItems || null;
  const structuredDataBlocks = buildProductStructuredDataBlocks({
    productJsonLd,
    breadcrumbJsonLd,
    faqJsonLd,
  });

  const analogsLoading = rosskoStatus === 'loading' && analogParts.length === 0;
  const hasLiveStocks = Boolean(livePart) && liveStocks.length > 0;

  const mainProductBlock = hasLiveStocks ? (
    <NewPartProductCard
      part={livePart}
      stocksData={liveStocks}
      sectionType="available"
      uniqueId={`detail-${numericCardId}`}
      isDetailView
    />
  ) : (
    <EmptyState
      title="Нет доступных складов"
      description="Сейчас эту деталь нельзя добавить в корзину. Проверьте аналоги ниже."
    />
  );

  return (
    <div className="mx-auto max-w-6xl px-3 py-4 max-md:pb-28 sm:px-4 sm:py-6 md:py-8">
      <PageSeoHelmet seo={seo} />
      <Helmet>
        {structuredDataBlocks.map((block) => (
          <script key={block['@type'] || block['@id']} type="application/ld+json">
            {JSON.stringify(block)}
          </script>
        ))}
      </Helmet>

      <Breadcrumbs items={breadcrumbItems} includeJsonLd={false} />

      <Card as="section" className="mb-4 border-brand-100 bg-brand-50/30 sm:mb-6" padding="md">
        <Button
          variant="ghost"
          size="sm"
          onClick={handleBackToList}
          className="-ml-2 mb-3"
        >
          ← К поиску новых запчастей
        </Button>
        <div className="grid gap-5 sm:grid-cols-[minmax(0,1fr)_9rem] sm:items-center">
          <div className="min-w-0">
            <h1 className="text-xl font-bold leading-snug text-ink sm:text-2xl">{pageH1}</h1>
        <NewPartHorizontalScroll className="mt-3" hint="Листайте теги →" showHint={false}>
          <div className="flex flex-nowrap gap-2 pb-0.5 text-xs sm:flex-wrap sm:text-sm">
            <Badge className="shrink-0">Бренд: {brand}</Badge>
            <Badge className="shrink-0">Артикул: {article}</Badge>
            <Badge tone={inStock ? 'success' : 'warning'} className="shrink-0">
              {inStock ? 'В наличии' : 'Под заказ'}
            </Badge>
            {slugifyBrand(brand) ? (
              <Link
                to={`/autoparts/new/brand/${encodeURIComponent(slugifyBrand(brand))}`}
                className="shrink-0 rounded-full border border-brand-200 bg-brand-50 px-3 py-1.5 font-semibold text-brand-700 hover:bg-brand-100"
              >
                Все новые {brand}
              </Link>
            ) : null}
          </div>
        </NewPartHorizontalScroll>
        <PartDetailSeoCrossLinks
          brand={brand}
          article={article}
          isNew
          usedCatalogPath={usedCatalogPath}
        />
          </div>
          {card?.image_url ? (
            <div className="hidden h-32 overflow-hidden rounded-sg border border-line bg-surface sm:block">
              <img
                src={card.image_url.startsWith('http') ? card.image_url : resolveOgImageUrl(card.image_url)}
                alt={`${brand} ${article}`}
                className="h-full w-full object-contain p-2"
              />
            </div>
          ) : (
            <div className="hidden h-32 items-center justify-center rounded-sg border border-line bg-surface text-ink-faint sm:flex">
              <svg className="h-10 w-10" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
              </svg>
            </div>
          )}
        </div>
      </Card>

      {mainProductBlock}

      <div className="mt-4">
        <NewPartDeliveryStockBlock
          stocks={liveStocks}
          inStock={inStock}
        />
      </div>

      <div className="mt-6 space-y-4">
        <PartDetailAboutBlock bodyDescription={bodyDescription} isNew />
        <PartDetailFitmentBlock
          sellerVehicles={[]}
          referenceVehicles={referenceVehicles}
          loading={secondaryEnabled ? fitmentLoading : true}
          fitmentMeta={fitmentMeta}
        />
      </div>

      <NewPartUsedMatchesBlock
        brand={brand}
        article={article}
        items={usedMatches}
        loading={secondaryEnabled ? usedMatchLoading : true}
        error={usedMatchError}
      />

      {secondaryEnabled ? (
        <div className="mt-6">
          <PartDetailFaqBlock
            brand={brand}
            article={article}
            partTypeName={partTypeName}
            isNew
            city={apiSeo?.city}
            fitmentText={apiSeo?.fitmentText}
            inStock={inStock}
            items={faqItems}
          />
        </div>
      ) : null}

      <section className="mt-8" ref={analogsSentinelRef}>
        <SectionHeader
          title="Аналоги"
          action={analogsVisible && !analogsLoading && analogParts.length > 0
            ? <Badge>{analogParts.length} шт.</Badge>
            : null}
          className="mb-4"
        />
        {analogsVisible ? (
          <NewPartAnalogsTable
            analogParts={analogParts}
            loading={analogsLoading}
            onNavigateCreate={handleAnalogNavigateCreate}
          />
        ) : (
          <div className="rounded-sg-lg border border-line bg-surface p-5 text-sm text-ink-muted shadow-sg">
            Загрузка аналогов…
          </div>
        )}
      </section>
    </div>
  );
}
