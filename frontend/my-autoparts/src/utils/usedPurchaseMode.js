/** Видимость корзины и контакта продавца на карточке б/у по site_settings.used_parts_purchase_mode */
export function getUsedPurchaseActions(mode, isNewProduct) {
  if (isNewProduct) {
    return { showCart: true, showSellerContact: true };
  }
  const m = mode === 'cart_only' || mode === 'cta_only' ? mode : 'both';
  return {
    showCart: m !== 'cta_only',
    showSellerContact: true,
  };
}

export const USED_PURCHASE_MODE_OPTIONS = [
  {
    value: 'both',
    label: 'Оба способа',
    description: 'Корзина и связь с продавцом (чат, звонок)',
  },
  {
    value: 'cart_only',
    label: 'Только корзина',
    description: 'Корзина и контакты продавца, как сейчас',
  },
  {
    value: 'cta_only',
    label: 'Только связь с продавцом',
    description: 'Чат и звонок, без кнопки «В корзину»',
  },
];
