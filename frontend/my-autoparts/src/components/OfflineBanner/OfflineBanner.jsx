import React from 'react';
import useNetworkStatus from '../../hooks/useNetworkStatus';
import { Z_MOBILE_HEADER } from '../../constants/mobileTokens';

export default function OfflineBanner() {
  const { offline } = useNetworkStatus();

  if (!offline) {
    return null;
  }

  return (
    <div
      role="status"
      className="fixed inset-x-0 top-[var(--sg-mobile-header-h)] z-[39] border-b border-amber-200 bg-amber-50 px-3 py-2 text-center text-sm font-medium text-amber-900 lg:hidden"
      style={{ zIndex: Z_MOBILE_HEADER - 1 }}
    >
      Нет подключения к интернету. Некоторые действия недоступны.
    </div>
  );
}
