import { useEffect, useRef } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { refreshSession, logout } from '../redux/slices/AuthSlice';
import { getAuthToken } from '../utils/apiClient';
import { getRenewDelayMs, isTokenNearExpiry } from '../utils/authSessionUtils';

export default function useAuthSessionRenew() {
  const dispatch = useDispatch();
  const token = useSelector((state) => state.auth.token);
  const timerRef = useRef(null);

  useEffect(() => {
    if (!token) {
      return undefined;
    }

    const scheduleRenew = () => {
      if (timerRef.current) {
        window.clearTimeout(timerRef.current);
      }
      const delay = getRenewDelayMs(token);
      if (delay == null) return;

      timerRef.current = window.setTimeout(async () => {
        try {
          await dispatch(refreshSession()).unwrap();
        } catch {
          dispatch(logout());
        }
      }, delay);
    };

    scheduleRenew();

    const onVisibilityChange = () => {
      if (document.visibilityState !== 'visible') return;
      if (isTokenNearExpiry(getAuthToken())) {
        dispatch(refreshSession()).unwrap().catch(() => {
          dispatch(logout());
        });
      } else {
        scheduleRenew();
      }
    };

    document.addEventListener('visibilitychange', onVisibilityChange);

    return () => {
      if (timerRef.current) {
        window.clearTimeout(timerRef.current);
      }
      document.removeEventListener('visibilitychange', onVisibilityChange);
    };
  }, [dispatch, token]);
}
