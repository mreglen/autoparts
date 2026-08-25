import React from 'react';
import { Z_MOBILE_STICKY_FOOTER, MOBILE_STICKY_BOTTOM_OFFSET } from '../../constants/mobileTokens';

/**
 * Fixed CTA bar for product detail pages on mobile — sits above bottom navigation.
 */
export default function ProductDetailStickyBar({
  children,
  className = '',
  priceLabel,
  priceValue,
  meta,
  ariaLabel = 'Действия с товаром',
}) {
  return (
    <div
      role="region"
      aria-label={ariaLabel}
      className={`fixed inset-x-0 border-t border-line bg-surface/95 px-4 py-3 shadow-[0_-6px_24px_rgba(0,0,0,0.08)] backdrop-blur supports-[backdrop-filter]:bg-surface/90 lg:hidden ${className}`}
      style={{
        zIndex: Z_MOBILE_STICKY_FOOTER,
        bottom: MOBILE_STICKY_BOTTOM_OFFSET,
        paddingBottom: 'max(0.75rem, env(safe-area-inset-bottom, 0px))',
      }}
    >
      {(priceLabel || priceValue || meta) ? (
        <div className="mb-2 flex items-end justify-between gap-3">
          <div className="min-w-0">
            {priceLabel ? (
              <p className="text-xs font-medium text-ink-muted">{priceLabel}</p>
            ) : null}
            {priceValue ? (
              <p className="text-lg font-bold tabular-nums text-ink">{priceValue}</p>
            ) : null}
          </div>
          {meta ? (
            <p className="shrink-0 text-right text-xs text-ink-muted">{meta}</p>
          ) : null}
        </div>
      ) : null}
      {children}
    </div>
  );
}
