import { useMemo } from 'react';
import { useLocation } from 'react-router-dom';
import { useSelector } from 'react-redux';
import { buildBreadcrumbsForPath } from '../utils/breadcrumbs';

export function usePageBreadcrumbs(extraContext = {}) {
  const { pathname } = useLocation();
  const currentProduct = useSelector((state) => state.products.currentProduct);

  return useMemo(() => {
    const context = { ...extraContext };
    if (pathname.startsWith('/part/') && currentProduct && !context.product) {
      context.product = currentProduct;
    }
    return buildBreadcrumbsForPath(pathname, context);
  }, [pathname, currentProduct, extraContext]);
}
