import React, { useCallback, useEffect, useState } from 'react';
import { SW_UPDATE_EVENT } from '../../utils/networkStatus';
import { Z_MOBILE_PWA_PROMPT } from '../../constants/mobileTokens';

export default function AppUpdateBanner() {
  const [registration, setRegistration] = useState(null);

  useEffect(() => {
    const onUpdate = (event) => {
      setRegistration(event.detail?.registration || null);
    };
    window.addEventListener(SW_UPDATE_EVENT, onUpdate);
    return () => window.removeEventListener(SW_UPDATE_EVENT, onUpdate);
  }, []);

  const handleUpdate = useCallback(() => {
    if (!registration?.waiting) return;

    const reloadOnControl = () => {
      window.location.reload();
    };

    navigator.serviceWorker.addEventListener('controllerchange', reloadOnControl, { once: true });
    registration.waiting.postMessage({ type: 'SKIP_WAITING' });
  }, [registration]);

  if (!registration?.waiting) {
    return null;
  }

  return (
    <div
      className="fixed inset-x-3 max-lg:bottom-[calc(var(--sg-mobile-sticky-bottom-offset)+0.5rem)] lg:inset-x-auto lg:right-4 lg:top-4 lg:w-80 rounded-xl border border-indigo-200 bg-indigo-50 p-3 shadow-lg"
      style={{ zIndex: Z_MOBILE_PWA_PROMPT }}
    >
      <p className="text-sm font-semibold text-indigo-950">Доступна новая версия</p>
      <p className="mt-0.5 text-xs text-indigo-800">Обновите приложение, чтобы получить последние исправления.</p>
      <button
        type="button"
        onClick={handleUpdate}
        className="mt-2 min-h-11 w-full rounded-lg bg-indigo-600 px-3 text-sm font-semibold text-white active:bg-indigo-700"
      >
        Обновить приложение
      </button>
    </div>
  );
}
