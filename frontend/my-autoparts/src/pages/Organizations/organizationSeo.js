import { SITE_ORIGIN } from '../../utils/breadcrumbs';

function absoluteUrl(path) {
  if (!path || path === '/') return `${SITE_ORIGIN}/`;
  return `${SITE_ORIGIN}${path.startsWith('/') ? path : `/${path}`}`;
}

function truncate(text, maxLen) {
  const value = (text || '').replace(/\s+/g, ' ').trim();
  if (!value) return '';
  if (value.length <= maxLen) return value;
  return `${value.slice(0, maxLen - 1).trim()}…`;
}

export function buildOrganizationsListSeo(count = 0) {
  const canonicalUrl = absoluteUrl('/organizations');
  const title = 'Организации — автозапчасти на «Свой Гараж»';
  const description =
    count > 0
      ? `Каталог ${count} организаций на «Свой Гараж»: контакты, адреса и описание продавцов автозапчастей в Екатеринбурге и онлайн.`
      : 'Каталог организаций-партнёров «Свой Гараж»: контакты, адреса и информация о продавцах автозапчастей.';

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    name: 'Организации — Свой Гараж',
    description,
    url: canonicalUrl,
    isPartOf: {
      '@type': 'WebSite',
      name: 'Свой Гараж',
      url: SITE_ORIGIN,
    },
  };

  return { title, description, canonicalUrl, jsonLd };
}

export function buildOrganizationDetailSeo(org) {
  const name = (org?.name || '').trim() || 'Организация';
  const path = `/organizations/${org.id}`;
  const canonicalUrl = absoluteUrl(path);
  const descriptionRaw =
    (org?.description || '').trim() ||
    [name, org?.address, org?.phone ? 'телефон для связи' : null].filter(Boolean).join(' — ');
  const description = truncate(descriptionRaw, 160);
  const title = `${name} — организация | Свой Гараж`;
  const imageUrl = org?.logo_organization
    ? org.logo_organization.startsWith('http')
      ? org.logo_organization
      : absoluteUrl(org.logo_organization.startsWith('/') ? org.logo_organization : `/${org.logo_organization}`)
    : absoluteUrl('/img/LogoWithoutBg.png');

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'AutoPartsStore',
    name,
    description: truncate(descriptionRaw, 500) || undefined,
    url: canonicalUrl,
    image: imageUrl,
    telephone: org?.phone || undefined,
    address: org?.address
      ? {
          '@type': 'PostalAddress',
          streetAddress: org.address,
          addressLocality: 'Екатеринбург',
          addressCountry: 'RU',
        }
      : undefined,
    parentOrganization: {
      '@type': 'Organization',
      name: 'Свой Гараж',
      url: SITE_ORIGIN,
    },
  };

  return { title, description, canonicalUrl, jsonLd, imageUrl, name };
}
