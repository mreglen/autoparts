import { stripHtmlTags } from './text';
import { buildPartDetailPath } from './partRoutes';
import { formatProductDisplayTitle, extractProductDescription } from './productDisplayName';
import { normalizeImageUrl } from './apiClient';
import {
  buildProductAlternateNames,
  buildProductOfferJsonLd,
  buildProductSearchDescription,
  buildProductSearchTitle,
  resolveProductCity,
} from './productSearchSeo';

const SITE_ORIGIN = 'https://svoygarage.ru';

export function buildPreliminaryPartTitle({ brand, article }) {
  const brandStr = String(brand || '').trim();
  const articleStr = String(article || '').trim();
  if (!brandStr && !articleStr) return null;
  return buildProductSearchTitle({ brand: brandStr, article: articleStr });
}

export function buildPreliminaryPartDescription({ brand, article, isNew = false, organization = null }) {
  const brandStr = String(brand || '').trim();
  const articleStr = String(article || '').trim();
  if (!brandStr && !articleStr) return null;
  return buildProductSearchDescription({
    brand: brandStr,
    article: articleStr,
    isNew,
    city: resolveProductCity(organization),
  });
}

export function buildProductSeo(product) {
  const brand = (product?.brand || '').trim();
  const article = (product?.article || '').trim();
  const name = formatProductDisplayTitle(brand, article, product?.name) || 'Автозапчасть';
  const shortName = extractProductDescription(product?.name, brand, article);
  const path = buildPartDetailPath(product);
  const canonicalUrl = `${SITE_ORIGIN}${path}`;
  const title = buildProductSearchTitle({ brand, article, fallbackDisplayName: name });
  const organization = product?.organization || null;
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
  });

  const firstPhoto = product?.photos?.[0]?.photo_url;
  const imageUrl = firstPhoto ? normalizeImageUrl(firstPhoto) : null;
  const alternateName = buildProductAlternateNames({ brand, article });
  const priceValue =
    product?.price != null && Number(product.price) > 0
      ? Number(product.price).toFixed(2)
      : null;

  const offers = buildProductOfferJsonLd({
    canonicalUrl,
    price: priceValue,
    inStock,
    isNew: Boolean(product?.is_new),
    sellerName: organization?.name,
    sellerPhone: organization?.phone,
    sellerAddress: organization?.address,
    city,
  });

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name,
    sku: article || undefined,
    mpn: article || undefined,
    alternateName: alternateName.length > 0 ? alternateName : undefined,
    description,
    brand: brand ? { '@type': 'Brand', name: brand } : undefined,
    image: imageUrl ? [imageUrl] : undefined,
    offers,
  };

  return { title, description, canonicalUrl, imageUrl, jsonLd };
}
