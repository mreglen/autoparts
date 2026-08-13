import {
  canUseClientMarkup,
  computeClientPrices,
} from './clientMarkupUtils';

describe('clientMarkupUtils', () => {
  it('enables client markup only for active autoservice organization staff', () => {
    expect(canUseClientMarkup({
      is_employee: true,
      organization_id: 'ORG1',
      organization_is_autoservice: true,
    })).toBe(true);
    expect(canUseClientMarkup({
      is_employee: true,
      organization_id: 'ORG1',
      organization_is_autoservice: false,
    })).toBe(false);
  });

  it('keeps authoritative price separate from client presentation price', () => {
    expect(computeClientPrices(100, 7, 20)).toEqual({
      purchasePrice: 107,
      clientPrice: 128,
    });
  });
});
