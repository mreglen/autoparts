import { buildVinCatalogSeo, isVinCatalogNoindexQuery } from './pageSeo';

describe('vin catalog SEO', () => {
  it('marks VIN query pages as noindex', () => {
    const params = new URLSearchParams('vin=WAUYP64B91N069929');
    expect(isVinCatalogNoindexQuery(params)).toBe(true);
    expect(buildVinCatalogSeo(params).robots).toBe('noindex, nofollow');
    expect(buildVinCatalogSeo(params).canonicalUrl).toBe('https://svoygarage.ru/autoparts/vin');
  });

  it('marks wizard pages as noindex', () => {
    const params = new URLSearchParams('wizard=1');
    expect(isVinCatalogNoindexQuery(params)).toBe(true);
    expect(buildVinCatalogSeo(params).robots).toBe('noindex, nofollow');
  });

  it('keeps bare VIN catalog page indexable', () => {
    const params = new URLSearchParams('');
    expect(isVinCatalogNoindexQuery(params)).toBe(false);
    expect(buildVinCatalogSeo(params).robots).toBe('index, follow');
  });
});
