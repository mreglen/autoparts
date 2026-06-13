import React from 'react';

/**
 * Горизонтальная прокрутка на мобильных: touch-pan-x + overscroll containment.
 */
export default function NewPartHorizontalScroll({
  children,
  className = '',
  hint = 'Листайте влево-вправо →',
  showHint = true,
}) {
  return (
    <div className={`relative min-w-0 ${className}`.trim()}>
      <div
        className="overflow-x-auto overscroll-x-contain touch-pan-x [-webkit-overflow-scrolling:touch]"
        style={{ WebkitOverflowScrolling: 'touch' }}
      >
        {children}
      </div>
      {showHint ? (
        <p className="mt-1.5 text-xs text-gray-400 md:hidden">{hint}</p>
      ) : null}
    </div>
  );
}
