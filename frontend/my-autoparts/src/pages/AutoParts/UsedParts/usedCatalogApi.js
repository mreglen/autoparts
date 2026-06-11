import { apiRequestUnauth } from '../../../utils/apiClient';

function buildCatalogQuery(params) {
  const queryParams = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value === null || value === undefined || value === '') return;
    if (Array.isArray(value)) {
      value.forEach((item) => {
        if (item !== null && item !== undefined && item !== '') {
          queryParams.append(key, String(item));
        }
      });
      return;
    }
    queryParams.set(key, String(value));
  });
  return queryParams.toString();
}

export async function fetchUsedCatalogProducts(params) {
  const query = buildCatalogQuery({
    is_new: false,
    has_photos: true,
    sort: 'created_at_desc',
    ...params,
  });
  return apiRequestUnauth(`/catalog/products?${query}`);
}
