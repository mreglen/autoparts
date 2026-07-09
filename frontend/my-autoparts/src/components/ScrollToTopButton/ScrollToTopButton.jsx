import React, { useCallback } from 'react';
import { createPortal } from 'react-dom';
import { useScrollToTopVisible } from '../../hooks/useScrollToTopVisible';
import { scrollAppToTop } from '../../utils/scrollContainer';

export default function ScrollToTopButton({ threshold = 240 }) {
  const visible = useScrollToTopVisible(threshold);

  const handleClick = useCallback(() => {
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    scrollAppToTop(prefersReducedMotion ? 'auto' : 'smooth');
  }, []);

  if (typeof document === 'undefined') {
    return null;
  }

  return createPortal(
    <button
      type="button"
      onClick={handleClick}
      aria-label="Наверх"
      aria-hidden={!visible}
      tabIndex={visible ? 0 : -1}
      className={`fixed right-4 z-[60] flex h-10 w-10 items-center justify-center rounded-full border border-gray-200/90 bg-white/95 text-indigo-600 shadow-[0_4px_14px_rgba(15,23,42,0.12)] backdrop-blur-sm transition-all duration-200 hover:border-indigo-200 hover:bg-indigo-50 hover:shadow-[0_6px_18px_rgba(79,70,229,0.18)] active:scale-95 bottom-[calc(4.75rem+env(safe-area-inset-bottom,0px))] lg:bottom-8 ${
        visible
          ? 'pointer-events-auto translate-y-0 scale-100 opacity-100'
          : 'pointer-events-none translate-y-3 scale-95 opacity-0'
      }`}
    >
      <svg
        className="h-[18px] w-[18px]"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        strokeWidth={2.25}
        aria-hidden
      >
        <path strokeLinecap="round" strokeLinejoin="round" d="M5 15l7-7 7 7" />
      </svg>
    </button>,
    document.body,
  );
}
