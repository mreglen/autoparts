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
  if (!Number.isFinite(numericId) || numericId <= 0) {
    return { ok: false, reason: 'invalid' };
  }
  if (!userHasWarehouseQrAccess(user, permissionCodes)) {
    return { ok: false, reason: 'no_access' };
  }

  try {
    const response = await apiAxios.get(`/products/qr-card/${numericId}`);
    return { ok: true, data: response.data };
  } catch (err) {
    const status = err?.response?.status;
    if (status === 401 || status === 403) {
      return { ok: false, reason: 'auth' };
    }
    if (status === 404) {
      return { ok: false, reason: 'not_found' };
    }
    return { ok: false, reason: 'error', message: err?.message || 'Ошибка сети' };
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
  const hasWarehouseAccess = Boolean(user && userHasWarehouseQrAccess(user, permissionCodes));

  if (hasWarehouseAccess) {
    const sellerResult = await fetchSellerQrPartCard(productId, user, permissionCodes);
    if (sellerResult?.ok) {
      return { mode: 'seller', part: sellerResult.data };
    }
    if (sellerResult?.reason === 'auth') {
      return { mode: 'auth_required' };
    }
    if (sellerResult?.reason === 'not_found') {
      return { mode: 'forbidden' };
    }
    if (sellerResult?.reason === 'error') {
      return { mode: 'error', message: sellerResult.message };
    }
  }

  const publicPath = await resolvePublicPartPath(productId);
  if (!publicPath) {
    return { mode: 'not_found' };
  }

  return { mode: 'public', path: publicPath };
}
