import { useSelector } from 'react-redux';
import { formatProductPrice, roundProductPrice } from '../utils/productPrice';

export function useProductPriceFormat() {
  const roundProductPrices = useSelector(
    (state) => state.publicInfo.roundProductPrices === true,
  );

  return {
    roundProductPrices,
    formatPrice: (price, options = {}) => formatProductPrice(price, {
      roundKopecks: roundProductPrices,
      ...options,
    }),
    roundPrice: (price) => (roundProductPrices ? roundProductPrice(price) : Number(price)),
  };
}
