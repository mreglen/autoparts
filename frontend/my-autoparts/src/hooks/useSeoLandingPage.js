import { useCallback, useEffect, useMemo, useState } from 'react';
import { apiRequest } from '../utils/apiClient';
import { buildBreadcrumbsForPath } from '../utils/breadcrumbs';

const PAGE_SIZE = 48;

export function useSeoLandingPage({
  kind,
  slug,
  breadcrumbPath,
  getBreadcrumbContext,
  fetchCatalogPage,
  buildSeo,
}) {
  const [landing, setLanding] = useState(null);
  const [catalogData, setCatalogData] = useState(null);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    setPage(1);
  }, [slug, kind]);

  const loadPage = useCallback(async () => {
    if (!slug || !kind) return;
    setLoading(true);
    setError(null);
    try {
      const resolved = await apiRequest(
        `/public/seo/landings/${encodeURIComponent(kind)}/${encodeURIComponent(slug)}`,
      );
      setLanding(resolved);
      const catalog = await fetchCatalogPage(resolved, page, PAGE_SIZE);
      setCatalogData(catalog);
    } catch (e) {
      setError(e?.message || 'Страница не найдена');
      setLanding(null);
      setCatalogData(null);
    } finally {
      setLoading(false);
    }
  }, [kind, slug, page, fetchCatalogPage]);

  useEffect(() => {
    loadPage();
  }, [loadPage]);

  const seo = useMemo(() => {
    if (!landing) return null;
    return buildSeo({
      landing,
      total: catalogData?.total || 0,
      items: catalogData?.items || [],
    });
  }, [landing, catalogData, buildSeo]);

  const breadcrumbItems = useMemo(() => {
    if (!breadcrumbPath) return [];
    const context = getBreadcrumbContext?.(landing) || {};
    return buildBreadcrumbsForPath(breadcrumbPath, context);
  }, [breadcrumbPath, landing, getBreadcrumbContext]);

  const totalPages = Math.max(1, Math.ceil((catalogData?.total || 0) / PAGE_SIZE));

  return {
    landing,
    catalogData,
    seo,
    breadcrumbItems,
    page,
    setPage,
    loading,
    error,
    totalPages,
    pageSize: PAGE_SIZE,
  };
}
