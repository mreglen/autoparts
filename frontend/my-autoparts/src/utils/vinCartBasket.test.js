import { buildVinBasketName } from './vinCartBasket';

describe('buildVinBasketName', () => {
  it('joins make, model and vin', () => {
    expect(
      buildVinBasketName({
        make: 'Toyota',
        model: 'Camry',
        vin: 'jt2bf28k0x0123456',
      }),
    ).toBe('Toyota Camry JT2BF28K0X0123456');
  });

  it('returns empty string when data is incomplete', () => {
    expect(buildVinBasketName({ make: 'Toyota', model: 'Camry', vin: '' })).toBe('');
  });
});
