import React from 'react';
import { Badge, Button, Card } from '../../components/UI';

export default function PartDetailPurchaseSidebar({
  product,
  inStock = false,
  formatPrice,
  showCart = false,
  cartQuantity = 0,
  stockNoStock = false,
  isAdding = false,
  buyingNow = false,
  canShowBuyNow = false,
  onAddToCart,
  onRemoveFromCart,
  onBuyNow,
}) {
  if (!product) return null;

  const address = product.storage_location?.address
    || product.storage_location?.name
    || '—';

  return (
    <Card as="section" padding="sm">
      <Badge tone={inStock ? 'success' : 'warning'} className="mb-3">
        {inStock ? `В наличии · ${product.quantity || 0} шт.` : 'Нет в наличии'}
      </Badge>

      <div className="text-2xl font-bold text-brand-700 sm:text-3xl">
        {product.price ? formatPrice(product.price) : '—'}
      </div>

      {showCart ? (
        <div className="mt-4 space-y-2">
          {cartQuantity > 0 ? (
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={onRemoveFromCart}
                  disabled={isAdding}
                  className="flex h-10 w-10 items-center justify-center rounded-sg border border-line-strong bg-surface text-xl font-bold text-ink hover:bg-surface-muted disabled:opacity-50"
                >
                  −
                </button>
                <span className="w-10 text-center text-lg font-bold text-ink">{cartQuantity}</span>
                <button
                  type="button"
                  onClick={onAddToCart}
                  disabled={isAdding || stockNoStock}
                  className="flex h-10 w-10 items-center justify-center rounded-sg border border-line-strong bg-surface text-xl font-bold text-ink hover:bg-surface-muted disabled:opacity-50"
                >
                  +
                </button>
              </div>
              {stockNoStock ? (
                <span className="text-xs font-medium text-accent-600">Нет в наличии</span>
              ) : null}
            </div>
          ) : (
            <Button
              type="button"
              onClick={onAddToCart}
              disabled={isAdding || stockNoStock}
              size="lg"
              className="w-full"
            >
              {isAdding ? (
                <svg className="h-5 w-5 animate-spin text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
              ) : (
                <>
                  <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" />
                  </svg>
                  В корзину
                </>
              )}
            </Button>
          )}

          {canShowBuyNow ? (
            <Button
              type="button"
              onClick={onBuyNow}
              disabled={buyingNow || stockNoStock}
              variant="secondary"
              size="lg"
              className="w-full border-brand-600 text-brand-700 hover:bg-brand-50"
            >
              {buyingNow ? 'Оформление…' : 'Купить сейчас'}
            </Button>
          ) : null}
        </div>
      ) : null}

      <div className="mt-4 border-t border-line-soft pt-3">
        <p className="text-xs font-medium text-ink-muted">Адрес</p>
        <p className="mt-1 break-words text-sm font-medium leading-snug text-ink">{address}</p>
      </div>
    </Card>
  );
}
