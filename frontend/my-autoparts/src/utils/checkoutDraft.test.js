import {
  clearNewCheckoutDraft,
  clearUsedCheckoutDraft,
  readNewCheckoutDraft,
  readUsedCheckoutDraft,
  saveNewCheckoutDraft,
  saveUsedCheckoutDraft,
  NEW_CHECKOUT_DRAFT_KEY,
  USED_CHECKOUT_DRAFT_KEY,
} from './checkoutDraft';

describe('checkoutDraft', () => {
  beforeEach(() => {
    sessionStorage.clear();
  });

  it('saves and reads new checkout draft', () => {
    const draft = {
      recipient: { fullName: 'Иван Иванов', phone: '+7 (999) 111-22-33', email: 'a@b.c' },
      fulfillmentMode: 'delivery',
      deliveryRegion: 'Москва',
      pvzMethod: 'cdek',
      deliveryAddress: 'ул. Ленина, 1',
      acceptedOffer: true,
    };
    saveNewCheckoutDraft(draft);
    expect(readNewCheckoutDraft()).toMatchObject({ ...draft, v: 1 });
    clearNewCheckoutDraft();
    expect(readNewCheckoutDraft()).toBeNull();
    expect(sessionStorage.getItem(NEW_CHECKOUT_DRAFT_KEY)).toBeNull();
  });

  it('saves and reads used checkout draft', () => {
    const draft = {
      recipient: { fullName: 'Пётр Петров', phone: '+7 (999) 000-00-00', email: 'x@y.z' },
      selectedRegionId: '1',
      selectedDeliveryOptionId: '2',
      deliveryAddress: 'г. Казань',
      buyerComment: 'Позвонить',
      acceptedOffer: false,
    };
    saveUsedCheckoutDraft(draft);
    expect(readUsedCheckoutDraft()).toMatchObject({ ...draft, v: 1 });
    clearUsedCheckoutDraft();
    expect(readUsedCheckoutDraft()).toBeNull();
    expect(sessionStorage.getItem(USED_CHECKOUT_DRAFT_KEY)).toBeNull();
  });
});
