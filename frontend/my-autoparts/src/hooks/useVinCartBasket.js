import { useCallback, useMemo } from 'react';
import { useDispatch, useSelector, useStore } from 'react-redux';
import {
  createNewPartsBasket,
  fetchCart,
  selectNewPartsBaskets,
  setActiveNewPartsBasket,
} from '../redux/slices/CartSlice';
import { buildVinBasketName } from '../utils/vinCartBasket';

export default function useVinCartBasket(vehicle, vin) {
  const dispatch = useDispatch();
  const store = useStore();
  const baskets = useSelector(selectNewPartsBaskets);

  const basketName = useMemo(
    () => buildVinBasketName({ make: vehicle?.make, model: vehicle?.model, vin }),
    [vehicle?.make, vehicle?.model, vin],
  );

  const basketId = useMemo(() => {
    if (!basketName) return null;
    return baskets.find((basket) => basket.name === basketName)?.id ?? null;
  }, [basketName, baskets]);

  const ensureVinBasket = useCallback(async () => {
    if (!basketName) return null;

    const existing = baskets.find((basket) => basket.name === basketName);
    if (existing?.id) {
      dispatch(setActiveNewPartsBasket(existing.id));
      return existing.id;
    }

    try {
      const created = await dispatch(createNewPartsBasket({ name: basketName })).unwrap();
      if (created?.id) {
        dispatch(setActiveNewPartsBasket(created.id));
        return created.id;
      }
    } catch {
      await dispatch(fetchCart()).unwrap().catch(() => {});
      const refreshedBaskets = selectNewPartsBaskets(store.getState());
      const refreshed = refreshedBaskets.find((basket) => basket.name === basketName);
      if (refreshed?.id) {
        dispatch(setActiveNewPartsBasket(refreshed.id));
        return refreshed.id;
      }
    }

    return null;
  }, [basketName, baskets, dispatch, store]);

  return {
    basketName,
    basketId,
    ensureVinBasket,
  };
}
