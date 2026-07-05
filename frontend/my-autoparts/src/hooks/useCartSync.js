import { useCallback, useEffect, useRef } from 'react';
import { useDispatch } from 'react-redux';
import { fetchCart } from '../redux/slices/CartSlice';
import { isApiOutage } from '../utils/apiOutageGuard';

const MIN_REFRESH_MS = 45000;

/**
 * Держит корзину актуальной: загрузка при старте и обновление после простоя/возврата на вкладку.
 * Работает и для гостей (guest cart token).
 */
export default function useCartSync() {
    const dispatch = useDispatch();
    const lastFetchAtRef = useRef(0);

    const refreshCart = useCallback((force = false) => {
        if (!force && isApiOutage()) return;
        const now = Date.now();
        if (!force && now - lastFetchAtRef.current < MIN_REFRESH_MS) return;
        lastFetchAtRef.current = now;
        dispatch(fetchCart());
    }, [dispatch]);

    useEffect(() => {
        refreshCart(true);
    }, [refreshCart]);

    useEffect(() => {
        const refresh = () => {
            if (document.visibilityState === 'visible') {
                refreshCart(false);
            }
        };

        window.addEventListener('focus', refresh);
        document.addEventListener('visibilitychange', refresh);
        return () => {
            window.removeEventListener('focus', refresh);
            document.removeEventListener('visibilitychange', refresh);
        };
    }, [refreshCart]);
}
