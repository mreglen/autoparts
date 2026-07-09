import React, { useCallback } from 'react';
import { useScrollToTopVisible } from '../../hooks/useScrollToTopVisible';

export default function ScrollToTopButton({ threshold = 320 }) {
  const visible = useScrollToTopVisible(threshold);

  const handleClick = useCallback(() => {
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    window.scrollTo({
      top: 0,
      behavior: prefersReducedMotion ? 'auto' : 'smooth',
    });
  }, []);

  return (
    <button
      type="button"
      onClick={handleClick}
      aria-label="Наверх"
      aria-hidden={!visible}
      tabIndex={visible ? 0 : -1}
      className={`fixed right-4 z-40 flex h-9 w-9 items-center justify-center rounded-full bg-white/95 shadow-md ring-1 ring-gray-200/80 backdrop-blur transition-all duration-200 hover:bg-indigo-50 hover:ring-indigo-200 bottom-[calc(4.75rem+env(safe-area-inset-bottom,0px))] lg:bottom-8 ${
        visible
          ? 'pointer-events-auto translate-y-0 opacity-100'
          : 'pointer-events-none translate-y-2 opacity-0'
      }`}
    >
      <svg
        className="h-4 w-4 text-indigo-600"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        strokeWidth={2}
        aria-hidden
      >
        <path strokeLinecap="round" strokeLinejoin="round" d="M5 15l7-7 7 7" />
      </svg>
    </button>
  );
}
