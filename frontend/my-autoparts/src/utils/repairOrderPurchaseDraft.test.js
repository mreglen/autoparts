import {
  buildPurchaseImportPayload,
  clearRepairOrderPurchaseDraft,
  clearLinkedRepairOrder,
  groupPurchaseSelections,
  linkedRepairOrderFromItems,
  mapPurchaseItemsToShopParts,
  purchaseItemsAlreadyOnRepairOrder,
  purchaseSelectionKey,
  persistPurchaseDraftGroups,
  readLinkedRepairOrder,
  readRepairOrderPurchaseDraft,
  removeItemFromPurchaseDraftGroups,
  saveLinkedRepairOrder,
  saveRepairOrderPurchaseDraft,
} from './repairOrderPurchaseDraft';
import {
  shopPartDisplayName,
  formatShopPartQty,
  priceWithMarkup,
  shopLineSum,
  shopPartPricingOptions,
} from './repairOrderShopPartUtils';

describe('repairOrderPurchaseDraft', () => {
  beforeEach(() => {
    sessionStorage.clear();
  });

  it('saves and reads draft', () => {
    saveRepairOrderPurchaseDraft({
      groups: [{ orderType: 'new', itemIds: [1, 2], items: [] }],
      createdAt: Date.now(),
    });
    const draft = readRepairOrderPurchaseDraft();
    expect(draft.groups).toHaveLength(1);
    expect(draft.groups[0].orderType).toBe('new');
    expect(draft.groups[0].itemIds).toEqual([1, 2]);
  });

  it('builds import payload', () => {
    expect(buildPurchaseImportPayload({ orderType: 'used', itemIds: [3, 4] })).toEqual({
      order_type: 'used',
      item_ids: [3, 4],
      markup_percent: 0,
      item_price_overrides: {},
    });
  });

  it('groups selections by order type', () => {
    const groups = groupPurchaseSelections([
      { orderType: 'new', orderId: 10, itemId: 1, name: 'A', quantity: 1, price: 100 },
      { orderType: 'new', orderId: 10, itemId: 2, name: 'B', quantity: 1, price: 200 },
      { orderType: 'used', orderId: 20, itemId: 5, name: 'C', quantity: 1, price: 300 },
    ]);
    expect(groups).toHaveLength(2);
    expect(groups.find((g) => g.orderType === 'new')?.itemIds).toEqual([1, 2]);
    expect(groups.find((g) => g.orderType === 'used')?.itemIds).toEqual([5]);
  });

  it('clears draft', () => {
    saveRepairOrderPurchaseDraft({ groups: [] });
    clearRepairOrderPurchaseDraft();
    expect(readRepairOrderPurchaseDraft()).toBeNull();
  });

  it('saves and reads linked repair order', () => {
    saveLinkedRepairOrder({
      id: 42,
      order_number: 'A-100',
      client: { name: 'Иван' },
    });
    expect(readLinkedRepairOrder()).toEqual({
      id: 42,
      order_number: 'A-100',
      client_name: 'Иван',
    });
    clearLinkedRepairOrder();
    expect(readLinkedRepairOrder()).toBeNull();
  });

  it('maps purchase items to readonly shop parts', () => {
    const parts = mapPurchaseItemsToShopParts([
      {
        id: 1,
        orderType: 'new',
        brand: 'BOSCH',
        partnumber: '0986',
        name: 'Колодки',
        quantity: 2,
        price: 2000,
      },
    ]);
    expect(parts).toHaveLength(1);
    expect(parts[0].brand).toBe('BOSCH');
    expect(parts[0].unit_price).toBe('2000');
    expect(parts[0].client_unit_price_override).toBe('');
    expect(parts[0].is_imported).toBe(true);
    expect(parts[0].pending_import).toBe(true);
  });

  it('builds stable selection keys', () => {
    expect(purchaseSelectionKey('new', 10, 5)).toBe('new:10:5');
  });

  it('detects current repair order from selected items', () => {
    expect(linkedRepairOrderFromItems([
      { repairOrderId: 42, repairOrderNumber: 'A-100' },
    ])).toEqual({ id: 42, order_number: 'A-100' });
    expect(purchaseItemsAlreadyOnRepairOrder(
      [{ items: [{ repairOrderId: 42 }, { repairOrderId: 42 }] }],
      42,
    )).toBe(true);
    expect(purchaseItemsAlreadyOnRepairOrder(
      [{ items: [{ repairOrderId: 42 }, { repairOrderId: 7 }] }],
      42,
    )).toBe(false);
  });

  it('removes pending purchase item from draft groups', () => {
    const groups = [
      {
        orderType: 'new',
        itemIds: [1, 2],
        items: [{ id: 1 }, { id: 2 }],
      },
      {
        orderType: 'used',
        itemIds: [5],
        items: [{ id: 5 }],
      },
    ];
    const next = removeItemFromPurchaseDraftGroups(groups, {
      pending_import: true,
      purchase_order_type: 'new',
      purchase_item_id: 2,
    });
    expect(next).toHaveLength(2);
    expect(next[0].itemIds).toEqual([1]);
    expect(next[1].itemIds).toEqual([5]);
  });

  it('persists or clears purchase draft groups', () => {
    persistPurchaseDraftGroups([
      { orderType: 'new', itemIds: [1], items: [{ id: 1 }] },
    ]);
    expect(readRepairOrderPurchaseDraft()?.groups).toHaveLength(1);
    persistPurchaseDraftGroups([]);
    expect(readRepairOrderPurchaseDraft()).toBeNull();
  });
});

describe('repairOrderShopPartUtils', () => {
  it('builds display name from parts', () => {
    expect(
      shopPartDisplayName({
        brand: 'MANN',
        partnumber: 'W712',
        title: 'Фильтр',
      }),
    ).toBe('MANN W712 Фильтр');
  });

  it('formats fractional qty for liters', () => {
    expect(formatShopPartQty(2.5, 'l')).toBe('2,5');
  });

  it('uses manual final price and resets to percentage pricing', () => {
    const part = {
      source: 'manual',
      client_unit_price_override: '150',
    };
    expect(priceWithMarkup(100, 20, shopPartPricingOptions(part))).toBe(150);
    expect(shopLineSum(2, 100, 20, shopPartPricingOptions(part))).toBe(300);
    part.client_unit_price_override = '';
    expect(priceWithMarkup(100, 20, shopPartPricingOptions(part))).toBe(120);
  });

  it('rounds automatic client price up to whole rubles', () => {
    const part = { source: 'rossko', client_unit_price_override: '' };
    expect(priceWithMarkup(100.99, 7, shopPartPricingOptions(part))).toBe(109);
    part.client_unit_price_override = '108.75';
    expect(priceWithMarkup(100.99, 7, shopPartPricingOptions(part))).toBe(108.75);
  });
});
