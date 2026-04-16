const DEFAULT_AVITO_URL = 'https://www.avito.ru';

export function extractAvitoItemId(item) {
  return (
    item?.avitoItemId ||
    item?.avitoId ||
    item?.avito_id ||
    item?.avito_context_id ||
    item?.id ||
    null
  );
}

export function buildAvitoFallbackUrl(item) {
  const directUrl =
    item?.avitoUrl ||
    item?.url ||
    item?.avito_context_url ||
    item?.avito_url ||
    null;
  if (directUrl) return directUrl;

  const avitoId = extractAvitoItemId(item);
  if (avitoId) return `https://www.avito.ru/items/${encodeURIComponent(String(avitoId))}`;

  return DEFAULT_AVITO_URL;
}

export function openProductNotFoundPage(item) {
  const avitoUrl = buildAvitoFallbackUrl(item);
  const avitoId = extractAvitoItemId(item);
  const title = item?.title || item?.name || '';

  const params = new URLSearchParams();
  params.set('avitoUrl', avitoUrl);
  if (avitoId) params.set('avitoId', String(avitoId));
  if (title) params.set('title', String(title));
  window.open(`/product-not-found?${params.toString()}`, '_blank');
}

export async function openAvitoProductFlow({
  item,
  dispatch,
  navigate,
  fetchLinkThunk,
}) {
  const directProductId =
    item?.product_id || item?.productId || item?.linked_product_id || item?.linkedProductId;
  if (directProductId) {
    navigate(`/part/${directProductId}`);
    return;
  }

  const avitoId = extractAvitoItemId(item);
  if (!avitoId) {
    openProductNotFoundPage(item);
    return;
  }

  try {
    const linkData = await dispatch(fetchLinkThunk(avitoId)).unwrap();
    if (linkData?.linked && linkData?.product_id) {
      navigate(`/part/${linkData.product_id}`);
      return;
    }
  } catch (err) {
    // Ignore and open fallback confirmation page.
  }

  openProductNotFoundPage(item);
}

