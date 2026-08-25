import {
  buyerProfile,
  loginResponse,
  sellerProfile,
} from './testUsers';

export const mockNewPartCard = {
  id: 1001,
  brand: 'Bosch',
  article: '0986424590',
  name: 'Колодки тормозные',
  title: 'Колодки тормозные Bosch',
  image_url: '/img/product-placeholder-white.png',
  stock_count: 10,
  stocks: [
    {
      stock_id: '1',
      price: 1500,
      available_count: 10,
      delivery_days: 1,
      delivery_time: '1 день',
    },
  ],
};

export const mockCartItem = {
  id: 1,
  quantity: 1,
  price: 1500,
  purchase_price: 1500,
  brand: 'Bosch',
  partnumber: '0986424590',
  article: '0986424590',
  name: 'Колодки тормозные',
  basket_id: 1,
  card_id: 1001,
};

export function buildCartPayload() {
  const item = mockCartItem;
  return {
    new_parts_items: [item],
    used_parts_items: [],
    new_parts_baskets: [
      {
        id: 1,
        name: 'Корзина 1',
        is_default: true,
        items: [item],
      },
    ],
  };
}

const siteConfig = {
  show_new_autoparts: true,
  show_site_reviews: false,
  buyer_markup_percent: 30,
  seller_markup_percent: 15,
  autoservice_markup_percent: 7,
  admin_organization_phone: '+7 (999) 000-00-00',
};

function extractApiPath(url) {
  try {
    const { pathname } = new URL(url);
    const apiIndex = pathname.indexOf('/api');
    if (apiIndex === -1) return null;
    return pathname.slice(apiIndex + 4) || '/';
  } catch {
    return null;
  }
}

function json(route, body, status = 200) {
  return route.fulfill({
    status,
    contentType: 'application/json',
    body: JSON.stringify(body),
  });
}

/**
 * @param {import('@playwright/test').Page} page
 * @param {{ profile?: object | null, cart?: object, products?: object[] }} [options]
 */
export async function installBaseMocks(page, options = {}) {
  const profile = options.profile ?? null;
  const cart = options.cart ?? buildCartPayload();
  const products = options.products ?? [
    {
      id: 101,
      name: 'Фара левая',
      brand: 'Toyota',
      article: '8111002A80',
      price: 5000,
      quantity: 1,
      status: 'active',
    },
  ];

  await page.route('**/*', async (route) => {
    const request = route.request();
    const apiPath = extractApiPath(request.url());
    if (!apiPath) {
      await route.continue();
      return;
    }

    const method = request.method();

    if (method === 'OPTIONS') {
      await route.fulfill({ status: 204, headers: { 'Access-Control-Allow-Origin': '*' } });
      return;
    }

    if (apiPath.startsWith('/auth/public-site-config')) {
      await json(route, siteConfig);
      return;
    }

    if (apiPath.startsWith('/public/site-quick-links')) {
      await json(route, { links: [] });
      return;
    }

    if (apiPath === '/auth/login' && method === 'POST') {
      await json(route, loginResponse(profile || buyerProfile));
      return;
    }

    if (apiPath === '/auth/refresh' && method === 'POST') {
      await json(route, loginResponse(profile || buyerProfile));
      return;
    }

    if (apiPath.startsWith('/auth/profile')) {
      if (profile) {
        await json(route, profile);
      } else {
        await json(route, { detail: 'Unauthorized' }, 401);
      }
      return;
    }

    if (apiPath === '/cart/' && method === 'GET') {
      await json(route, cart);
      return;
    }

    if (apiPath.startsWith('/cart/new-parts/baskets')) {
      await json(route, cart.new_parts_baskets || []);
      return;
    }

    if (apiPath.match(/^\/public\/new-parts\/cards\/\d+$/) && method === 'GET') {
      await json(route, mockNewPartCard);
      return;
    }

    if (apiPath.includes('/resolve-image') && method === 'POST') {
      await json(route, { image_url: mockNewPartCard.image_url });
      return;
    }

    if (apiPath.startsWith('/rossko/')) {
      await json(route, { PartsList: [] });
      return;
    }

    if (apiPath.startsWith('/public/site-delivery')) {
      await json(route, []);
      return;
    }

    if (apiPath.startsWith('/cart/admin-org-address')) {
      await json(route, { address: 'г. Москва, ул. Тестовая, 1' });
      return;
    }

    if (apiPath.startsWith('/orders/new-parts/config')) {
      await json(route, { allow_unpaid_checkout: true });
      return;
    }

    if (apiPath.startsWith('/payments/new-parts/sessions') && method === 'POST') {
      await json(route, { id: 'pay-session-1', status: 'pending' });
      return;
    }

    if (apiPath.startsWith('/products/public/find-used-match')) {
      await json(route, { items: [] });
      return;
    }

    if (apiPath === '/products/' && method === 'GET') {
      await json(route, {
        items: products,
        total: products.length,
        page: 1,
        page_size: 20,
      });
      return;
    }

    if (apiPath.startsWith('/products/storage-cell-values')) {
      await json(route, {});
      return;
    }

    if (apiPath.startsWith('/organizations/')) {
      await json(route, []);
      return;
    }

    if (apiPath.startsWith('/storage-cells')) {
      await json(route, []);
      return;
    }

    if (apiPath.startsWith('/employees')) {
      await json(route, []);
      return;
    }

    if (apiPath.startsWith('/part-types')) {
      await json(route, []);
      return;
    }

    if (apiPath.startsWith('/catalog/')) {
      await json(route, { items: [], total: 0 });
      return;
    }

    if (apiPath.startsWith('/search-products/')) {
      await json(route, { items: [], total: 0 });
      return;
    }

    if (apiPath.startsWith('/public/new-part-meta')) {
      await json(route, {});
      return;
    }

    if (apiPath.startsWith('/public/part-reference-fitment')) {
      await json(route, { items: [] });
      return;
    }

    if (apiPath.startsWith('/chats')) {
      await json(route, { chats: [], total: 0 });
      return;
    }

    if (apiPath.startsWith('/pending-product-storage-cells')) {
      await json(route, []);
      return;
    }

    if (method === 'GET') {
      await json(route, {});
      return;
    }

    if (method === 'POST' || method === 'PUT' || method === 'PATCH') {
      await json(route, { ok: true });
      return;
    }

    await route.continue();
  });
}

export async function installSellerMocks(page) {
  await installBaseMocks(page, { profile: sellerProfile });
}

export async function installBuyerMocks(page) {
  await installBaseMocks(page, { profile: buyerProfile });
}

export { buyerProfile, sellerProfile };
