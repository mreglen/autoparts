import NewPartsBasketHoverMenu from './NewPartsBasketHoverMenu';
import { useDispatch } from 'react-redux';
import { useState } from 'react';
import { addNewPartsToCart } from '../../redux/slices/CartSlice';
import { trackConversion, CONVERSION_EVENTS } from '../../utils/siteAnalytics';

/**
 * Legacy wrapper around hover basket menu for new-parts add.
 */
export default function NewPartsCartAddButton({
  cartItem,
  disabled = false,
  analyticsSection = 'vin',
  className = '',
  showBasketPicker = true,
}) {
  const dispatch = useDispatch();
  const [adding, setAdding] = useState(false);

  const handleAddToBasket = async (basketId) => {
    if (!cartItem?.stock_id || !cartItem?.price || cartItem.price <= 0) return;
    setAdding(true);
    try {
      await dispatch(
        addNewPartsToCart({
          ...cartItem,
          basket_id: basketId || undefined,
        })
      ).unwrap();
      trackConversion(CONVERSION_EVENTS.ADD_TO_CART, {
        path: window.location.pathname + window.location.search,
        section: analyticsSection,
      });
    } finally {
      setAdding(false);
    }
  };

  return (
    <NewPartsBasketHoverMenu
      onAddToBasket={handleAddToBasket}
      disabled={disabled || adding}
      showPicker={showBasketPicker}
      className={className}
    />
  );
}
