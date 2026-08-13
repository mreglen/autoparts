import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import {
  selectCart,
  selectCartLoading,
  selectCartError,
  selectNewPartsBaskets,
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
import Modal from '../../components/UI/Modal';
import Button from '../../components/UI/Button';
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
  if (!deliveryString) return '—';

  if (
    typeof deliveryString === 'string'
    && deliveryString.includes('с')
    && deliveryString.includes('до')
  ) {
    return deliveryString;
  }

  if (
    deliveryString
    && typeof deliveryString === 'object'
    && deliveryString.delivery_start
    && deliveryString.delivery_end
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
      return '—';
    }
  }

  return formatDate(deliveryString);
}

function formatDate(dateString) {
  if (!dateString) return '—';
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
        dateString.minute || 0,
      );
    } else {
      date = new Date(dateString);
    }
    if (Number.isNaN(date.getTime())) return '—';
    return date.toLocaleDateString('ru-RU');
  } catch {
    return '—';
  }
}

function getMaxAllowedQuantity(item) {
  const max = item?.maxQuantity;
  if (max != null && max > 0) return max;
  if (item?.type === 'new') return 99;
  return Math.max(1, item?.quantity || 1);
}

function QuantityStepper({ quantity, onDecrease, onIncrease, max }) {
  return (
    <div className="inline-flex items-center overflow-hidden rounded-lg border border-line bg-surface">
      <button
        type="button"
        onClick={onDecrease}
        disabled={quantity <= 1}
        className="flex h-8 w-7 items-center justify-center text-ink-muted transition hover:bg-surface-muted disabled:opacity-40"
        aria-label="Уменьшить"
      >
        −
      </button>
      <input
        type="text"
        readOnly
        value={quantity}
        className="h-8 w-9 border-x border-line bg-surface text-center text-sm font-medium text-ink"
        aria-label="Количество"
      />
      <button
        type="button"
        onClick={onIncrease}
        disabled={quantity >= max}
        className="flex h-8 w-7 items-center justify-center text-ink-muted transition hover:bg-surface-muted disabled:opacity-40"
        aria-label="Увеличить"
      >
        +
      </button>
    </div>
  );
}

function CartTableRow({
  item,
  selected,
  onSelect,
  onQuantityChange,
  onRemove,
  showDeliveryColumn,
  showPurchasePrice,
  formatItemPrice,
}) {
  const maxQty = getMaxAllowedQuantity(item);
  const lineTotal = item.price * item.quantity;
  const showPurchase = showPurchasePrice
    && item.purchasePrice > 0
    && Math.abs(item.price - item.purchasePrice) > 0.009;

  return (
    <tr className="border-b border-line last:border-b-0 hover:bg-surface-muted/40">
      <td className="w-10 px-2 py-2.5 align-middle">
        <input
          type="checkbox"
          checked={selected}
          onChange={onSelect}
          className="h-4 w-4 rounded border-line text-brand-600 focus:ring-brand-500"
          aria-label={`Выбрать ${item.partTitle || item.name}`}
        />
      </td>
      <td className="min-w-[5.5rem] px-2 py-2.5 align-middle">
        <p className="text-sm font-semibold text-ink">{item.brand || '—'}</p>
        <p className="text-sm font-medium text-brand-600">{item.number || '—'}</p>
      </td>
      <td className="min-w-[8rem] px-2 py-2.5 align-middle">
        <p className="text-sm text-ink">{item.partTitle || item.name}</p>
      </td>
      {showDeliveryColumn ? (
        <td className="min-w-[7rem] px-2 py-2.5 align-middle text-xs text-ink-muted">
          {item.deliveryDate ? formatDeliveryTime(item.deliveryDate) : '—'}
        </td>
      ) : null}
      <td className="min-w-[5rem] whitespace-nowrap px-2 py-2.5 align-middle text-right">
        <p className="text-sm font-semibold text-brand-600">{formatItemPrice(item.price)}</p>
        {showPurchase ? (
          <p className="text-xs text-ink-muted">{formatItemPrice(item.purchasePrice)}</p>
        ) : null}
      </td>
      <td className="w-[5.5rem] px-2 py-2.5 align-middle">
        <QuantityStepper
          quantity={item.quantity}
          max={maxQty}
          onDecrease={() => onQuantityChange(item.id, item.quantity - 1)}
          onIncrease={() => onQuantityChange(item.id, item.quantity + 1)}
        />
      </td>
      <td className="min-w-[5rem] whitespace-nowrap px-2 py-2.5 align-middle text-right">
        <p className="text-sm font-bold text-ink">{formatItemPrice(lineTotal)}</p>
      </td>
      <td className="w-10 px-2 py-2.5 align-middle text-center">
        <button
          type="button"
          onClick={() => onRemove(item.id)}
          className="inline-flex h-7 w-7 items-center justify-center rounded-md text-ink-muted transition hover:bg-danger-50 hover:text-danger-600"
          aria-label="Удалить"
        >
          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </td>
    </tr>
  );
}

function CartTableBlock({
  title,
  items,
  selectedItems,
  onSelectAll,
  onItemSelect,
  onQuantityChange,
  onRemove,
  onRemoveSelected,
  onCheckout,
  onCheckoutSelected,
  onClearAll,
  onRename,
  canRename = false,
  showDeliveryColumn = true,
  showPurchasePrice = false,
  formatItemPrice = formatNewPartPrice,
  checkoutLabel = 'Оформить заказ',
}) {
  const allSelected = items.length > 0 && items.every((item) => selectedItems.has(item.id));
  const someSelected = items.some((item) => selectedItems.has(item.id));
  const selectedCount = items.filter((item) => selectedItems.has(item.id)).length;
  const blockTotal = items.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const selectedTotal = items
    .filter((item) => selectedItems.has(item.id))
    .reduce((sum, item) => sum + item.price * item.quantity, 0);
  const displayTotal = someSelected ? selectedTotal : blockTotal;

  if (!items.length) return null;

  return (
    <section className="overflow-hidden rounded-sg border border-line bg-surface shadow-sm">
      <header className="flex flex-wrap items-center gap-3 border-b border-line bg-brand-50/50 px-3 py-3 sm:px-4">
        <div className="flex min-w-0 flex-1 items-center gap-2">
          <h2 className="truncate text-base font-semibold text-ink sm:text-lg">{title}</h2>
          {canRename && onRename ? (
            <button
              type="button"
              onClick={onRename}
              className="shrink-0 text-ink-muted transition hover:text-brand-600"
              aria-label="Переименовать корзину"
            >
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"
                />
              </svg>
            </button>
          ) : null}
        </div>
        <p className="text-lg font-bold text-ink sm:ml-auto">{formatItemPrice(displayTotal)}</p>
        <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto">
          {someSelected ? (
            <>
              <Button variant="secondary" size="sm" onClick={onRemoveSelected}>
                Удалить выбранное
              </Button>
              <Button variant="soft" size="sm" onClick={onCheckoutSelected}>
                Оформить выбранное ({selectedCount})
              </Button>
            </>
          ) : null}
          <Button variant="secondary" size="sm" onClick={onClearAll}>
            Очистить
          </Button>
          <Button size="sm" onClick={onCheckout}>
            {checkoutLabel}
          </Button>
        </div>
      </header>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[640px] border-collapse text-left">
          <thead>
            <tr className="border-b border-line bg-surface-muted/60 text-xs font-medium uppercase tracking-wide text-ink-muted">
              <th className="w-10 px-2 py-2.5">
                <input
                  type="checkbox"
                  checked={allSelected}
                  ref={(el) => {
                    if (el) el.indeterminate = someSelected && !allSelected;
                  }}
                  onChange={onSelectAll}
                  className="h-4 w-4 rounded border-line text-brand-600 focus:ring-brand-500"
                  aria-label={`Выбрать все в ${title}`}
                />
              </th>
              <th className="px-2 py-2.5">Запчасть</th>
              <th className="px-2 py-2.5">Наименование</th>
              {showDeliveryColumn ? <th className="px-2 py-2.5">Доставка</th> : null}
              <th className="px-2 py-2.5 text-right">Цена, ₽</th>
              <th className="px-2 py-2.5">Кол-во</th>
              <th className="px-2 py-2.5 text-right">Стоимость, ₽</th>
              <th className="w-10 px-2 py-2.5" aria-hidden />
            </tr>
          </thead>
          <tbody>
            {items.map((item) => (
              <CartTableRow
                key={item.id}
                item={item}
                selected={selectedItems.has(item.id)}
                onSelect={() => onItemSelect(item.id)}
                onQuantityChange={onQuantityChange}
                onRemove={onRemove}
                showDeliveryColumn={showDeliveryColumn}
                showPurchasePrice={showPurchasePrice}
                formatItemPrice={formatItemPrice}
              />
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

export default function CartPage() {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const cart = useSelector(selectCart);
  const loading = useSelector(selectCartLoading);
  const error = useSelector(selectCartError);
  const newPartsBaskets = useSelector(selectNewPartsBaskets);
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
  const [renameBasketId, setRenameBasketId] = useState(null);
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
    partTitle: item.name || '',
    name: formatProductDisplayTitle(item.brand, item.partnumber, item.name),
    deliveryDate: item.delivery,
    price: truncateRubles(item.price),
    purchasePrice: truncateRubles(item.purchase_price),
    quantity: item.quantity,
    maxQuantity: item.max_quantity,
    stock_id: item.stock_id,
    product_id: item.product_id,
    basket_id: item.basket_id,
  }), []);

  const mapBasketItems = useCallback(
    (basket) => {
      const sourceItems = basket?.items?.length ? basket.items : [];
      return sourceItems.map((item) => mapNewItem(item));
    },
    [mapNewItem],
  );

  const visibleNewPartsBaskets = useMemo(() => {
    return [...newPartsBaskets]
      .filter((basket) => basket.is_default || (basket.item_count ?? 0) > 0)
      .sort((a, b) => {
        if (a.is_default) return -1;
        if (b.is_default) return 1;
        return a.name.localeCompare(b.name, 'ru');
      });
  }, [newPartsBaskets]);

  const defaultBasket = useMemo(
    () => newPartsBaskets.find((b) => b.is_default) || newPartsBaskets[0] || null,
    [newPartsBaskets],
  );

  const allNewPartsItems = useMemo(() => {
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
        partTitle: item.name || `${item.brand} ${item.partnumber}`,
        name: `${item.brand} ${item.partnumber}`,
        deliveryDate: item.delivery,
        price: item.price,
        quantity: item.quantity,
        maxQuantity: item.max_quantity,
        product_id: item.product_id,
      });
    });
    return groups;
  }, [cart]);

  const cartItems = useMemo(
    () => [...allNewPartsItems, ...Object.values(usedGroupedItems).flat()],
    [allNewPartsItems, usedGroupedItems],
  );

  const hasVisibleCartContent = cartItems.length > 0;

  const usedSellerGroups = useMemo(
    () =>
      Object.entries(usedGroupedItems).map(([seller, items]) => ({
        seller,
        items,
      })),
    [usedGroupedItems],
  );

  const grandTotal = useMemo(
    () => cartItems.reduce((sum, item) => sum + item.price * item.quantity, 0),
    [cartItems],
  );

  const grandQty = useMemo(
    () => cartItems.reduce((sum, item) => sum + item.quantity, 0),
    [cartItems],
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

  const handleClearNewPartsBasket = useCallback(async (basket, items) => {
    const basketToDelete = basket && !basket.is_default ? basket : null;

    for (const item of items) {
      try {
        await dispatch(removeFromCart(item.id)).unwrap();
      } catch {
        // continue
      }
    }

    try {
      await dispatch(fetchCart()).unwrap();
    } catch {
      // ignore
    }

    if (basketToDelete?.id) {
      try {
        await dispatch(deleteNewPartsBasket(basketToDelete.id)).unwrap();
      } catch {
        // ignore
      }
    }

    if (defaultBasket?.id) {
      dispatch(setActiveNewPartsBasket(defaultBasket.id));
    }
  }, [defaultBasket?.id, dispatch]);

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
    [finalizeUsedCheckout, isAuthorized, openAuthModalForCheckout],
  );

  const handleNewPartsCheckout = useCallback((basketId) => {
    if (basketId) {
      dispatch(setActiveNewPartsBasket(basketId));
    }
    clearNewPartsCheckoutItemIds();
    if (!isAuthorized) {
      openAuthModalForCheckout({ type: 'new', basketId });
      return;
    }
    navigate('/cart/new/checkout');
  }, [dispatch, isAuthorized, navigate, openAuthModalForCheckout]);

  const handleNewPartsCheckoutSelected = useCallback((basketId, items) => {
    if (basketId) {
      dispatch(setActiveNewPartsBasket(basketId));
    }
    const selected = items.filter((item) => selectedItems.has(item.id));
    if (selected.length === 0) return;
    setNewPartsCheckoutItemIds(selected.map((item) => item.id));
    if (!isAuthorized) {
      openAuthModalForCheckout({ type: 'new', partial: true, basketId });
      return;
    }
    navigate('/cart/new/checkout');
  }, [dispatch, isAuthorized, navigate, openAuthModalForCheckout, selectedItems]);

  const openRenameModal = (basket) => {
    if (!basket || basket.is_default) return;
    setRenameBasketId(basket.id);
    setRenameValue(basket.name);
    setRenameError('');
    setRenameOpen(true);
  };

  const handleRenameBasket = async (e) => {
    e.preventDefault();
    if (!renameBasketId) return;
    const name = renameValue.trim();
    if (!name) {
      setRenameError('Укажите название');
      return;
    }
    setRenameSaving(true);
    setRenameError('');
    try {
      await dispatch(renameNewPartsBasket({ basketId: renameBasketId, name })).unwrap();
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
      if (pending.basketId) {
        dispatch(setActiveNewPartsBasket(pending.basketId));
      }
      navigate('/cart/new/checkout');
    }
  }, [dispatch, finalizeUsedCheckout, navigate]);

  const handleItemSelect = (itemId) => {
    setSelectedItems((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(itemId)) newSet.delete(itemId);
      else newSet.add(itemId);
      return newSet;
    });
  };

  const handleSelectAllItems = (items) => {
    const ids = items.map((item) => item.id);
    const allSelected = ids.every((id) => selectedItems.has(id));
    setSelectedItems((prev) => {
      const newSet = new Set(prev);
      if (allSelected) ids.forEach((id) => newSet.delete(id));
      else ids.forEach((id) => newSet.add(id));
      return newSet;
    });
  };

  const hasOnlyEmptyDefault = visibleNewPartsBaskets.length === 1
    && visibleNewPartsBaskets[0]?.is_default
    && (visibleNewPartsBaskets[0]?.item_count ?? 0) === 0
    && usedSellerGroups.length === 0;

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
        <EmptyState illustration="empty" title="Загрузка корзины…" className="border-solid" />
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
        <div className="space-y-4">
          {visibleNewPartsBaskets.map((basket) => {
            const items = mapBasketItems(basket);
            if (!items.length) {
              if (!basket.is_default || hasOnlyEmptyDefault) {
                return (
                  <div
                    key={basket.id}
                    className="rounded-sg border border-dashed border-line px-4 py-8 text-center text-sm text-ink-muted"
                  >
                    {basket.is_default
                      ? 'Добавьте новые запчасти из каталога или VIN-поиска'
                      : `Корзина «${basket.name}» пуста`}
                  </div>
                );
              }
              return null;
            }

            return (
              <CartTableBlock
                key={basket.id}
                title={basket.name}
                items={items}
                selectedItems={selectedItems}
                onSelectAll={() => handleSelectAllItems(items)}
                onItemSelect={handleItemSelect}
                onQuantityChange={handleQuantityChange}
                onRemove={handleRemoveItem}
                onRemoveSelected={() => {
                  items
                    .filter((item) => selectedItems.has(item.id))
                    .forEach((item) => handleRemoveItem(item.id));
                }}
                onCheckout={() => handleNewPartsCheckout(basket.id)}
                onCheckoutSelected={() => handleNewPartsCheckoutSelected(basket.id, items)}
                onClearAll={() => handleClearNewPartsBasket(basket, items)}
                onRename={() => openRenameModal(basket)}
                canRename={!basket.is_default}
                showDeliveryColumn
                showPurchasePrice={showPurchaseInCart}
                formatItemPrice={formatNewPartPrice}
              />
            );
          })}

          {!hasVisibleCartContent && usedSellerGroups.length === 0 && visibleNewPartsBaskets.length === 0 ? (
            <div className="rounded-sg border border-dashed border-line px-4 py-8 text-center text-sm text-ink-muted">
              Добавьте новые запчасти из каталога или VIN-поиска
            </div>
          ) : null}

          {usedSellerGroups.map(({ seller, items }) => (
            <CartTableBlock
              key={seller}
              title={seller}
              items={items}
              selectedItems={selectedItems}
              onSelectAll={() => handleSelectAllItems(items)}
              onItemSelect={handleItemSelect}
              onQuantityChange={handleQuantityChange}
              onRemove={handleRemoveItem}
              onRemoveSelected={() => {
                items
                  .filter((item) => selectedItems.has(item.id))
                  .forEach((item) => handleRemoveItem(item.id));
              }}
              onCheckout={() => saveUsedOrderAndNavigate(items, seller)}
              onCheckoutSelected={() => {
                const selected = items.filter((item) => selectedItems.has(item.id));
                saveUsedOrderAndNavigate(selected, seller);
              }}
              onClearAll={() => handleClearUsedBasket(items)}
              showDeliveryColumn={false}
              formatItemPrice={formatUsedPrice}
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
