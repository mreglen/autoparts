import { fetchPublicProduct } from '../redux/slices/ProductSlice';

let usedPartChunkPromise = null;
let newPartChunkPromise = null;
let newPartOpenChunkPromise = null;
const prefetchedProductIds = new Set();

export function prefetchUsedPartDetailChunk() {
  if (!usedPartChunkPromise) {
    usedPartChunkPromise = import('../pages/PartDetail/PartDetail');
  }
  return usedPartChunkPromise;
}

export function prefetchNewPartDetailChunk() {
  if (!newPartChunkPromise) {
    newPartChunkPromise = import('../pages/AutoParts/NewParts/NewPartDetailPage');
  }
  return newPartChunkPromise;
}

export function prefetchNewPartOpenChunk() {
  if (!newPartOpenChunkPromise) {
    newPartOpenChunkPromise = import('../pages/AutoParts/NewParts/NewPartOpenPage');
  }
  return newPartOpenChunkPromise;
}

/** Предзагрузка JS-чанка и данных товара при наведении / touch на карточку б/у. */
export function prefetchUsedPartDetail(productId, dispatch) {
  const id = Number(productId);
  if (!Number.isFinite(id) || id <= 0) return;

  prefetchUsedPartDetailChunk();

  if (!prefetchedProductIds.has(id)) {
    prefetchedProductIds.add(id);
    dispatch(fetchPublicProduct(id));
  }
}

export function prefetchNewPartDetail(cardId) {
  const id = Number(cardId);
  if (!Number.isFinite(id) || id <= 0) return;
  prefetchNewPartDetailChunk();
}
