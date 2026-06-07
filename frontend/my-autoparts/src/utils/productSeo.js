import { stripHtmlTags } from './text';
import { buildPartDetailPath } from './partRoutes';
import { formatProductDisplayTitle, extractProductDescription } from './productDisplayName';
import { normalizeImageUrl } from './apiClient';
import { resolveOgImageUrl } from './seoConstants';
import {
  buildProductSearchDescription,
  buildProductSearchTitle,
  resolveProductCity,
} from './productSearchSeo';
import { buildCatalogProductJsonLd } from './productJsonLd';

const SITE_ORIGIN = 'https://svoygarage.ru';

export function buildProductSeo(product) {
  const brand = (product?.brand || '').trim();
  const article = (product?.article || '').trim();
  const name = formatProductDisplayTitle(brand, article, product?.name) || 'Автозапчасть';
  const shortName = extractProductDescription(product?.name, brand, article);
  const path = buildPartDetailPath(product);
  const canonicalUrl = `${SITE_ORIGIN}${path}`;
  const organization = product?.organization || null;
  const sellerName = organization?.name || null;
  const listingId = product?.id != null ? Number(product.id) : null;
  const title = buildProductSearchTitle({
    brand,
    article,
    productName: product?.name,
    sellerName,
    listingId,
  });
  const city = resolveProductCity(organization);
  const inStock = (product?.quantity || 0) > 0;

  const uniqueDesc = stripHtmlTags(product?.description || '').replace(/\s+/g, ' ').trim();
  const description = buildProductSearchDescription({
    brand,
    article,
    isNew: Boolean(product?.is_new),
    city,
    price: product?.price,
    inStock,
    shortName,
    uniqueDescription: uniqueDesc,
    sellerName,
    listingId,
  });

  const firstPhoto = product?.photos?.[0]?.photo_url;
  const imageUrl = resolveOgImageUrl(firstPhoto ? normalizeImageUrl(firstPhoto) : null);
  const jsonLd = buildCatalogProductJsonLd(product, { canonicalUrl });

  return { title, description, canonicalUrl, imageUrl, jsonLd, robots: 'index, follow' };
}

export function seoFromPartMetaResponse(meta) {
  if (!meta?.title || !meta?.description || !meta?.canonical_url) return null;
  return {
    title: meta.title,
    description: meta.description,
    canonicalUrl: meta.canonical_url,
    imageUrl: meta.image_url || resolveOgImageUrl(null),
    robots: 'index, follow',
  };
}
