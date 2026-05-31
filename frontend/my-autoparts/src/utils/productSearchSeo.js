import { DEFAULT_CITY, extractCityFromAddress, formatCityInPrepositional } from './organizationCity';

const SITE_BRAND = 'Свой Гараж';
const TITLE_SUFFIX = ` | ${SITE_BRAND}`;

function truncate(text, maxLen) {
  const value = (text || '').replace(/\s+/g, ' ').trim();
  if (!value) return '';
  if (value.length <= maxLen) return value;
  return `${value.slice(0, maxLen - 1).trim()}…`;
}

function formatPriceRub(price) {
  if (price == null || price === '') return null;
  const amount = Number(price);
  if (!Number.isFinite(amount) || amount <= 0) return null;
  if (Number.isInteger(amount)) {
    return amount.toLocaleString('ru-RU');
  }
  return amount.toLocaleString('ru-RU', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function buildProductSearchTitle({ brand, article, fallbackDisplayName }) {
  const brandStr = String(brand || '').trim();
  const articleStr = String(article || '').trim();
  const fallback = String(fallbackDisplayName || '').trim();

  let core;
  if (fallback) {
    core = fallback;
  } else if (brandStr && articleStr) {
    core = `${brandStr} ${articleStr}`;
  } else if (articleStr) {
    core = articleStr;
  } else if (brandStr) {
    core = brandStr;
  } else {
    core = 'Автозапчасть';
  }

  return `${core}${TITLE_SUFFIX}`.replace(/\s+/g, ' ').trim();
}

export function buildProductSearchDescription({
  brand,
  article,
  isNew,
  city,
  price,
  inStock = true,
  shortName,
  uniqueDescription,
}) {
  const brandStr = String(brand || '').trim();
  const articleStr = String(article || '').trim();
  const condition = isNew ? 'Новая' : 'Б/у';
  const cityPrep = formatCityInPrepositional(city || DEFAULT_CITY);
  const uniqueDesc = String(uniqueDescription || '').replace(/\s+/g, ' ').trim();
  const short = String(shortName || '').trim();
  const snippetSource = uniqueDesc || short;

  let buyLine;
  if (brandStr && articleStr) {
    buyLine = `Купить ${brandStr} ${articleStr}.`;
  } else if (articleStr) {
    buyLine = `Купить запчасть ${articleStr}.`;
  } else {
    buyLine = 'Купить автозапчасть.';
  }

  const stockPhrase = inStock ? 'в наличии' : 'доступна';
  let core = `${buyLine} ${condition} запчасть ${stockPhrase} в ${cityPrep}.`;
  const priceText = formatPriceRub(price);
  if (priceText) {
    core = `${core} ${priceText} ₽.`;
  }
  const delivery = 'Доставка по России.';
  const base = `${core} ${delivery}`;

  if (snippetSource) {
    const combined = `${base} ${snippetSource}`;
    if (combined.length <= 160) return combined;
    const remaining = 160 - `${base} `.length - 1;
    if (remaining > 20) {
      return `${base} ${truncate(snippetSource, remaining)}`;
    }
  }
  return truncate(base, 160);
}

export function buildProductAlternateNames({ brand, article }) {
  const brandStr = String(brand || '').trim();
  const articleStr = String(article || '').trim();
  if (!articleStr) return [];

  const names = [articleStr];
  if (brandStr) {
    names.push(`${brandStr} ${articleStr}`, `${articleStr} ${brandStr}`);
  }

  const seen = new Set();
  return names.filter((name) => {
    const key = name.toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export function resolveProductCity(organization) {
  return extractCityFromAddress(organization?.address);
}

export function buildProductOfferJsonLd({
  canonicalUrl,
  price,
  inStock,
  isNew,
  sellerName,
  sellerPhone,
  sellerAddress,
  city,
}) {
  if (!price) return undefined;

  const cityName = city || DEFAULT_CITY;
  const offer = {
    '@type': 'Offer',
    url: canonicalUrl,
    priceCurrency: 'RUB',
    price: String(price),
    availability: inStock ? 'https://schema.org/InStock' : 'https://schema.org/OutOfStock',
    itemCondition: isNew ? 'https://schema.org/NewCondition' : 'https://schema.org/UsedCondition',
    areaServed: { '@type': 'Country', name: 'RU' },
    shippingDetails: {
      '@type': 'OfferShippingDetails',
      shippingDestination: {
        '@type': 'DefinedRegion',
        addressCountry: 'RU',
      },
    },
    availableAtOrFrom: {
      '@type': 'Place',
      address: {
        '@type': 'PostalAddress',
        addressLocality: cityName,
        addressCountry: 'RU',
      },
    },
  };

  if (sellerName || sellerPhone || sellerAddress) {
    const seller = {
      '@type': 'Organization',
      name: (sellerName || SITE_BRAND).trim(),
    };
    if (sellerPhone) seller.telephone = String(sellerPhone).trim();
    if (sellerAddress || cityName) {
      seller.address = {
        '@type': 'PostalAddress',
        addressLocality: cityName,
        addressCountry: 'RU',
      };
      const street = String(sellerAddress || '').trim();
      if (street) seller.address.streetAddress = street;
    }
    offer.seller = seller;
  }

  return offer;
}

export { DEFAULT_CITY, extractCityFromAddress, formatCityInPrepositional };
