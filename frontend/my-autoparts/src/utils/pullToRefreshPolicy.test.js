import { isPullToRefreshDisabled, isPullToRefreshFormOnly } from './pullToRefreshPolicy';

describe('pullToRefreshPolicy autoservice form routes', () => {
  it('disables PTR on repair order create and edit', () => {
    expect(isPullToRefreshFormOnly('/autoservice/orders/new')).toBe(true);
    expect(isPullToRefreshFormOnly('/autoservice/orders/42/edit')).toBe(true);
    expect(isPullToRefreshFormOnly('/autoservice/orders')).toBe(false);
  });
});

describe('pullToRefreshPolicy camera routes', () => {
  it('disables PTR on warehouse scan page', () => {
    expect(isPullToRefreshDisabled('/warehouse/scan')).toBe(true);
    expect(isPullToRefreshDisabled('/my-parts')).toBe(false);
  });
});
