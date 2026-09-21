import { useEffect, useRef, useState } from 'react';

const VARIANTS = {
  error: {
    container: 'bg-danger-600 shadow-danger-600/25',
    icon: (
      <svg className="h-6 w-6 shrink-0 text-white" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
        <path fillRule="evenodd" d="M2.25 12c0-5.385 4.365-9.75 9.75-9.75s9.75 4.365 9.75 9.75-4.365 9.75-9.75 9.75S2.25 17.385 2.25 12zM12 8.25a.75.75 0 01.75.75v3.75a.75.75 0 01-1.5 0V9a.75.75 0 01.75-.75zm0 8.25a.75.75 0 100-1.5.75.75 0 000 1.5z" clipRule="evenodd" />
      </svg>
    ),
  },
  success: {
    container: 'bg-success-600 shadow-success-600/25',
    icon: (
      <svg className="h-6 w-6 shrink-0 text-white" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
        <path fillRule="evenodd" d="M2.25 12c0-5.385 4.365-9.75 9.75-9.75s9.75 4.365 9.75 9.75-4.365 9.75-9.75 9.75S2.25 17.385 2.25 12zm13.36-4.573a.75.75 0 00-1.22-.964l-3.236 4.09-1.615-1.615a.75.75 0 10-1.06 1.06l2.25 2.25a.75.75 0 001.144-.094l3.737-4.727z" clipRule="evenodd" />
      </svg>
    ),
  },
};

const EXIT_ANIMATION_MS = 320;

export default function Toast({ message, variant = 'error', onClose, durationMs = 6000 }) {
  const [shown, setShown] = useState(false);
  const [exiting, setExiting] = useState(false);
  const onCloseRef = useRef(onClose);

  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    setExiting(false);
    if (!message) {
      setShown(false);
      return undefined;
    }
    const raf = requestAnimationFrame(() => setShown(true));
    const hideTimer = window.setTimeout(() => setExiting(true), durationMs);
    return () => {
      cancelAnimationFrame(raf);
      window.clearTimeout(hideTimer);
    };
  }, [message, durationMs]);

  useEffect(() => {
    if (!exiting) return undefined;
    const t = window.setTimeout(() => onCloseRef.current?.(), EXIT_ANIMATION_MS);
    return () => window.clearTimeout(t);
  }, [exiting]);

  if (!message) return null;

  const v = VARIANTS[variant] || VARIANTS.error;

  return (
    <div
      role="alert"
      aria-live="assertive"
      className={`fixed right-3 top-3 z-[130] w-[calc(100%-1.5rem)] max-w-sm transition-all duration-300 ease-out sm:right-5 sm:top-5 ${
        shown && !exiting ? 'translate-x-0 opacity-100' : 'translate-x-8 opacity-0'
      }`}
    >
      <div className={`flex items-start gap-3 rounded-xl px-4 py-3 text-white shadow-lg ${v.container}`}>
        {v.icon}
        <p className="min-w-0 flex-1 pt-0.5 text-sm font-medium leading-snug">{message}</p>
        <button
          type="button"
          onClick={() => setExiting(true)}
          className="-mr-1 -mt-0.5 shrink-0 rounded-full p-1 text-white/80 transition-colors hover:bg-white/15 hover:text-white"
          aria-label="Закрыть уведомление"
        >
          <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 6l12 12M18 6L6 18" />
          </svg>
        </button>
      </div>
    </div>
  );
}
