import React, { useCallback, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Z_COOKIE_BANNER } from '../../constants/mobileTokens';

const LS_KEY = 'cookie_consent_accepted';

function readConsentSettled() {
  try {
    const value = localStorage.getItem(LS_KEY);
    return value === '1' || value === '0';
  } catch {
    return false;
  }
}

export default function CookieBanner() {
  const location = useLocation();
  const isAuthRoute = location.pathname.startsWith('/auth');
  const [visible, setVisible] = useState(() => !readConsentSettled());

  const saveConsent = useCallback((value) => {
    try {
      localStorage.setItem(LS_KEY, value);
    } catch {
      /* ignore */
    }
    setVisible(false);
  }, []);

  const handleAccept = useCallback(() => saveConsent('1'), [saveConsent]);
  const handleReject = useCallback(() => saveConsent('0'), [saveConsent]);

  if (!visible) {
    return null;
  }

  return (
    <div
      className={`fixed inset-x-0 border-t border-gray-200 bg-white/95 shadow-[0_-4px_24px_rgba(0,0,0,0.08)] backdrop-blur-sm bottom-0 ${
        isAuthRoute ? '' : 'max-lg:bottom-[var(--sg-mobile-sticky-bottom-offset)]'
      }`}
      style={{ zIndex: Z_COOKIE_BANNER }}
      role="dialog"
      aria-live="polite"
      aria-label="Уведомление об использовании cookie"
    >
      <div className="mx-auto flex max-w-7xl flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4 sm:py-3.5 md:px-6">
        <p className="text-sm leading-relaxed text-gray-700">
          Мы используем файлы cookie для работы сайта, корзины и аналитики. Продолжая пользоваться сайтом, вы
          соглашаетесь с{' '}
          <Link to="/cookie-policy" className="font-medium text-indigo-600 hover:underline">
            политикой обработки cookie
          </Link>
          .
        </p>
        <div className="flex shrink-0 flex-wrap gap-2 sm:flex-nowrap">
          <button
            type="button"
            onClick={handleReject}
            className="inline-flex items-center justify-center rounded-xl border border-gray-300 bg-white px-5 py-2.5 text-sm font-semibold text-gray-700 shadow-sm transition hover:bg-gray-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 sm:min-w-[7.5rem]"
          >
            Отклонить
          </button>
          <button
            type="button"
            onClick={handleAccept}
            className="inline-flex items-center justify-center rounded-xl bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 sm:min-w-[7.5rem]"
          >
            Принять
          </button>
        </div>
      </div>
    </div>
  );
}
