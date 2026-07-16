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

  it('parses legacy /server/ prefix in path', () => {
    const result = parseSellerPartCardQr('/server/seller/part-card/42');
    expect(result).toEqual({
      type: 'part-card',
      productId: 42,
      path: '/seller/part-card/42',
    });
  });

  it('parses full URL with /server/ prefix', () => {
    const result = parseSellerPartCardQr('https://svoygarage.ru/server/seller/part-card/99');
    expect(result?.productId).toBe(99);
    expect(result?.path).toBe('/seller/part-card/99');
  });

  it('parses public part SEO path', () => {
    const result = parseSellerPartCardQr('/part/605-Jakoparts-J2883012');
    expect(result).toEqual({
      type: 'public-part',
      productId: 605,
      path: '/part/605-Jakoparts-J2883012',
    });
  });

  it('parses public part id-only path', () => {
    const result = parseSellerPartCardQr('/part/605');
    expect(result).toEqual({
      type: 'public-part',
      productId: 605,
      path: '/part/605',
    });
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

  it('parses stable label QR by internal code', () => {
    const result = parseSellerPartCardQr('https://svoygarage.ru/qr/label/TVGP-AABBP');
    expect(result?.type).toBe('label-code');
    expect(result?.internalCode).toBe('TVGP-AABBP');
  });

  it('returns null for invalid payload', () => {
    expect(parseSellerPartCardQr('')).toBeNull();
    expect(parseSellerPartCardQr('hello-world')).toBeNull();
  });
});
