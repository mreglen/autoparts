import { useEffect, useMemo, useRef, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import {
  addNewPartsToCart,
  refreshNewPartsCartOffers,
  removeFromCart,
  selectCart,
  selectCartLoading,
  updateCartItemQuantity,
} from '../../../redux/slices/CartSlice';
import { trackConversion, CONVERSION_EVENTS } from '../../../utils/siteAnalytics';
import useNewPartsMarkupPercent from '../../../hooks/useNewPartsMarkupPercent';
import { applyMarkup } from './newPartStockUtils';
import { isRosskoDeliverableStock } from './rosskoHelpers';
import { formatProductDisplayTitle } from '../../../utils/productDisplayName';

const toSafeText = (value, fallback = '') => {
  if (typeof value === 'string') return value.trim() || fallback;
  if (typeof value === 'number') return String(value);
  if (!value) return fallback;
  return fallback;
};

const toSafeInt = (value, fallback = 0) => {
  const n = Number(value);
  if (Number.isFinite(n)) return Math.max(0, Math.trunc(n));
  return fallback;
};

const toIsoOrNull = (value) => {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString();
};

const sameDeliveryInstant = (a, b) => toIsoOrNull(a) === toIsoOrNull(b);

export function useNewPartCartActions({ part, stocksData }) {
  const dispatch = useDispatch();
  const cart = useSelector(selectCart);
  const cartLoading = useSelector(selectCartLoading);
  const markupPercent = useNewPartsMarkupPercent('auto');
  const [addingToCart, setAddingToCart] = useState(false);
  const syncSignatureRef = useRef('');

  const brand = toSafeText(part?.brand);
  const number = toSafeText(part?.partnumber);
  const displayTitle = toSafeText(
    formatProductDisplayTitle(brand, number, toSafeText(part?.name)),
    `${brand} ${number}`.trim(),
  );

  const stocks = useMemo(
    () => (stocksData || []).filter(
      (stock) => isRosskoDeliverableStock(stock)
        && stock?.price
        && stock.price !== '0'
        && stock.price !== 0
        && (stock.available_count || 0) > 0,
    ),
    [stocksData],
  );

  useEffect(() => {
    if (!stocks.length || !cart?.new_parts_items?.length || !brand || !number) return undefined;
    const refreshItems = [];
    stocks.forEach((stock) => {
      const stockId = String(stock?.stock_id || '').trim();
      if (!stockId) return;
      const matches = cart.new_parts_items.filter(
        (item) =>
          String(item.stock_id || '') === stockId
          && item.brand === brand
          && item.partnumber === number
      );
      if (!matches.length) return;
      const deliveryStart = toIsoOrNull(stock.delivery_start);
      const deliveryEnd = toIsoOrNull(stock.delivery_end);
      if (!deliveryStart && !deliveryEnd) return;
      const needsUpdate = matches.some(
        (item) =>
          !sameDeliveryInstant(item.delivery_start, deliveryStart)
          || !sameDeliveryInstant(item.delivery_end, deliveryEnd)
      );
      if (!needsUpdate) return;
      refreshItems.push({
        stock_id: stockId,
        brand,
        partnumber: number,
        delivery_start: deliveryStart || undefined,
        delivery_end: deliveryEnd || undefined,
        max_quantity: Math.max(1, Number(stock.available_count) || 1),
        name: displayTitle || undefined,
      });
    });
    if (!refreshItems.length) return undefined;
    const signature = refreshItems
      .map((item) => `${item.stock_id}|${item.delivery_start || ''}|${item.delivery_end || ''}`)
      .sort()
      .join(';');
    if (signature === syncSignatureRef.current) return undefined;
    syncSignatureRef.current = signature;
    const timer = setTimeout(() => {
      dispatch(refreshNewPartsCartOffers(refreshItems));
    }, 250);
    return () => clearTimeout(timer);
  }, [brand, cart?.new_parts_items, dispatch, displayTitle, number, stocks]);

  const mainStock = stocks[0] || null;
  const otherStocks = stocks.slice(1);
  const priceWithMarkup = (price) => applyMarkup(price, markupPercent);

  const getCartQuantity = (stock) => {
    if (!stock?.stock_id || !cart?.new_parts_items) return 0;
    const cartItem = cart.new_parts_items.find((item) => (
      item.stock_id === String(stock.stock_id)
      && item.brand === brand
      && item.partnumber === number
    ));
    return cartItem ? toSafeInt(cartItem.quantity, 0) : 0;
  };

  const getCartItemByStock = (stock) => {
    if (!stock?.stock_id || !cart?.new_parts_items) return null;
    return cart.new_parts_items.find((item) => (
      item.stock_id === String(stock.stock_id)
      && item.brand === brand
      && item.partnumber === number
    )) || null;
  };

  const getStockAvailability = (currentStock) => {
    const currentCartQuantity = getCartQuantity(currentStock);
    const availableOnCurrent = Number(currentStock?.available_count) || 0;
    const hasStockOnOther = stocks
      .filter((stock) => String(stock.stock_id) !== String(currentStock?.stock_id))
      .some((stock) => (Number(stock.available_count) || 0) > 0);
    const currentStockExhausted = availableOnCurrent <= currentCartQuantity;
    return {
      noStock: availableOnCurrent <= 0 && currentCartQuantity === 0 && !hasStockOnOther,
      limitedStock: currentStockExhausted && hasStockOnOther,
    };
  };

  const prepareCartItem = (stock, quantityToAdd) => {
    const cartItem = {
      brand: String(brand).trim(),
      partnumber: String(number).trim(),
      quantity: Number.isInteger(quantityToAdd) ? quantityToAdd : 1,
      price: priceWithMarkup(stock?.price),
      supplier_unit_price: Number(stock?.price) > 0 ? Number(stock.price) : undefined,
      stock_id: String(stock?.stock_id || '').trim(),
      max_quantity: Math.max(1, Number(stock?.available_count) || 1),
    };
    if (displayTitle) cartItem.name = displayTitle.trim();
    if (part?.guid) cartItem.guid = String(part.guid);
    if (stock?.delivery_start) {
      const startDate = new Date(stock.delivery_start);
      if (!Number.isNaN(startDate.getTime())) cartItem.delivery_start = startDate.toISOString();
    }
    if (stock?.delivery_end) {
      const endDate = new Date(stock.delivery_end);
      if (!Number.isNaN(endDate.getTime())) cartItem.delivery_end = endDate.toISOString();
    }
    return cartItem;
  };

  const handleAddToCart = async (stock, basketId) => {
    if (!stock) return;
    setAddingToCart(true);
    try {
      const currentCartQuantity = getCartQuantity(stock);
      const availableStock = Number(stock.available_count) || 0;
      if (availableStock <= currentCartQuantity) return;
      const cartItem = prepareCartItem(stock, 1);
      if (!cartItem.stock_id || cartItem.price <= 0) return;
      const existing = getCartItemByStock(stock);
      await dispatch(
        addNewPartsToCart({
          ...cartItem,
          basket_id: basketId ?? existing?.basket_id ?? undefined,
        })
      ).unwrap();
      trackConversion(CONVERSION_EVENTS.ADD_TO_CART, {
        path: window.location.pathname + window.location.search,
        section: 'new',
      });
    } catch (err) {
      throw typeof err === 'string' ? err : 'Не удалось добавить в корзину';
    } finally {
      setAddingToCart(false);
    }
  };

  const handleRemoveFromCart = async (stock) => {
    setAddingToCart(true);
    try {
      const cartItem = getCartItemByStock(stock);
      if (!cartItem) return;
      if (cartItem.quantity > 1) {
        await dispatch(updateCartItemQuantity({ itemId: cartItem.id, quantity: cartItem.quantity - 1 })).unwrap();
      } else {
        await dispatch(removeFromCart(cartItem.id)).unwrap();
      }
    } catch (_e) {
      // silent
    } finally {
      setAddingToCart(false);
    }
  };

  const mainQuantity = mainStock ? getCartQuantity(mainStock) : 0;
  const mainStockInfo = mainStock ? getStockAvailability(mainStock) : { noStock: true, limitedStock: false };
  const mainPrice = mainStock ? priceWithMarkup(mainStock.price) : null;
  const disabledControl = addingToCart || cartLoading;

  return {
    brand,
    number,
    displayTitle,
    stocks,
    mainStock,
    otherStocks,
    mainQuantity,
    mainStockInfo,
    mainPrice,
    disabledControl,
    addingToCart,
    getCartQuantity,
    getStockAvailability,
    handleAddToCart,
    handleRemoveFromCart,
    priceWithMarkup,
  };
}
