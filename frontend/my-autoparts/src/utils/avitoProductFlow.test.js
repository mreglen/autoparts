import { openOrderItemProductFlow } from './avitoProductFlow';

describe('openOrderItemProductFlow destination', () => {
  it('navigates to seller card when destination is seller', async () => {
    const navigate = jest.fn();
    await openOrderItemProductFlow({
      item: { product_id: 42, brand: 'Bosch', article: 'ABC' },
      navigate,
      destination: 'seller',
    });
    expect(navigate).toHaveBeenCalledWith('/seller/part-card/42');
  });

  it('navigates to public part page by default', async () => {
    const navigate = jest.fn();
    await openOrderItemProductFlow({
      item: { product_id: 42, brand: 'Bosch', article: 'ABC' },
      navigate,
    });
    expect(navigate).toHaveBeenCalledWith('/part/42-Bosch-ABC');
  });

  it('navigates to public part id-only path when brand/article missing', async () => {
    const navigate = jest.fn();
    await openOrderItemProductFlow({
      item: { product_id: 42 },
      navigate,
    });
    expect(navigate).toHaveBeenCalledWith('/part/42');
  });
});
