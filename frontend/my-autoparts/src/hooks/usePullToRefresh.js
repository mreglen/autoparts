import { useCallback, useEffect, useRef, useState } from 'react';
import useIsNarrowMobile from './useIsNarrowMobile';
import { isTouchAtScrollTop } from '../utils/scrollAtTop';
import { triggerPullReadyHaptic, triggerPullRefreshHaptic, waitForHaptic } from '../utils/haptics';

const PULL_THRESHOLD = 64;
const MAX_PULL = 96;
const DAMPING = 0.45;

export default function usePullToRefresh({ enabled = true, onRefresh } = {}) {
  const isNarrow = useIsNarrowMobile();
  const [distance, setDistance] = useState(0);
  const [refreshing, setRefreshing] = useState(false);

  const trackingRef = useRef(false);
  const startYRef = useRef(0);
  const startXRef = useRef(0);
  const pullDistanceRef = useRef(0);
  const refreshingRef = useRef(false);
  const thresholdHapticFiredRef = useRef(false);

  const finishRefresh = useCallback(() => {
    refreshingRef.current = false;
    pullDistanceRef.current = 0;
    setRefreshing(false);
    setDistance(0);
  }, []);

  const refresh = useCallback(async () => {
    triggerPullRefreshHaptic();
    await waitForHaptic();

    if (onRefresh) {
      try {
        await onRefresh();
      } finally {
        finishRefresh();
      }
      return;
    }
    window.location.reload();
  }, [onRefresh, finishRefresh]);

  useEffect(() => {
    refreshingRef.current = refreshing;
  }, [refreshing]);

  useEffect(() => {
    if (!enabled || !isNarrow) return undefined;

    const resetPull = () => {
      trackingRef.current = false;
      pullDistanceRef.current = 0;
      setDistance(0);
    };

    const onTouchStart = (event) => {
      if (refreshingRef.current) return;
      if (event.touches.length !== 1) return;
      if (!isTouchAtScrollTop(event.target)) return;

      trackingRef.current = true;
      thresholdHapticFiredRef.current = false;
      startYRef.current = event.touches[0].clientY;
      startXRef.current = event.touches[0].clientX;
    };

    const onTouchMove = (event) => {
      if (!trackingRef.current || refreshingRef.current) return;

      const touch = event.touches[0];
      const deltaY = touch.clientY - startYRef.current;
      const deltaX = touch.clientX - startXRef.current;

      if (Math.abs(deltaX) > Math.abs(deltaY) && Math.abs(deltaY) < 12) return;

      if (deltaY <= 0) {
        pullDistanceRef.current = 0;
        setDistance(0);
        return;
      }

      if (!isTouchAtScrollTop(event.target)) {
        resetPull();
        return;
      }

      const nextDistance = Math.min(deltaY * DAMPING, MAX_PULL);
      pullDistanceRef.current = nextDistance;
      setDistance(nextDistance);

      if (nextDistance >= PULL_THRESHOLD && !thresholdHapticFiredRef.current) {
        thresholdHapticFiredRef.current = true;
        triggerPullReadyHaptic();
      } else if (nextDistance < PULL_THRESHOLD) {
        thresholdHapticFiredRef.current = false;
      }

      if (nextDistance > 10) {
        event.preventDefault();
      }
    };

    const onTouchEnd = () => {
      if (!trackingRef.current || refreshingRef.current) {
        trackingRef.current = false;
        return;
      }

      if (pullDistanceRef.current >= PULL_THRESHOLD) {
        refreshingRef.current = true;
        setRefreshing(true);
        setDistance(PULL_THRESHOLD);
        void refresh();
      } else {
        resetPull();
      }

      trackingRef.current = false;
    };

    document.addEventListener('touchstart', onTouchStart, { passive: true });
    document.addEventListener('touchmove', onTouchMove, { passive: false });
    document.addEventListener('touchend', onTouchEnd);
    document.addEventListener('touchcancel', onTouchEnd);

    return () => {
      document.removeEventListener('touchstart', onTouchStart);
      document.removeEventListener('touchmove', onTouchMove);
      document.removeEventListener('touchend', onTouchEnd);
      document.removeEventListener('touchcancel', onTouchEnd);
    };
  }, [enabled, isNarrow, refresh]);

  return {
    distance,
    refreshing,
    threshold: PULL_THRESHOLD,
    isActive: isNarrow && enabled,
  };
}
