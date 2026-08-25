import { buildVinCatalogPath, resolveSearchOrVin } from './vinCatalogNavigation';

describe('vinCatalogNavigation', () => {
  it('buildVinCatalogPath returns encoded path for valid VIN', () => {
    expect(buildVinCatalogPath('WBA 3A5C58 CF123456')).toBe('/autoparts/vin?vin=WBA3A5C58CF123456');
  });

  it('buildVinCatalogPath returns null for non-VIN queries', () => {
    expect(buildVinCatalogPath('тормозные колодки')).toBeNull();
    expect(buildVinCatalogPath('VAG 059198405')).toBeNull();
  });

  it('resolveSearchOrVin navigates to vin catalog for VIN text', () => {
    const navigate = jest.fn();
    expect(resolveSearchOrVin(navigate, 'XW8ZZZ7PZDG00269')).toBe('vin');
    expect(navigate).toHaveBeenCalledWith('/autoparts/vin?vin=XW8ZZZ7PZDG00269', { replace: false });
  });

  it('resolveSearchOrVin returns text for regular queries', () => {
    const navigate = jest.fn();
    expect(resolveSearchOrVin(navigate, 'фильтр масла')).toBe('text');
    expect(navigate).not.toHaveBeenCalled();
  });
});
