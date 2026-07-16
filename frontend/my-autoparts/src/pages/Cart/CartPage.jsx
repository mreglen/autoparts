import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { Link, useNavigate } from 'react-router-dom';
import {
  selectCart,
  selectCartLoading,
  selectCartError,
  fetchCart,
  updateCartItemQuantity,
  updateUsedCartItemQuantity,
  removeFromCart,
  removeUsedFromCart,
} from '../../redux/slices/CartSlice';
import { formatProductDisplayTitle } from '../../utils/productDisplayName';
import CartAuthModal from '../../components/CartAuthModal/CartAuthModal';

const formatPrice = (price) =>
  new Intl.NumberFormat('ru-RU', { style: 'currency', currency: 'RUB' }).format(price);

function CartOutlineIcon({ className = 'h-10 w-10 text-indigo-600' }) {
  return (
    <svg className={className} viewBox="0 0 20 20" fill="none" aria-hidden>
      <path
        d="M15 15C13.8954 15 13 15.8954 13 17C13 18.1046 13.8954 19 15 19C16.1046 19 17 18.1046 17 17C17 15.8954 16.1046 15 15 15ZM15 15H7.29395C6.83288 15 6.60193 15 6.41211 14.918C6.24466 14.8456 6.09938 14.7291 5.99354 14.5805C5.8749 14.414 5.82719 14.1913 5.73274 13.7505L3.27148 2.26465C3.17484 1.81363 3.12587 1.58838 3.00586 1.41992C2.90002 1.27135 2.75477 1.15441 2.58732 1.08205C2.39746 1 2.16779 1 1.70653 1H1M4 4H16.8732C17.595 4 17.9555 4 18.1978 4.15036C18.41 4.28206 18.5653 4.48862 18.633 4.729C18.7104 5.00343 18.611 5.34996 18.411 6.04346L17.0264 10.8435C16.9068 11.2581 16.8469 11.465 16.7256 11.6189C16.6185 11.7547 16.4772 11.861 16.317 11.9263C16.1361 12 15.9211 12 15.4921 12H5.73047M6 19C4.89543 19 4 18.1046 4 17C4 15.8954 4.89543 15 6 15C7.10457 15 8 15.8954 8 17C8 18.1046 7.10457 19 6 19Z"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function formatDeliveryTime(deliveryString) {
  if (!deliveryString) return 'Не указана';

  if (
    typeof deliveryString === 'string' &&
    deliveryString.includes('с') &&
    deliveryString.includes('до')
  ) {
    return deliveryString;
  }

  if (
    deliveryString &&
    typeof deliveryString === 'object' &&
    deliveryString.delivery_start &&
    deliveryString.delivery_end
  ) {
    try {
      const startDate = new Date(deliveryString.delivery_start);
      const endDate = new Date(deliveryString.delivery_end);
      const dayText = startDate.toLocaleDateString('ru-RU', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
      });
      const startTime = startDate.toLocaleTimeString('ru-RU', {
        hour: '2-digit',
        minute: '2-digit',
      });
      const endTime = endDate.toLocaleTimeString('ru-RU', {
        hour: '2-digit',
        minute: '2-digit',
      });
      return `${dayText} с ${startTime} до ${endTime}`;
    } catch {
      return 'Не указана';
    }
  }

  return formatDate(deliveryString);
}

function formatDate(dateString) {
  if (!dateString) return 'Не указана';
  try {
    let date;
    if (typeof dateString === 'string') {
      date = new Date(dateString);
    } else if (dateString?.year) {
      date = new Date(
        dateString.year,
        dateString.month - 1,
        dateString.day,
        dateString.hour || 0,
        dateString.minute || 0
      );
    } else {
      date = new Date(dateString);
    }
    if (Number.isNaN(date.getTime())) return 'Не указана';
    return date.toLocaleDateString('ru-RU');
  } catch {
    return 'Не указана';
  }
}

function getMaxAllowedQuantity(item) {
  const max = item?.maxQuantity;
  if (max != null && max > 0) return max;
  if (item?.type === 'new') return 99;
  return Math.max(1, item?.quantity || 1);
}

function PartTypeBadge({ type }) {
  if (type === 'used') {
    return (
      <span className="inline-flex items-center rounded-md bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-800 ring-1 ring-inset ring-amber-600/20">
        Б/У
      </span>
    );
  }
  return (
    <span className="inline-flex items-center rounded-md bg-indigo-50 px-2 py-0.5 text-xs font-medium text-indigo-700 ring-1 ring-inset ring-indigo-600/20">
      Новая
    </span>
  );
}

function QuantityControl({ quantity, onDecrease, onIncrease, max }) {
  return (
    <div className="inline-flex items-center gap-1 rounded-xl border border-gray-200 bg-gray-50 p-1">
      <button
        type="button"
        onClick={onDecrease}
        disabled={quantity <= 1}
        className="flex h-9 w-9 items-center justify-center rounded-lg text-gray-600 transition hover:bg-white disabled:cursor-not-allowed disabled:opacity-40"
        aria-label="Уменьшить количество"
      >
        <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12H4" />
        </svg>
      </button>
      <span className="min-w-[2rem] text-center text-sm font-semibold text-gray-900">{quantity}</span>
      <button
        type="button"
        onClick={onIncrease}
        disabled={quantity >= max}
        className="flex h-9 w-9 items-center justify-center rounded-lg text-gray-600 transition hover:bg-white disabled:cursor-not-allowed disabled:opacity-40"
        aria-label="Увеличить количество"
      >
        <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
        </svg>
      </button>
    </div>
  );
}

function CartItemRow({
  item,
  selected,
  onSelect,
  onQuantityChange,
  onRemove,
  showDelivery,
}) {
  const maxQty = getMaxAllowedQuantity(item);
  const lineTotal = item.price * item.quantity;

  return (
    <article className="flex gap-3 rounded-xl border border-gray-100 bg-gray-50/50 p-3 transition hover:border-gray-200 sm:p-4">
      <input
        type="checkbox"
        checked={selected}
        onChange={onSelect}
        className="mt-1 h-4 w-4 shrink-0 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
        aria-label={`Выбрать ${item.name}`}
      />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-start gap-2">
          <PartTypeBadge type={item.type} />
          <h3 className="min-w-0 flex-1 text-sm font-medium text-gray-900 sm:text-base">{item.name}</h3>
        </div>
        {item.type !== 'new' && (
          <p className="mt-1 text-xs text-gray-500 sm:text-sm">
            {item.brand} · {item.number}
          </p>
        )}
        {showDelivery && (
          <p className="mt-1.5 flex items-start gap-1.5 text-xs text-gray-600 sm:text-sm">
            <svg
              className="mt-0.5 h-3.5 w-3.5 shrink-0 text-indigo-500"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
              />
            </svg>
            <span>
              Поставка:{' '}
              <span className="font-medium text-gray-800">
                {item.deliveryDate ? formatDeliveryTime(item.deliveryDate) : 'Не указана'}
              </span>
            </span>
          </p>
        )}
        <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
          <QuantityControl
            quantity={item.quantity}
            max={maxQty}
            onDecrease={() => onQuantityChange(item.id, item.quantity - 1)}
            onIncrease={() => onQuantityChange(item.id, item.quantity + 1)}
          />
          <button
            type="button"
            onClick={() => onRemove(item.id)}
            className="text-xs font-medium text-red-600 hover:text-red-700 sm:text-sm"
          >
            Удалить
          </button>
        </div>
      </div>
      <div className="shrink-0 text-right">
        <p className="text-sm font-bold text-gray-900 sm:text-base">{formatPrice(lineTotal)}</p>
        <p className="mt-0.5 text-xs text-gray-500">{formatPrice(item.price)} / шт.</p>
      </div>
    </article>
  );
}

function SellerCartBlock({
  seller,
  newItems,
  usedItems,
  allItems,
  selectedItems,
  onSelectAll,
  onItemSelect,
  onQuantityChange,
  onRemove,
  onRemoveSelected,
  onCheckout,
  onCheckoutSelected,
  isAuthorized,
  calculateSellerTotal,
  checkoutLabel = 'Оформить заказ',
}) {
  const allSelected = allItems.length > 0 && allItems.every((item) => selectedItems.has(item.id));
  const someSelected = allItems.some((item) => selectedItems.has(item.id));
  const selectedCount = allItems.filter((item) => selectedItems.has(item.id)).length;
  const totalQty = allItems.reduce((sum, item) => sum + item.quantity, 0);
  const hasNew = newItems.length > 0;
  const hasUsed = usedItems.length > 0;

  const renderItems = (items, showDelivery) =>
    items.map((item) => (
      <CartItemRow
        key={item.id}
        item={item}
        selected={selectedItems.has(item.id)}
        onSelect={() => onItemSelect(item.id)}
        onQuantityChange={onQuantityChange}
        onRemove={onRemove}
        showDelivery={showDelivery}
      />
    ));

  return (
    <section className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
      <header className="border-b border-gray-100 bg-gradient-to-r from-gray-50 to-white px-4 py-4 sm:px-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex items-start gap-3">
            <input
              type="checkbox"
              checked={allSelected}
              ref={(el) => {
                if (el) el.indeterminate = someSelected && !allSelected;
              }}
              onChange={onSelectAll}
              className="mt-1 h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
              aria-label={`Выбрать все у ${seller}`}
            />
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-lg font-semibold text-gray-900 sm:text-xl">{seller}</h2>
                {hasNew && hasUsed && (
                  <span className="text-xs text-gray-500">новые и б/у</span>
                )}
              </div>
              <p className="mt-0.5 text-sm text-gray-500">
                {allItems.length} поз. · {totalQty} шт. · {formatPrice(calculateSellerTotal(allItems))}
              </p>
            </div>
          </div>
        </div>
      </header>

      <div className="space-y-2 px-4 py-5 sm:px-6">
        {newItems.length > 0 && renderItems(newItems, false)}
        {usedItems.length > 0 && renderItems(usedItems, false)}
      </div>

      <footer className="border-t border-gray-100 bg-gray-50/80 px-4 py-4 sm:px-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="text-sm text-gray-600">
            {selectedCount > 0 ? (
              <span>
                Выбрано: <span className="font-medium text-gray-900">{selectedCount}</span> из{' '}
                {allItems.length}
              </span>
            ) : (
              <span>Выберите товары для оформления</span>
            )}
          </div>

          <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-end">
            {someSelected && (
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={onRemoveSelected}
                  className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-red-200 bg-white px-3 py-2 text-sm font-medium text-red-700 hover:bg-red-50"
                >
                  <img src="/img/trash_full.svg" alt="" className="h-3.5 w-3.5 opacity-70" />
                  Удалить выбранное
                </button>
                <button
                  type="button"
                  onClick={onCheckoutSelected}
                  className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-indigo-200 bg-indigo-50 px-3 py-2 text-sm font-medium text-indigo-700 hover:bg-indigo-100"
                >
                  {isAuthorized ? 'Оформить выбранное' : 'Оформить выбранное'}
                </button>
              </div>
            )}

            <div className="flex flex-wrap items-center gap-3 sm:justify-end">
              <div className="mr-auto sm:mr-0 sm:text-right">
                <p className="text-xs text-gray-500">Итого по организации</p>
                <p className="text-lg font-bold text-gray-900">
                  {formatPrice(calculateSellerTotal(allItems))}
                </p>
              </div>
              <button
                type="button"
                onClick={() => allItems.forEach((item) => onRemove(item.id))}
                className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                Очистить
              </button>
              <button
                type="button"
                onClick={onCheckout}
                className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 sm:flex-none"
              >
                <img src="/img/cart.svg" alt="" className="h-4 w-4 brightness-0 invert" />
                {checkoutLabel}
              </button>
            </div>
          </div>
        </div>
      </footer>
    </section>
  );
}

function PageState({ icon, title, description, action, iconWrapClassName = 'bg-gray-100' }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border border-gray-200 bg-white px-6 py-16 text-center shadow-sm">
      <div className={`mb-6 flex h-20 w-20 items-center justify-center rounded-full ${iconWrapClassName}`}>{icon}</div>
      <h2 className="text-xl font-semibold text-gray-900 sm:text-2xl">{title}</h2>
      {description ? <p className="mt-2 max-w-sm text-sm text-gray-500">{description}</p> : null}
      {action ? <div className="mt-6">{action}</div> : null}
    </div>
  );
}

export default function CartPage() {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const cart = useSelector(selectCart);
  const loading = useSelector(selectCartLoading);
  const error = useSelector(selectCartError);
  const isInitialLoad = loading && !cart;
  const isAuthorized = useSelector((state) => Boolean(state.auth.token));

  const [selectedItems, setSelectedItems] = useState(new Set());
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const pendingCheckoutRef = useRef(null);

  useEffect(() => {
    dispatch(fetchCart());
  }, [dispatch]);

  const mapNewItem = useCallback((item) => ({
    id: item.id,
    type: 'new',
    seller: 'Новые запчасти',
    brand: item.brand,
    number: item.partnumber,
    name: formatProductDisplayTitle(item.brand, item.partnumber, item.name),
    deliveryDate: item.delivery,
    price: item.price,
    quantity: item.quantity,
    maxQuantity: item.max_quantity,
    stock_id: item.stock_id,
    product_id: item.product_id,
    image: '/api/placeholder/80/80',
  }), []);

  const newPartsItems = useMemo(() => {
    if (!cart?.new_parts_items?.length) return [];
    return cart.new_parts_items.map((item) => mapNewItem(item));
  }, [cart, mapNewItem]);

  const usedGroupedItems = useMemo(() => {
    if (!cart?.used_parts_items?.length) return {};
    const groups = {};
    cart.used_parts_items.forEach((item) => {
      const seller = item.seller || 'Продавец';
      if (!groups[seller]) groups[seller] = [];
      groups[seller].push({
        id: item.id,
        type: 'used',
        seller,
        brand: item.brand,
        number: item.partnumber,
        internalCode: item.partnumber,
        name: `${item.brand} ${item.partnumber}`,
        deliveryDate: item.delivery,
        price: item.price,
        quantity: item.quantity,
        maxQuantity: item.max_quantity,
        product_id: item.product_id,
        image: '/api/placeholder/80/80',
      });
    });
    return groups;
  }, [cart]);

  const cartItems = useMemo(
    () => [...newPartsItems, ...Object.values(usedGroupedItems).flat()],
    [newPartsItems, usedGroupedItems]
  );

  const usedSellerGroups = useMemo(
    () =>
      Object.entries(usedGroupedItems).map(([seller, items]) => ({
        seller,
        items,
        newItems: [],
        usedItems: items,
      })),
    [usedGroupedItems]
  );

  const grandTotal = useMemo(
    () => cartItems.reduce((sum, item) => sum + item.price * item.quantity, 0),
    [cartItems]
  );

  const grandQty = useMemo(
    () => cartItems.reduce((sum, item) => sum + item.quantity, 0),
    [cartItems]
  );

  const handleQuantityChange = async (id, newQuantity) => {
    const quantity = Math.max(1, newQuantity);
    const cartItem = cartItems.find((item) => item.id === id);
    if (!cartItem) {
      dispatch(fetchCart());
      return;
    }
    const maxAllowed = getMaxAllowedQuantity(cartItem);
    const safeQuantity = Math.max(1, Math.min(quantity, maxAllowed));
    try {
      if (cartItem.type === 'used') {
        await dispatch(updateUsedCartItemQuantity({ itemId: id, quantity: safeQuantity })).unwrap();
      } else {
        await dispatch(updateCartItemQuantity({ itemId: id, quantity: safeQuantity })).unwrap();
      }
    } catch {
      dispatch(fetchCart());
    }
  };

  const handleRemoveItem = async (id) => {
    setSelectedItems((prev) => {
      const newSet = new Set(prev);
      newSet.delete(id);
      return newSet;
    });
    const cartItem = cartItems.find((item) => item.id === id);
    try {
      if (cartItem?.type === 'used') {
        await dispatch(removeUsedFromCart(id)).unwrap();
      } else {
        await dispatch(removeFromCart(id)).unwrap();
      }
    } catch {
      dispatch(fetchCart());
    }
  };

  const openAuthModalForCheckout = useCallback((payload) => {
    pendingCheckoutRef.current = payload;
    setIsAuthModalOpen(true);
  }, []);

  const finalizeUsedCheckout = useCallback((items, seller) => {
    const usedOnly = items.filter((item) => item.type === 'used');
    if (!usedOnly.length) return;
    const orderData = {
      items: usedOnly,
      seller,
      deliverInParts: false,
      checkoutType: 'used',
    };
    localStorage.setItem('orderData', JSON.stringify(orderData));
    navigate('/order-reg');
  }, [navigate]);

  const saveUsedOrderAndNavigate = useCallback(
    (items, seller) => {
      if (!isAuthorized) {
        openAuthModalForCheckout({ type: 'used', items, seller });
        return;
      }
      finalizeUsedCheckout(items, seller);
    },
    [finalizeUsedCheckout, isAuthorized, openAuthModalForCheckout]
  );

  const handleNewPartsCheckout = useCallback(() => {
    if (!isAuthorized) {
      openAuthModalForCheckout({ type: 'new' });
      return;
    }
    navigate('/cart/new/checkout');
  }, [isAuthorized, navigate, openAuthModalForCheckout]);

  const handleNewPartsCheckoutSelected = useCallback(() => {
    if (!isAuthorized) {
      openAuthModalForCheckout({ type: 'new' });
      return;
    }
    const selected = newPartsItems.filter((item) => selectedItems.has(item.id));
    if (selected.length === 0) return;
    navigate('/cart/new/checkout');
  }, [isAuthorized, navigate, newPartsItems, openAuthModalForCheckout, selectedItems]);

  const handleAuthSuccess = useCallback(() => {
    setIsAuthModalOpen(false);
    const pending = pendingCheckoutRef.current;
    pendingCheckoutRef.current = null;
    if (!pending) return;

    if (pending.type === 'used') {
      finalizeUsedCheckout(pending.items || [], pending.seller || 'Организация');
      return;
    }

    if (pending.type === 'new') {
      navigate('/cart/new/checkout');
    }
  }, [finalizeUsedCheckout, navigate]);

  const handleCheckout = (seller) => {
    saveUsedOrderAndNavigate(usedGroupedItems[seller] || [], seller);
  };

  const handleCheckoutSelected = (seller) => {
    const selected = (usedGroupedItems[seller] || []).filter((item) => selectedItems.has(item.id));
    saveUsedOrderAndNavigate(selected, seller);
  };

  const handleItemSelect = (itemId) => {
    setSelectedItems((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(itemId)) newSet.delete(itemId);
      else newSet.add(itemId);
      return newSet;
    });
  };

  const handleSelectAllNewItems = () => {
    const ids = newPartsItems.map((item) => item.id);
    const allSelected = ids.every((id) => selectedItems.has(id));
    setSelectedItems((prev) => {
      const newSet = new Set(prev);
      if (allSelected) ids.forEach((id) => newSet.delete(id));
      else ids.forEach((id) => newSet.add(id));
      return newSet;
    });
  };

  const handleSelectAllSellerItems = (seller) => {
    const sellerItemIds = (usedGroupedItems[seller] || []).map((item) => item.id);
    const allSelected = sellerItemIds.every((id) => selectedItems.has(id));
    setSelectedItems((prev) => {
      const newSet = new Set(prev);
      if (allSelected) sellerItemIds.forEach((id) => newSet.delete(id));
      else sellerItemIds.forEach((id) => newSet.add(id));
      return newSet;
    });
  };

  const calculateSellerTotal = (items) =>
    items.reduce((total, item) => total + item.price * item.quantity, 0);

  return (
    <div className="max-md:mt-0 mt-5 pb-8">
      <div className="mb-6 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm font-medium text-indigo-600">Покупки</p>
          <h1 className="text-2xl font-bold text-gray-900 sm:text-3xl">Корзина</h1>
          {!isInitialLoad && cartItems.length > 0 && (
            <p className="mt-1 text-sm text-gray-500">
              {newPartsItems.length > 0 && 'новые запчасти'}
              {newPartsItems.length > 0 && usedSellerGroups.length > 0 && ' · '}
              {usedSellerGroups.length > 0 &&
                `${usedSellerGroups.length} ${
                  usedSellerGroups.length === 1 ? 'продавец б/у' : 'продавцов б/у'
                }`}
              · {cartItems.length} поз. · {grandQty} шт.
            </p>
          )}
        </div>
        {!isInitialLoad && cartItems.length > 0 && (
          <div className="rounded-xl border border-gray-200 bg-white px-4 py-3 shadow-sm sm:text-right">
            <p className="text-xs text-gray-500">Общая сумма</p>
            <p className="text-xl font-bold text-gray-900">{formatPrice(grandTotal)}</p>
          </div>
        )}
      </div>

      {isInitialLoad ? (
        <PageState
          icon={
            <svg className="h-10 w-10 animate-spin text-indigo-600" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
              />
            </svg>
          }
          title="Загрузка корзины..."
        />
      ) : error ? (
        <PageState
          icon={
            <svg className="h-10 w-10 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z"
              />
            </svg>
          }
          title="Не удалось загрузить корзину"
          description={typeof error === 'object' ? error.detail || 'Произошла ошибка' : String(error)}
          action={
            <button
              type="button"
              onClick={() => dispatch(fetchCart())}
              className="rounded-xl bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-indigo-700"
            >
              Попробовать снова
            </button>
          }
        />
      ) : cartItems.length === 0 ? (
        <PageState
          icon={<CartOutlineIcon />}
          iconWrapClassName="bg-indigo-50"
          title="Корзина пуста"
          description="Добавьте новые или б/у запчасти — они сгруппируются по организациям продавцов"
          action={
            <Link
              to="/autoparts"
              className="inline-flex rounded-xl bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-indigo-700"
            >
              Перейти к каталогу
            </Link>
          }
        />
      ) : (
        <div className="space-y-6">
          {newPartsItems.length > 0 && (
            <SellerCartBlock
              seller="Новые запчасти"
              newItems={newPartsItems}
              usedItems={[]}
              allItems={newPartsItems}
              selectedItems={selectedItems}
              onSelectAll={handleSelectAllNewItems}
              onItemSelect={handleItemSelect}
              onQuantityChange={handleQuantityChange}
              onRemove={handleRemoveItem}
              onRemoveSelected={() => {
                newPartsItems
                  .filter((item) => selectedItems.has(item.id))
                  .forEach((item) => handleRemoveItem(item.id));
              }}
              onCheckout={handleNewPartsCheckout}
              onCheckoutSelected={handleNewPartsCheckoutSelected}
              isAuthorized={isAuthorized}
              calculateSellerTotal={calculateSellerTotal}
              checkoutLabel="Оформить заказ"
            />
          )}

          {usedSellerGroups.length > 0 &&
            usedSellerGroups.map(({ seller, items, usedItems }) => (
              <SellerCartBlock
                key={seller}
                seller={seller}
                newItems={[]}
                usedItems={usedItems}
                allItems={items}
                selectedItems={selectedItems}
                onSelectAll={() => handleSelectAllSellerItems(seller)}
                onItemSelect={handleItemSelect}
                onQuantityChange={handleQuantityChange}
                onRemove={handleRemoveItem}
                onRemoveSelected={() => {
                  items
                    .filter((item) => selectedItems.has(item.id))
                    .forEach((item) => handleRemoveItem(item.id));
                }}
                onCheckout={() => handleCheckout(seller)}
                onCheckoutSelected={() => handleCheckoutSelected(seller)}
                isAuthorized={isAuthorized}
                calculateSellerTotal={calculateSellerTotal}
              />
            ))}
        </div>
      )}

      <CartAuthModal
        isOpen={isAuthModalOpen}
        onClose={() => {
          setIsAuthModalOpen(false);
          pendingCheckoutRef.current = null;
        }}
        onAuthSuccess={handleAuthSuccess}
      />
    </div>
  );
}
