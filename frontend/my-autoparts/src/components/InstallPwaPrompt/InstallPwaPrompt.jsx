import React, { useCallback, useEffect, useState } from 'react';
import useIsNarrowMobile from '../../hooks/useIsNarrowMobile';

const LS_KEY = 'pwa_install_dismissed';

function isStandalone() {
  return (
    window.matchMedia?.('(display-mode: standalone)')?.matches === true ||
    window.navigator.standalone === true
  );
}

function isIosSafari() {
  const ua = window.navigator.userAgent || '';
  const iOS = /iPad|iPhone|iPod/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  return iOS && !/CriOS|FxiOS|EdgiOS/.test(ua);
}

export default function InstallPwaPrompt() {
  const narrow = useIsNarrowMobile();
  const [dismissed, setDismissed] = useState(() => {
    try {
      return localStorage.getItem(LS_KEY) === '1';
    } catch {
      return false;
    }
  });
  const [deferred, setDeferred] = useState(null);
  const [showIosHint, setShowIosHint] = useState(false);

  useEffect(() => {
    const onBeforeInstall = (e) => {
      e.preventDefault();
      setDeferred(e);
    };
    window.addEventListener('beforeinstallprompt', onBeforeInstall);
    return () => window.removeEventListener('beforeinstallprompt', onBeforeInstall);
  }, []);

  const handleDismiss = useCallback(() => {
    try {
      localStorage.setItem(LS_KEY, '1');
    } catch {
      /* ignore */
    }
    setDismissed(true);
    setShowIosHint(false);
  }, []);

  const handleInstall = useCallback(async () => {
    if (deferred?.prompt) {
      await deferred.prompt();
      setDeferred(null);
      return;
    }
    if (isIosSafari()) {
      setShowIosHint(true);
    }
  }, [deferred]);

  if (!narrow || dismissed || isStandalone()) {
    return null;
  }

  const canChromeInstall = Boolean(deferred);
  const canShowBanner = canChromeInstall || isIosSafari();

  if (!canShowBanner) {
    return null;
  }

  return (
    <div
      className="lg:hidden fixed inset-x-3 z-[48] rounded-xl border border-indigo-100 bg-white p-3 shadow-lg"
      style={{
        bottom: 'calc(3.5rem + env(safe-area-inset-bottom, 0px) + 4.25rem)',
      }}
    >
      <div className="flex items-start gap-2">
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-gray-900">Установить приложение</p>
          <p className="mt-0.5 text-xs text-gray-600">
            Быстрый доступ с главного экрана. Работает как отдельное окно.
          </p>
          {showIosHint ? (
            <p className="mt-2 text-xs text-gray-700">
              На iPhone: в Safari нажмите кнопку «Поделиться», затем «На экран «Домой»».
            </p>
          ) : null}
        </div>
        <div className="flex shrink-0 flex-col gap-1">
          <button
            type="button"
            onClick={handleInstall}
            className="min-h-9 rounded-lg bg-indigo-600 px-3 text-xs font-semibold text-white active:bg-indigo-700"
          >
            {canChromeInstall ? 'Установить' : 'Как установить'}
          </button>
          <button type="button" onClick={handleDismiss} className="text-xs font-medium text-gray-500 underline">
            Не показывать
          </button>
        </div>
      </div>
    </div>
  );
}
