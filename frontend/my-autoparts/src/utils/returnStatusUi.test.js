import {
  AVITO_RETURN_TRANSITION_OPTIONS,
  AVITO_RETURN_STATUS_LABELS,
  getReturnReasonLabel,
  getReturnStatusLabel,
  isUsedOrderReturnEligible,
  SELLER_NEXT_STATUSES,
} from './returnStatusUi';

describe('returnStatusUi', () => {
  it('maps return status codes to Russian labels', () => {
    expect(getReturnStatusLabel('requested')).toBe('Заявка создана');
    expect(getReturnStatusLabel('unknown_code')).toBe('unknown_code');
  });

  it('maps return reason ids to Russian labels', () => {
    expect(getReturnReasonLabel('defect')).toBe('Брак / неисправность');
  });

  it('exposes Avito return transition options with Russian labels', () => {
    expect(AVITO_RETURN_TRANSITION_OPTIONS).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ value: 'returned', label: 'Возвращён покупателю' }),
      ]),
    );
    expect(AVITO_RETURN_STATUS_LABELS.returned).toBe('Возвращён');
  });

  it('defines seller workflow transitions per status', () => {
    expect(SELLER_NEXT_STATUSES.requested).toEqual(['reviewing', 'approved', 'rejected']);
    expect(SELLER_NEXT_STATUSES.received).toEqual(['refunded']);
  });

  it('allows return request only for delivered/closed used orders with products', () => {
    expect(isUsedOrderReturnEligible({ status_code: 'new', items: [{ product_id: 1 }] })).toBe(false);
    expect(isUsedOrderReturnEligible({
      status_code: 'delivered',
      items: [{ product_id: 10 }],
    })).toBe(true);
    expect(isUsedOrderReturnEligible({
      status_code: 'delivered',
      items: [{ name: 'No product id' }],
    })).toBe(false);
  });
});
