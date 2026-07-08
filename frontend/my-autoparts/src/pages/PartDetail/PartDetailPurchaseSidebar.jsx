import React from 'react';

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
    <section className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
      {inStock ? (
        <span className="mb-3 inline-flex items-center rounded-md bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700 ring-1 ring-emerald-200">
          В наличии · {product.quantity || 0} шт.
        </span>
      ) : (
        <span className="mb-3 inline-flex items-center rounded-md bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-800 ring-1 ring-amber-200">
          Нет в наличии
        </span>
      )}

      <div className="text-2xl font-bold text-indigo-700 sm:text-3xl">
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
                  className="flex h-10 w-10 items-center justify-center rounded-lg border border-gray-300 bg-white text-xl font-bold hover:bg-gray-50 disabled:opacity-50"
                >
                  −
                </button>
                <span className="w-10 text-center text-lg font-bold text-gray-900">{cartQuantity}</span>
                <button
                  type="button"
                  onClick={onAddToCart}
                  disabled={isAdding || stockNoStock}
                  className="flex h-10 w-10 items-center justify-center rounded-lg border border-gray-300 bg-white text-xl font-bold hover:bg-gray-50 disabled:opacity-50"
                >
                  +
                </button>
              </div>
              {stockNoStock ? (
                <span className="text-xs font-medium text-orange-600">Нет в наличии</span>
              ) : null}
            </div>
          ) : (
            <button
              type="button"
              onClick={onAddToCart}
              disabled={isAdding || stockNoStock}
              className="flex w-full items-center justify-center gap-2 rounded-lg bg-indigo-600 py-3 text-base font-semibold text-white transition-colors hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50"
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
            </button>
          )}

          {canShowBuyNow ? (
            <button
              type="button"
              onClick={onBuyNow}
              disabled={buyingNow || stockNoStock}
              className="w-full rounded-lg border-2 border-indigo-600 bg-white py-3 text-base font-semibold text-indigo-700 transition-colors hover:bg-indigo-50 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {buyingNow ? 'Оформление…' : 'Купить сейчас'}
            </button>
          ) : null}
        </div>
      ) : null}

      <div className="mt-4 border-t border-gray-100 pt-3">
        <p className="text-xs font-medium text-gray-500">Адрес</p>
        <p className="mt-1 text-sm font-medium leading-snug text-gray-900 break-words">{address}</p>
      </div>
    </section>
  );
}
