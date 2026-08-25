import { useEffect, useState } from 'react';
import { getIsMobileShell, subscribeMobileShell } from '../constants/breakpoints';

/** True when viewport uses mobile shell (header + bottom nav), width < 1024px */
export default function useMobileShell() {
  const [isShell, setIsShell] = useState(getIsMobileShell);

  useEffect(() => subscribeMobileShell(setIsShell), []);

  return isShell;
}
