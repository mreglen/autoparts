import { useEffect } from 'react';
import { useDispatch } from 'react-redux';
import { fetchCart } from '../redux/slices/CartSlice';

/**
 * Держит корзину актуальной: загрузка при старте и обновление после простоя/возврата на вкладку.
 * Работает и для гостей (guest cart token).
 */
export default function useCartSync() {
    const dispatch = useDispatch();

    useEffect(() => {
        dispatch(fetchCart());
    }, [dispatch]);

    useEffect(() => {
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
    }, [dispatch]);
}
