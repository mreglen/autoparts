import { stripHtmlTags } from './text';
import { buildPartDetailPath } from './partRoutes';
import { formatProductDisplayTitle } from './productDisplayName';
import { normalizeImageUrl } from './apiClient';

const SITE_ORIGIN = 'https://svoygarage.ru';

export function buildPreliminaryPartTitle({ brand, article }) {
  const brandStr = String(brand || '').trim();
  const articleStr = String(article || '').trim();
  if (!brandStr && !articleStr) return null;
  const name = [brandStr, articleStr].filter(Boolean).join(' ');
  return `${name} | Свой Гараж`.replace(/\s+/g, ' ').trim();
}

export function buildProductSeo(product) {
  const brand = (product?.brand || '').trim();
  const article = (product?.article || '').trim();
  const name = formatProductDisplayTitle(brand, article, product?.name) || 'Автозапчасть';
  const conditionLabel = product?.is_new ? 'новая' : 'б/у';
  const path = buildPartDetailPath(product);
  const canonicalUrl = `${SITE_ORIGIN}${path}`;
  const title = `${name} | Свой Гараж`.replace(/\s+/g, ' ').trim();

  const uniqueDesc = stripHtmlTags(product?.description || '').replace(/\s+/g, ' ').trim();
  const description =
    uniqueDesc.length > 40
      ? uniqueDesc.slice(0, 160)
      : `${conditionLabel.charAt(0).toUpperCase()}${conditionLabel.slice(1)} автозапчасть с доставкой по России.`;

  const firstPhoto = product?.photos?.[0]?.photo_url;
  const imageUrl = firstPhoto ? normalizeImageUrl(firstPhoto) : null;

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name,
    sku: article || undefined,
    description: uniqueDesc.slice(0, 500) || description,
    brand: brand ? { '@type': 'Brand', name: brand } : undefined,
    image: imageUrl ? [imageUrl] : undefined,
    offers: product?.price
      ? {
          '@type': 'Offer',
          url: canonicalUrl,
          priceCurrency: 'RUB',
          price: Number(product.price).toFixed(2),
          availability:
            (product.quantity || 0) > 0
              ? 'https://schema.org/InStock'
              : 'https://schema.org/OutOfStock',
          itemCondition: product?.is_new
            ? 'https://schema.org/NewCondition'
            : 'https://schema.org/UsedCondition',
        }
      : undefined,
  };

  return { title, description, canonicalUrl, imageUrl, jsonLd };
}
