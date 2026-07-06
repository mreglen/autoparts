export const SITE_ORIGIN = 'https://svoygarage.ru';

function absoluteUrl(path) {
  if (!path || path === '/') return `${SITE_ORIGIN}/`;
  return `${SITE_ORIGIN}${path.startsWith('/') ? path : `/${path}`}`;
}

export function buildBreadcrumbJsonLd(items) {
  if (!items?.length) return null;

  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((item, index) => {
      const entry = {
        '@type': 'ListItem',
        position: index + 1,
        name: item.label,
      };
      if (item.href) {
        entry.item = absoluteUrl(item.href);
      }
      return entry;
    }),
  };
}

export function buildBreadcrumbsForPath(pathname, context = {}) {
  const path = (pathname || '/').split('?')[0];

  if (path === '/') {
    return [];
  }

  const items = [{ label: 'Главная', href: '/' }];

  if (path === '/catalog') {
    items.push({ label: 'Каталог' });
    return items;
  }

  if (path === '/about') {
    items.push({ label: 'О компании' });
    return items;
  }

  if (path === '/delivery') {
    items.push({ label: 'Доставка' });
    return items;
  }

  if (path === '/reviews') {
    items.push({ label: 'Отзывы' });
    return items;
  }

  if (path === '/payment') {
    items.push({ label: 'Оплата' });
    return items;
  }

  if (path === '/organizations') {
    items.push({ label: 'Организации' });
    return items;
  }

  if (path.startsWith('/organizations/')) {
    items.push({ label: 'Организации', href: '/organizations' });
    items.push({ label: context.organizationName || 'Организация' });
    return items;
  }

  if (path === '/autoparts/new') {
    items.push({ label: 'Новые запчасти' });
    return items;
  }

  if (path === '/autoparts/new/filters') {
    items.push({ label: 'Новые запчасти', href: '/autoparts/new' });
    items.push({ label: 'Фильтры' });
    return items;
  }

  if (path.startsWith('/autoparts/new/brand/')) {
    items.push({ label: 'Новые запчасти', href: '/autoparts/new' });
    items.push({ label: context.brandName || 'Бренд' });
    return items;
  }

  if (path.startsWith('/autoparts/new/category/')) {
    items.push({ label: 'Новые запчасти', href: '/autoparts/new' });
    items.push({ label: context.categoryName || 'Категория' });
    return items;
  }

  if (path.startsWith('/autoparts/new/part/')) {
    items.push({ label: 'Новые запчасти', href: '/autoparts/new' });
    const brand = (context.brand || '').trim();
    const article = (context.article || '').trim();
    const leafLabel = brand && article ? `${brand} ${article}` : context.cardName || 'Карточка';
    items.push({ label: leafLabel });
    return items;
  }

  if (path === '/autoparts/used') {
    items.push({ label: 'Б/у запчасти' });
    return items;
  }

  if (path === '/autoparts/used/filters') {
    items.push({ label: 'Б/у запчасти', href: '/autoparts/used' });
    items.push({ label: 'Фильтры' });
    return items;
  }

  if (path.startsWith('/autoparts/used/brand/')) {
    items.push({ label: 'Б/у запчасти', href: '/autoparts/used' });
    items.push({ label: context.brandName || 'Бренд' });
    return items;
  }

  if (path.startsWith('/autoparts/used/category/')) {
    items.push({ label: 'Б/у запчасти', href: '/autoparts/used' });
    items.push({ label: context.categoryName || 'Категория' });
    return items;
  }

  if (path.startsWith('/autoparts/used/geo/')) {
    items.push({ label: 'Б/у запчасти', href: '/autoparts/used' });
    items.push({ label: context.cityName || 'Город' });
    return items;
  }

  if (path.startsWith('/part/')) {
    const product = context.product;
    const isNew = Boolean(context.isNew ?? product?.is_new);
    items.push({
      label: isNew ? 'Новые запчасти' : 'Б/у запчасти',
      href: isNew ? '/autoparts/new' : '/autoparts/used',
    });

    const brand = (product?.brand || '').trim();
    const article = (product?.article || '').trim();
    const name = (product?.name || '').trim();
    const leafLabel = brand && article ? `${brand} ${article}` : name || 'Карточка товара';
    items.push({ label: leafLabel });
    return items;
  }

  return [];
}
