import { apiAxios, apiAxiosUnauth } from './apiClient';
import { buildPartDetailPath } from './partRoutes';
import { userHasWarehouseQrAccess } from '../hooks/useWarehousePermissions';

/**
 * Сканирование QR с /seller/part-card/{id} (URL в уже напечатанных этикетках не меняем):
 * — продавец/сотрудник своей организации → складская карточка;
 * — остальные → публичная карточка /part/…, если товар доступен.
 */
export async function fetchSellerQrPartCard(productId, user, permissionCodes = []) {
  const numericId = parseInt(String(productId), 10);
  if (!Number.isFinite(numericId) || numericId <= 0) return null;
  if (!userHasWarehouseQrAccess(user, permissionCodes)) return null;

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

export async function resolveProductQrScan(productId, user, permissionCodes = []) {
  const sellerPart = await fetchSellerQrPartCard(productId, user, permissionCodes);
  if (sellerPart) {
    return { mode: 'seller', part: sellerPart };
  }

  if (user && userHasWarehouseQrAccess(user, permissionCodes)) {
    return { mode: 'forbidden' };
  }

  const publicPath = await resolvePublicPartPath(productId);
  if (!publicPath) {
    return { mode: 'not_found' };
  }

  return { mode: 'public', path: publicPath };
}
