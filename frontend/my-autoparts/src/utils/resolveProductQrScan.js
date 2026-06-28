import { apiAxios, apiAxiosUnauth } from './apiClient';
import { buildPartDetailPath } from './partRoutes';

/**
 * Сканирование QR с /seller/part-card/{id} (URL в уже напечатанных этикетках не меняем):
 * — продавец своей организации → складская карточка;
 * — остальные → публичная карточка /part/…, если товар доступен.
 */
export async function fetchSellerQrPartCard(productId, user) {
  const numericId = parseInt(String(productId), 10);
  if (!Number.isFinite(numericId) || numericId <= 0) return null;
  if (!user?.is_seller || !user?.organization_id) return null;

  try {
    const response = await apiAxios.get(`/products/qr-card/${numericId}`);
    return response.data;
  } catch {
    return null;
  }
}

export async function resolvePublicPartPath(productId) {
  const numericId = parseInt(String(productId), 10);
  if (!Number.isFinite(numericId) || numericId <= 0) return null;

  try {
    const response = await apiAxiosUnauth.get(`/products/public/${numericId}`);
    return buildPartDetailPath(response.data);
  } catch {
    return buildPartDetailPath(numericId);
  }
}

export async function resolveProductQrScan(productId, user) {
  const sellerPart = await fetchSellerQrPartCard(productId, user);
  if (sellerPart) {
    return { mode: 'seller', part: sellerPart };
  }

  const publicPath = await resolvePublicPartPath(productId);
  if (!publicPath) {
    return { mode: 'not_found' };
  }

  return { mode: 'public', path: publicPath };
}
