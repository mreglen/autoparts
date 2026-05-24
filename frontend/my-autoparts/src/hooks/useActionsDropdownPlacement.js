import { useLayoutEffect, useRef, useState } from 'react';
import { MOBILE_BOTTOM_NAV_OFFSET } from '../utils/actionsDropdownPlacement';

/**
 * Открывает меню «Действия» вверх, если снизу не хватает места (нижнее меню, край экрана).
 */
export function useActionsDropdownPlacement(isOpen, estimatedMenuHeight = 220) {
  const anchorRef = useRef(null);
  const [openUp, setOpenUp] = useState(false);

  useLayoutEffect(() => {
    if (!isOpen || !anchorRef.current) {
      setOpenUp(false);
      return undefined;
    }

    const updatePlacement = () => {
      const rect = anchorRef.current.getBoundingClientRect();
      const spaceBelow = window.innerHeight - rect.bottom - MOBILE_BOTTOM_NAV_OFFSET;
      const spaceAbove = rect.top;
      setOpenUp(spaceBelow < estimatedMenuHeight && spaceAbove >= estimatedMenuHeight * 0.6);
    };

    updatePlacement();
    window.addEventListener('resize', updatePlacement);
    window.addEventListener('scroll', updatePlacement, true);

    return () => {
      window.removeEventListener('resize', updatePlacement);
      window.removeEventListener('scroll', updatePlacement, true);
    };
  }, [isOpen, estimatedMenuHeight]);

  return { anchorRef, openUp };
}
