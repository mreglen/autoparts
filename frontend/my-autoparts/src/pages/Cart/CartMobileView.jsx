import React, { useMemo } from 'react';
import ActionsDropdown, { ActionsDropdownItem } from '../../components/ActionsDropdown/ActionsDropdown';
import Button from '../../components/UI/Button';
import ClientMarkupPopover from '../../components/NewParts/ClientMarkupPopover';
import useNetworkStatus from '../../hooks/useNetworkStatus';
import CartItemMobileCard from './CartItemMobileCard';

function CartMobileMenu({
  someSelected,
  showMoveAction,
  onMoveSelected,
  showRepairOrderAction,
  onAddToRepairOrder,
  onRemoveSelected,
  onClearAll,
}) {
  const actions = [
    someSelected && showMoveAction && onMoveSelected
      ? { label: 'Переместить', onClick: onMoveSelected }
      : null,
    someSelected && showRepairOrderAction && onAddToRepairOrder
      ? { label: 'В заказ-наряд', onClick: onAddToRepairOrder }
      : null,
    someSelected
      ? { label: 'Удалить выбранное', onClick: onRemoveSelected, danger: true }
      : null,
    { label: 'Очистить', onClick: onClearAll, danger: true },
  ].filter(Boolean);

  if (!actions.length) return null;

  return (
    <ActionsDropdown
      showLabel={false}
      label="Дополнительные действия"
      estimatedMenuHeight={220}
      buttonClassName="inline-flex h-11 w-11 items-center justify-center rounded-sg border border-line bg-surface text-ink transition hover:bg-surface-muted"
      menuClassName="w-52 z-50"
    >
      {actions.map((action) => (
        <ActionsDropdownItem
          key={action.label}
          className="min-h-11"
          danger={action.danger}
          onClick={action.onClick}
        >
          {action.label}
        </ActionsDropdownItem>
      ))}
    </ActionsDropdown>
  );
}

function CartMobileBlock({
  section,
  selectedItems,
  onSelectAll,
  onItemSelect,
  onQuantityChange,
  onRemove,
  quantityUpdatingIds,
  checkoutPrice,
  clientPrice,
  getMaxAllowedQuantity,
}) {
  const { offline } = useNetworkStatus();
  const items = section.items || [];
  const allSelected = items.length > 0 && items.every((item) => selectedItems.has(item.id));
  const someSelected = items.some((item) => selectedItems.has(item.id));
  const selectedCount = items.filter((item) => selectedItems.has(item.id)).length;
  const displayedUnitPrice = (item) => (
    section.clientMarkupEnabled
      ? clientPrice(item, section.clientMarkupPercent)
      : checkoutPrice(item)
  );
  const blockTotal = items.reduce(
    (sum, item) => sum + displayedUnitPrice(item) * item.quantity,
    0,
  );
  const selectedTotal = items
    .filter((item) => selectedItems.has(item.id))
    .reduce((sum, item) => sum + displayedUnitPrice(item) * item.quantity, 0);
  const displayTotal = someSelected ? selectedTotal : blockTotal;

  return (
    <section className="overflow-hidden rounded-sg border border-line bg-surface shadow-sg-sm">
      <header className="border-b border-line bg-surface-subtle px-3 py-3">
        <div className="flex items-start justify-between gap-2">
          <div className="flex min-w-0 flex-1 items-center gap-1">
            <h2 className="min-w-0 flex-1 truncate text-base font-semibold text-ink">{section.title}</h2>
            {section.canRename && section.onRename ? (
              <button
                type="button"
                onClick={section.onRename}
                className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-md text-ink-muted transition hover:text-brand-600"
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
          <p className="shrink-0 text-base font-bold tabular-nums text-ink">
            {section.formatItemPrice(displayTotal)}
          </p>
        </div>

        <div className="mt-2.5 flex items-center gap-2">
          <Button
            className="min-h-11 flex-1"
            disabled={offline}
            onClick={someSelected ? section.onCheckoutSelected : section.onCheckout}
          >
            {someSelected
              ? `Оформить (${selectedCount})`
              : (section.checkoutLabel || 'Оформить заказ')}
          </Button>
          {section.showClientMarkupControl ? (
            <div className="flex h-11 items-center">
              <ClientMarkupPopover bottomInset={120} readOnly={Boolean(section.clientMarkupReadOnly)} />
            </div>
          ) : null}
          <CartMobileMenu
            someSelected={someSelected}
            showMoveAction={section.showMoveAction}
            onMoveSelected={section.onMoveSelected}
            showRepairOrderAction={section.showRepairOrderAction}
            onAddToRepairOrder={section.onAddToRepairOrder}
            onRemoveSelected={section.onRemoveSelected}
            onClearAll={section.onClearAll}
          />
        </div>
      </header>

      {section.showSupplierDeliveryOption ? (
        <div className="border-b border-line bg-surface px-3 py-2.5">
          <label className="flex cursor-pointer items-center gap-2.5">
            <input
              type="checkbox"
              checked={Boolean(section.deliverInParts)}
              onChange={(e) => section.onDeliverInPartsChange?.(e.target.checked)}
              className="h-4 w-4 shrink-0 rounded border-line text-brand-600 focus:ring-brand-500"
            />
            <span className="min-w-0 text-sm font-medium text-ink">Доставлять частями</span>
          </label>
        </div>
      ) : null}

      <div className="flex items-center gap-2 border-b border-line bg-surface-muted/30 px-3 py-2">
        <input
          type="checkbox"
          checked={allSelected}
          ref={(el) => {
            if (el) el.indeterminate = someSelected && !allSelected;
          }}
          onChange={() => onSelectAll(items)}
          className="h-4 w-4 rounded border-line text-brand-600 focus:ring-brand-500"
          aria-label={`Выбрать все в ${section.title}`}
        />
        <span className="text-xs font-medium uppercase tracking-wide text-ink-muted">Выбрать все</span>
      </div>

      <div className="divide-y divide-line">
        {items.map((item) => (
          <CartItemMobileCard
            key={item.id}
            item={item}
            selected={selectedItems.has(item.id)}
            onSelect={() => onItemSelect(item.id)}
            onQuantityChange={onQuantityChange}
            onRemove={onRemove}
            showDeliveryColumn={section.showDeliveryColumn}
            clientMarkupEnabled={section.clientMarkupEnabled}
            clientMarkupPercent={section.clientMarkupPercent}
            showBothPrices={section.showBothPrices}
            formatItemPrice={section.formatItemPrice}
            quantityBusy={quantityUpdatingIds.includes(item.id)}
            checkoutPrice={checkoutPrice}
            clientPrice={clientPrice}
            getMaxAllowedQuantity={getMaxAllowedQuantity}
          />
        ))}
      </div>
    </section>
  );
}

export default function CartMobileView({
  sections,
  selectedItems,
  onSelectAll,
  onItemSelect,
  onQuantityChange,
  onRemove,
  quantityUpdatingIds,
  checkoutPrice,
  clientPrice,
  getMaxAllowedQuantity,
}) {
  const filled = useMemo(
    () => (sections || []).filter((section) => section.items?.length),
    [sections],
  );
  const emptyOnly = useMemo(
    () => (sections || []).filter((section) => !section.items?.length && section.emptyText),
    [sections],
  );

  if (!filled.length) {
    return (
      <div className="rounded-sg border border-dashed border-line px-4 py-8 text-center text-sm text-ink-muted">
        {emptyOnly[0]?.emptyText || 'Добавьте новые запчасти из каталога или VIN-поиска'}
      </div>
    );
  }

  return (
    <div className="space-y-4 lg:hidden">
      {filled.map((section) => (
        <CartMobileBlock
          key={section.key}
          section={section}
          selectedItems={selectedItems}
          onSelectAll={onSelectAll}
          onItemSelect={onItemSelect}
          onQuantityChange={onQuantityChange}
          onRemove={onRemove}
          quantityUpdatingIds={quantityUpdatingIds}
          checkoutPrice={checkoutPrice}
          clientPrice={clientPrice}
          getMaxAllowedQuantity={getMaxAllowedQuantity}
        />
      ))}
    </div>
  );
}
