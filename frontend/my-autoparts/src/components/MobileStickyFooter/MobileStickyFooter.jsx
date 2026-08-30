import React from 'react';
import { Z_MOBILE_STICKY_FOOTER, MOBILE_STICKY_BOTTOM_OFFSET } from '../../constants/mobileTokens';

/**
 * Fixed CTA bar on mobile, above bottom navigation. Submit via `form` attribute (HTML5).
 */
export default function MobileStickyFooter({
  formId,
  primaryLabel,
  primaryDisabled = false,
  secondaryLabel,
  onSecondary,
  primaryType = 'submit',
}) {
  return (
    <div
      className="md:hidden fixed inset-x-0 border-t border-gray-200 bg-white/95 px-3 pt-2 pb-3 backdrop-blur supports-[backdrop-filter]:bg-white/90 shadow-[0_-6px_24px_rgba(0,0,0,0.06)]"
      style={{
        zIndex: Z_MOBILE_STICKY_FOOTER,
        bottom: MOBILE_STICKY_BOTTOM_OFFSET,
      }}
    >
      <div className="mx-auto flex max-w-4xl gap-2">
        {secondaryLabel ? (
          <button
            type="button"
            onClick={onSecondary}
            className="min-h-11 flex-1 rounded-lg border border-gray-300 px-3 text-base font-medium text-gray-800 active:bg-gray-50"
          >
            {secondaryLabel}
          </button>
        ) : null}
        <button
          type={primaryType}
          form={formId}
          disabled={primaryDisabled}
          className={`min-h-11 flex-[2] rounded-lg px-4 text-base font-semibold text-white ${
            primaryDisabled ? 'cursor-not-allowed bg-indigo-400' : 'bg-indigo-600 active:bg-indigo-700'
          }`}
        >
          {primaryLabel}
        </button>
      </div>
    </div>
  );
}
