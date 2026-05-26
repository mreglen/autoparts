import { useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { fetchCart } from '../redux/slices/CartSlice';

/**
 * Держит корзину актуальной: загрузка при входе и обновление после простоя/возврата на вкладку.
 */
export default function useCartSync() {
    const dispatch = useDispatch();
    const token = useSelector((state) => state.auth.token);

    useEffect(() => {
        if (!token) return undefined;
        dispatch(fetchCart());
        return undefined;
    }, [dispatch, token]);

    useEffect(() => {
        if (!token) return undefined;

        const refresh = () => {
            if (document.visibilityState === 'visible') {
                dispatch(fetchCart());
            }
        };

        window.addEventListener('focus', refresh);
        document.addEventListener('visibilitychange', refresh);
        return () => {
            window.removeEventListener('focus', refresh);
            document.removeEventListener('visibilitychange', refresh);
        };
    }, [dispatch, token]);
}
