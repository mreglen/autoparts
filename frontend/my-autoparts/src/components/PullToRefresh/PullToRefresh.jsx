import React, { useCallback } from 'react';
import { useLocation } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import usePullToRefresh from '../../hooks/usePullToRefresh';
import { fetchStorageLocations } from '../../redux/slices/OrganizationSlice';
import { fetchPartTypes } from '../../redux/slices/PartTypeSlice';
import { isMyPartsFormRoute } from '../../utils/partRoutes';
import { showSplashBeforeReload } from '../../utils/appSplash';

const SOFT_REFRESH_MIN_MS = 350;
const AUTOSERVICE_DOCUMENT_PATH_RE = /^\/autoservice\/orders\/\d+\/print(\/upd|\/invoice)?$/;

export default function PullToRefresh() {
  const location = useLocation();
  const dispatch = useDispatch();
  const organizationId = useSelector((state) => state.auth.user?.organization_id);
  const disablePullToRefresh = AUTOSERVICE_DOCUMENT_PATH_RE.test(location.pathname);

  const onRefresh = useCallback(async () => {
    if (!isMyPartsFormRoute(location.pathname)) {
      await showSplashBeforeReload();
      window.location.reload();
      return;
    }

    const startedAt = Date.now();
    const tasks = [dispatch(fetchPartTypes())];
    if (organizationId) {
      tasks.push(dispatch(fetchStorageLocations(organizationId)));
    }
    await Promise.allSettled(tasks);

    const minMs = isMyPartsFormRoute(location.pathname) ? 0 : SOFT_REFRESH_MIN_MS;
    const elapsed = Date.now() - startedAt;
    if (minMs > 0 && elapsed < minMs) {
      await new Promise((resolve) => {
        setTimeout(resolve, minMs - elapsed);
      });
    }
  }, [dispatch, location.pathname, organizationId]);

  const { distance, refreshing, threshold, isActive } = usePullToRefresh({
    enabled: !disablePullToRefresh,
    onRefresh,
  });

  if (!isActive || (distance <= 0 && !refreshing)) {
    return null;
  }

  const progress = Math.min(distance / threshold, 1);
  const ready = distance >= threshold;
  const onFormPage = isMyPartsFormRoute(location.pathname);

  return (
    <div
      className="pointer-events-none fixed inset-x-0 z-30 flex justify-center lg:hidden"
      style={{ top: 'calc(env(safe-area-inset-top, 0px) + 3.75rem)' }}
      aria-live="polite"
      aria-hidden={distance <= 0 && !refreshing}
    >
      <div
        className="flex flex-col items-center"
        style={{
          transform: `translateY(${Math.min(distance * 0.6, 40)}px)`,
          transition: refreshing ? undefined : 'transform 80ms ease-out',
        }}
      >
        <div
          className={`flex h-11 w-11 items-center justify-center rounded-full border bg-white shadow-md ${
            ready || refreshing ? 'border-indigo-200' : 'border-gray-200 text-gray-400'
          }`}
        >
          {refreshing ? (
            <img
              src="/img/LogoWithoutBg.png"
              alt=""
              className="h-8 w-8 animate-pulse object-contain"
              aria-hidden="true"
            />
          ) : (
            <svg
              className="h-4 w-4 transition-transform duration-100"
              style={{ transform: `rotate(${progress * 180}deg)` }}
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth="2.5"
              aria-hidden="true"
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
            </svg>
          )}
        </div>
        {(ready || refreshing) && (
          <span className="mt-1.5 rounded-full bg-white/90 px-2.5 py-0.5 text-xs font-medium text-gray-600 shadow-sm">
            {refreshing
              ? (onFormPage ? 'Обновление справочников…' : 'Обновление…')
              : 'Отпустите для обновления'}
          </span>
        )}
      </div>
    </div>
  );
}
