import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import {
  selectCart,
  selectCartLoading,
  selectCartError,
  selectNewPartsBaskets,
  selectActiveNewPartsBasketId,
  fetchCart,
  updateCartItemQuantity,
  updateUsedCartItemQuantity,
  removeFromCart,
  removeUsedFromCart,
  setActiveNewPartsBasket,
  renameNewPartsBasket,
  deleteNewPartsBasket,
} from '../../redux/slices/CartSlice';
import { formatProductDisplayTitle } from '../../utils/productDisplayName';
import { setNewPartsCheckoutItemIds, clearNewPartsCheckoutItemIds } from '../../utils/newPartsCheckout';
import CartAuthModal from '../../components/CartAuthModal/CartAuthModal';
import UnderlineTabs from '../../components/UI/UnderlineTabs';
import Modal from '../../components/UI/Modal';
import Button from '../../components/UI/Button';
import Card from '../../components/UI/Card';
import EmptyState from '../../components/UI/EmptyState';
import { FieldLabel, Input } from '../../components/UI/Field';
import { PageHeader } from '../../components/UI/SectionHeader';
import { CLIENT_MARKUP_DISPLAY_BOTH } from '../../redux/slices/ClientMarkupSlice';
import { isOrganizationStaff } from '../../utils/clientMarkupUtils';
import { formatNewPartMoney, truncateRubles } from '../../pages/AutoParts/NewParts/newPartStockUtils';

const formatNewPartPrice = (price) => formatNewPartMoney(price);

const formatUsedPrice = (price) =>
  new Intl.NumberFormat('ru-RU', { style: 'currency', currency: 'RUB' }).format(price || 0);

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
      <span className="inline-flex items-center rounded-sg bg-accent-50 px-2 py-0.5 text-xs font-medium text-accent-700 ring-1 ring-inset ring-accent-600/20">
        Б/У
      </span>
    );
  }
  return (
    <span className="inline-flex items-center rounded-sg bg-brand-50 px-2 py-0.5 text-xs font-medium text-brand-700 ring-1 ring-inset ring-brand-600/20">
      Новая
    </span>
  );
}

function QuantityControl({ quantity, onDecrease, onIncrease, max }) {
  return (
    <div className="inline-flex items-center gap-0.5 rounded-lg border border-line bg-surface-muted p-0.5">
      <button
        type="button"
        onClick={onDecrease}
        disabled={quantity <= 1}
        className="flex h-8 w-8 items-center justify-center rounded-md text-ink-muted transition hover:bg-surface disabled:cursor-not-allowed disabled:opacity-40"
        aria-label="Уменьшить количество"
      >
        <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12H4" />
        </svg>
      </button>
      <span className="min-w-[1.75rem] text-center text-sm font-semibold text-ink">{quantity}</span>
      <button
        type="button"
        onClick={onIncrease}
        disabled={quantity >= max}
        className="flex h-8 w-8 items-center justify-center rounded-md text-ink-muted transition hover:bg-surface disabled:cursor-not-allowed disabled:opacity-40"
        aria-label="Увеличить количество"
      >
        <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
  showPurchasePrice,
}) {
  const maxQty = getMaxAllowedQuantity(item);
  const lineTotal = item.price * item.quantity;
  const formatItemPrice = item.type === 'new' ? formatNewPartPrice : formatUsedPrice;
  const showPurchase = showPurchasePrice
    && item.purchasePrice > 0
    && Math.abs(item.price - item.purchasePrice) > 0.009;

  return (
    <article className="flex gap-2.5 rounded-sg border border-line bg-surface p-2.5 transition hover:border-brand-200 sm:gap-3 sm:p-3">
      <input
        type="checkbox"
        checked={selected}
        onChange={onSelect}
        className="mt-1 h-4 w-4 shrink-0 rounded border-line text-brand-600 focus:ring-brand-500"
        aria-label={`Выбрать ${item.name}`}
      />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-start gap-1.5">
          <PartTypeBadge type={item.type} />
          <h3 className="min-w-0 flex-1 text-sm font-medium leading-snug text-ink">{item.name}</h3>
        </div>
        {item.type === 'new' && item.brand && item.number ? (
          <p className="mt-0.5 text-xs text-ink-muted">
            {item.brand} · {item.number}
          </p>
        ) : null}
        {item.type !== 'new' && (
          <p className="mt-0.5 text-xs text-ink-muted">
            {item.brand} · {item.number}
          </p>
        )}
        {showDelivery && (
          <p className="mt-1 flex items-start gap-1 text-xs text-ink-muted">
            <svg
              className="mt-0.5 h-3 w-3 shrink-0 text-brand-500"
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
              {item.deliveryDate ? formatDeliveryTime(item.deliveryDate) : 'Срок не указан'}
            </span>
          </p>
        )}
        <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
          <QuantityControl
            quantity={item.quantity}
            max={maxQty}
            onDecrease={() => onQuantityChange(item.id, item.quantity - 1)}
            onIncrease={() => onQuantityChange(item.id, item.quantity + 1)}
          />
          <button
            type="button"
            onClick={() => onRemove(item.id)}
            className="text-xs font-medium text-danger-600 hover:text-danger-700"
          >
            Удалить
          </button>
        </div>
      </div>
      <div className="shrink-0 text-right">
        <p className="text-sm font-bold text-ink">{formatItemPrice(lineTotal)}</p>
        <p className="mt-0.5 text-[11px] text-ink-muted">{formatItemPrice(item.price)} / шт.</p>
        {showPurchase ? (
          <p className="mt-0.5 text-[10px] text-ink-muted">
            Закуп. {formatItemPrice(item.purchasePrice)}
          </p>
        ) : null}
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
  onClearAll,
  isAuthorized,
  calculateSellerTotal,
  checkoutLabel = 'Оформить заказ',
  showPurchasePrice = false,
  formatTotalPrice = formatNewPartPrice,
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
        showPurchasePrice={showPurchasePrice && item.type === 'new'}
      />
    ));

  return (
    <Card padding="none" className="overflow-hidden">
      <header className="border-b border-line bg-surface-muted px-3 py-3 sm:px-4">
        <div className="flex items-start gap-2.5">
          <input
            type="checkbox"
            checked={allSelected}
            ref={(el) => {
              if (el) el.indeterminate = someSelected && !allSelected;
            }}
            onChange={onSelectAll}
            className="mt-0.5 h-4 w-4 rounded border-line text-brand-600 focus:ring-brand-500"
            aria-label={`Выбрать все у ${seller}`}
          />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="truncate text-base font-semibold text-ink sm:text-lg">{seller}</h2>
              {hasNew && hasUsed ? (
                <span className="text-xs text-ink-muted">новые и б/у</span>
              ) : null}
            </div>
            <p className="mt-0.5 text-xs text-ink-muted sm:text-sm">
              {allItems.length} поз. · {totalQty} шт. · {formatTotalPrice(calculateSellerTotal(allItems))}
            </p>
          </div>
        </div>
      </header>

      <div className="space-y-2 p-3 sm:p-4">
        {newItems.length > 0 && renderItems(newItems, true)}
        {usedItems.length > 0 && renderItems(usedItems, false)}
      </div>

      <footer className="border-t border-line bg-surface-muted/80 px-3 py-3 sm:px-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <p className="text-xs text-ink-muted sm:text-sm">
            {selectedCount > 0 ? (
              <>
                Выбрано <span className="font-medium text-ink">{selectedCount}</span> из {allItems.length}
              </>
            ) : (
              'Отметьте позиции для частичного оформления'
            )}
          </p>

          <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center sm:justify-end">
            {someSelected ? (
              <div className="flex flex-wrap gap-2">
                <Button variant="secondary" size="sm" onClick={onRemoveSelected}>
                  Удалить выбранное
                </Button>
                <Button variant="soft" size="sm" onClick={onCheckoutSelected}>
                  Оформить выбранное
                </Button>
              </div>
            ) : null}

            <div className="flex flex-wrap items-center gap-2 sm:justify-end">
              <div className="mr-auto text-left sm:mr-0 sm:text-right">
                <p className="text-[11px] text-ink-muted">Итого</p>
                <p className="text-base font-bold text-ink">{formatTotalPrice(calculateSellerTotal(allItems))}</p>
              </div>
              <Button variant="secondary" size="sm" onClick={onClearAll}>
                Очистить
              </Button>
              <Button size="sm" onClick={onCheckout}>
                {checkoutLabel}
              </Button>
            </div>
          </div>
        </div>
      </footer>
    </Card>
  );
}

export default function CartPage() {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const cart = useSelector(selectCart);
  const loading = useSelector(selectCartLoading);
  const error = useSelector(selectCartError);
  const newPartsBaskets = useSelector(selectNewPartsBaskets);
  const activeBasketId = useSelector(selectActiveNewPartsBasketId);
  const isInitialLoad = loading && !cart;
  const isAuthorized = useSelector((state) => Boolean(state.auth.token));
  const user = useSelector((state) => state.auth.user);
  const clientMarkup = useSelector((state) => state.clientMarkup);
  const showPurchaseInCart = isOrganizationStaff(user)
    && clientMarkup.displayMode === CLIENT_MARKUP_DISPLAY_BOTH
    && clientMarkup.showPurchaseInCart;

  const [selectedItems, setSelectedItems] = useState(new Set());
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [renameOpen, setRenameOpen] = useState(false);
  const [renameValue, setRenameValue] = useState('');
  const [renameSaving, setRenameSaving] = useState(false);
  const [renameError, setRenameError] = useState('');
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
    price: truncateRubles(item.price),
    purchasePrice: truncateRubles(item.purchase_price),
    quantity: item.quantity,
    maxQuantity: item.max_quantity,
    stock_id: item.stock_id,
    product_id: item.product_id,
    image: '/api/placeholder/80/80',
  }), []);

  const activeBasket = useMemo(() => {
    if (!newPartsBaskets.length) return null;
    return (
      newPartsBaskets.find((b) => b.id === activeBasketId)
      || newPartsBaskets.find((b) => b.is_default)
      || newPartsBaskets[0]
    );
  }, [newPartsBaskets, activeBasketId]);

  const allNewPartsItems = useMemo(() => {
    if (!cart?.new_parts_items?.length) return [];
    return cart.new_parts_items.map((item) => mapNewItem(item));
  }, [cart, mapNewItem]);

  const newPartsItems = useMemo(() => {
    const sourceItems = activeBasket?.items?.length
      ? activeBasket.items
      : cart?.new_parts_items || [];
    if (!sourceItems.length) return [];
    return sourceItems.map((item) => mapNewItem(item));
  }, [activeBasket, cart, mapNewItem]);

  const basketTabs = useMemo(() => {
    const sorted = [...newPartsBaskets]
      .filter((basket) => basket.is_default || (basket.item_count ?? 0) > 0)
      .sort((a, b) => {
        if (a.is_default) return -1;
        if (b.is_default) return 1;
        return a.name.localeCompare(b.name, 'ru');
      });
    return sorted.map((basket) => ({
      id: String(basket.id),
      label: basket.name,
      count: basket.item_count,
      title: basket.name,
    }));
  }, [newPartsBaskets]);

  const defaultBasket = useMemo(
    () => newPartsBaskets.find((b) => b.is_default) || newPartsBaskets[0] || null,
    [newPartsBaskets],
  );

  useEffect(() => {
    if (!newPartsBaskets.length) return;
    const visibleIds = newPartsBaskets
      .filter((b) => b.is_default || (b.item_count ?? 0) > 0)
      .map((b) => b.id);
    if (!visibleIds.length) return;
    if (!visibleIds.includes(activeBasketId)) {
      const fallbackId = defaultBasket?.id && visibleIds.includes(defaultBasket.id)
        ? defaultBasket.id
        : visibleIds[0];
      dispatch(setActiveNewPartsBasket(fallbackId));
    }
  }, [activeBasketId, defaultBasket?.id, dispatch, newPartsBaskets]);

  const activeBasketTotal = useMemo(
    () => newPartsItems.reduce((sum, item) => sum + item.price * item.quantity, 0),
    [newPartsItems],
  );

  const activeBasketQty = useMemo(
    () => newPartsItems.reduce((sum, item) => sum + item.quantity, 0),
    [newPartsItems],
  );

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
    () => [...allNewPartsItems, ...Object.values(usedGroupedItems).flat()],
    [allNewPartsItems, usedGroupedItems]
  );

  const hasVisibleCartContent = cartItems.length > 0;

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

  const handleClearNewPartsBasket = useCallback(async () => {
    const basketToDelete = activeBasket && !activeBasket.is_default ? activeBasket : null;
    const itemsToRemove = [...newPartsItems];

    for (const item of itemsToRemove) {
      try {
        await dispatch(removeFromCart(item.id)).unwrap();
      } catch {
        // continue clearing remaining items
      }
    }

    try {
      await dispatch(fetchCart()).unwrap();
    } catch {
      // state will refresh on next interaction
    }

    if (basketToDelete?.id) {
      try {
        await dispatch(deleteNewPartsBasket(basketToDelete.id)).unwrap();
      } catch {
        // basket may already be auto-deleted after last item removal
      }
    }

    if (defaultBasket?.id) {
      dispatch(setActiveNewPartsBasket(defaultBasket.id));
    }
  }, [activeBasket, defaultBasket?.id, dispatch, newPartsItems]);

  const handleClearUsedBasket = useCallback(async (items) => {
    for (const item of items) {
      try {
        await dispatch(removeUsedFromCart(item.id)).unwrap();
      } catch {
        // continue
      }
    }
    dispatch(fetchCart());
  }, [dispatch]);

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
    if (activeBasket?.id) {
      dispatch(setActiveNewPartsBasket(activeBasket.id));
    }
    clearNewPartsCheckoutItemIds();
    if (!isAuthorized) {
      openAuthModalForCheckout({ type: 'new' });
      return;
    }
    navigate('/cart/new/checkout');
  }, [activeBasket?.id, dispatch, isAuthorized, navigate, openAuthModalForCheckout]);

  const handleNewPartsCheckoutSelected = useCallback(() => {
    if (activeBasket?.id) {
      dispatch(setActiveNewPartsBasket(activeBasket.id));
    }
    const selected = newPartsItems.filter((item) => selectedItems.has(item.id));
    if (selected.length === 0) return;
    setNewPartsCheckoutItemIds(selected.map((item) => item.id));
    if (!isAuthorized) {
      openAuthModalForCheckout({ type: 'new', partial: true });
      return;
    }
    navigate('/cart/new/checkout');
  }, [activeBasket?.id, dispatch, isAuthorized, navigate, newPartsItems, openAuthModalForCheckout, selectedItems]);

  const openRenameModal = () => {
    if (!activeBasket || activeBasket.is_default) return;
    setRenameValue(activeBasket.name);
    setRenameError('');
    setRenameOpen(true);
  };

  const handleRenameBasket = async (e) => {
    e.preventDefault();
    if (!activeBasket || activeBasket.is_default) return;
    const name = renameValue.trim();
    if (!name) {
      setRenameError('Укажите название');
      return;
    }
    setRenameSaving(true);
    setRenameError('');
    try {
      await dispatch(renameNewPartsBasket({ basketId: activeBasket.id, name })).unwrap();
      setRenameOpen(false);
    } catch (err) {
      setRenameError(typeof err === 'string' ? err : 'Не удалось переименовать');
    } finally {
      setRenameSaving(false);
    }
  };

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
      <PageHeader
        title="Корзина"
        subtitle={
          !isInitialLoad && cartItems.length > 0
            ? `${cartItems.length} поз. · ${grandQty} шт. · ${formatUsedPrice(grandTotal)}`
            : 'Новые запчасти и б/у от разных продавцов'
        }
      />

      {isInitialLoad ? (
        <EmptyState
          illustration="empty"
          title="Загрузка корзины…"
          className="border-solid"
        />
      ) : error ? (
        <EmptyState
          illustration="error"
          title="Не удалось загрузить корзину"
          description={typeof error === 'object' ? error.detail || 'Произошла ошибка' : String(error)}
          actionLabel="Попробовать снова"
          onAction={() => dispatch(fetchCart())}
          className="border-solid"
        />
      ) : (
        <div className={hasVisibleCartContent ? 'lg:grid lg:grid-cols-[minmax(0,1fr)_17rem] lg:items-start lg:gap-5 xl:grid-cols-[minmax(0,1fr)_19rem]' : ''}>
          <div className="space-y-4">
          {newPartsBaskets.length > 0 ? (
            <div className="space-y-4">
              {basketTabs.length > 0 ? (
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <UnderlineTabs
                    tabs={basketTabs}
                    value={String(activeBasket?.id || basketTabs[0]?.id || '')}
                    onChange={(id) => dispatch(setActiveNewPartsBasket(Number(id)))}
                    ariaLabel="Корзины новых запчастей"
                  />
                  {activeBasket && !activeBasket.is_default ? (
                    <Button variant="secondary" size="sm" onClick={openRenameModal} className="self-start">
                      Переименовать
                    </Button>
                  ) : null}
                </div>
              ) : null}

              {newPartsItems.length > 0 ? (
                <SellerCartBlock
                  seller={activeBasket?.name || 'Новые запчасти'}
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
                  onClearAll={handleClearNewPartsBasket}
                  isAuthorized={isAuthorized}
                  calculateSellerTotal={calculateSellerTotal}
                  checkoutLabel="Оформить заказ"
                  showPurchasePrice={showPurchaseInCart}
                />
              ) : (
                <div className="rounded-sg border border-dashed border-line px-4 py-8 text-center text-sm text-ink-muted">
                  {activeBasket?.is_default
                    ? 'Добавьте новые запчасти из каталога или VIN-поиска'
                    : `Корзина «${activeBasket?.name || 'Новые запчасти'}» пуста`}
                </div>
              )}
            </div>
          ) : !hasVisibleCartContent && usedSellerGroups.length === 0 ? (
            <div className="rounded-sg border border-dashed border-line px-4 py-8 text-center text-sm text-ink-muted">
              Добавьте новые запчасти из каталога или VIN-поиска
            </div>
          ) : null}

          {!newPartsBaskets.length && newPartsItems.length > 0 && (
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
              onClearAll={handleClearNewPartsBasket}
              isAuthorized={isAuthorized}
              calculateSellerTotal={calculateSellerTotal}
              checkoutLabel="Оформить заказ"
              showPurchasePrice={showPurchaseInCart}
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
                onClearAll={() => handleClearUsedBasket(items)}
                isAuthorized={isAuthorized}
                calculateSellerTotal={calculateSellerTotal}
                formatTotalPrice={formatUsedPrice}
              />
            ))}
          </div>

          {hasVisibleCartContent ? (
          <aside className="mt-4 space-y-3 lg:sticky lg:top-4 lg:mt-0">
            <Card padding="sm">
              <p className="text-xs font-medium uppercase tracking-wide text-ink-muted">Общая сумма</p>
              <p className="mt-1 text-2xl font-bold text-ink">{formatUsedPrice(grandTotal)}</p>
              <p className="mt-1 text-xs text-ink-muted">
                {grandQty} шт. · {cartItems.length} поз.
              </p>
            </Card>
            {activeBasket && newPartsItems.length > 0 ? (
              <Card padding="sm">
                <p className="text-xs font-medium uppercase tracking-wide text-ink-muted">Текущая корзина</p>
                <p className="mt-1 truncate text-sm font-semibold text-ink" title={activeBasket.name}>
                  {activeBasket.name}
                </p>
                <p className="mt-2 text-lg font-bold text-ink">{formatNewPartPrice(activeBasketTotal)}</p>
                <p className="text-xs text-ink-muted">{activeBasketQty} шт.</p>
                <Button className="mt-3 w-full" size="sm" onClick={handleNewPartsCheckout}>
                  Оформить
                </Button>
              </Card>
            ) : null}
          </aside>
          ) : null}
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

      <Modal
        open={renameOpen}
        onClose={() => {
          if (!renameSaving) setRenameOpen(false);
        }}
        title="Переименовать корзину"
        size="sm"
        footer={
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setRenameOpen(false)} disabled={renameSaving}>
              Отмена
            </Button>
            <Button type="submit" form="rename-basket-form" loading={renameSaving}>
              Сохранить
            </Button>
          </div>
        }
      >
        <form id="rename-basket-form" onSubmit={handleRenameBasket} className="space-y-3">
          <div>
            <FieldLabel htmlFor="rename-basket-input">Название</FieldLabel>
            <Input
              id="rename-basket-input"
              value={renameValue}
              onChange={(e) => setRenameValue(e.target.value)}
              maxLength={100}
              disabled={renameSaving}
              autoFocus
              error={Boolean(renameError)}
            />
            {renameError ? <p className="mt-1.5 text-xs text-danger-600">{renameError}</p> : null}
          </div>
        </form>
      </Modal>
    </div>
  );
}
