import { parseSellerPartCardQr } from './parseSellerPartCardQr';

describe('parseSellerPartCardQr', () => {
  it('parses relative seller part-card path', () => {
    const result = parseSellerPartCardQr('/seller/part-card/42');
    expect(result).toEqual({
      type: 'part-card',
      productId: 42,
      path: '/seller/part-card/42',
    });
  });

  it('parses full URL', () => {
    const result = parseSellerPartCardQr('https://svoygarage.ru/seller/part-card/99');
    expect(result?.productId).toBe(99);
    expect(result?.path).toBe('/seller/part-card/99');
  });

  it('parses numeric id only', () => {
    const result = parseSellerPartCardQr('15');
    expect(result?.productId).toBe(15);
  });

  it('parses edit-pending legacy path', () => {
    const result = parseSellerPartCardQr('/my-parts/edit-pending/7');
    expect(result?.type).toBe('edit-pending');
    expect(result?.path).toBe('/my-parts/edit-pending/7');
  });

  it('returns null for invalid payload', () => {
    expect(parseSellerPartCardQr('')).toBeNull();
    expect(parseSellerPartCardQr('hello-world')).toBeNull();
  });
});
