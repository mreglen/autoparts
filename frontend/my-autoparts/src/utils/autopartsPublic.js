import { useSelector } from 'react-redux';

export const AUTOPARTS_NEW = '/autoparts/new';
export const AUTOPARTS_USED = '/autoparts/used';

/** Куда вести «Автозапчасти» с учётом флага с бэкенда. */
export function getAutopartsLandingPath(showNewAutoparts) {
  return showNewAutoparts ? AUTOPARTS_NEW : AUTOPARTS_USED;
}

/** Подсветка пункта «Автозапчасти» в шапке. */
export function isAutopartsNavActive(pathname, showNewAutoparts) {
  if (!pathname.startsWith('/autoparts')) return false;
  if (showNewAutoparts) {
    return pathname.startsWith('/autoparts/new') || pathname === '/autoparts';
  }
  return true;
}

export function useShowNewAutoparts() {
  return useSelector((state) => state.publicInfo.showNewAutoparts !== false);
}

export function useAutopartsLandingPath() {
  const showNew = useShowNewAutoparts();
  return getAutopartsLandingPath(showNew);
}
