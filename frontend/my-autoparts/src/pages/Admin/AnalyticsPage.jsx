import React, { useCallback, useEffect, useState } from 'react';
import { Navigate, useSearchParams } from 'react-router-dom';
import { useAuthReady } from '../../hooks/useAuthReady';
import AuthLoadingScreen from '../../components/AuthLoadingScreen/AuthLoadingScreen';
import { apiRequest } from '../../utils/apiClient';
import { ErrorBanner, TabSwitcher } from './analytics/AnalyticsUi';
import ConversionsTab from './analytics/ConversionsTab';
import QueryReviewTab from './analytics/QueryReviewTab';
import SeoTab from './analytics/SeoTab';

const TABS = [
  { id: 'conversions', label: 'Конверсии' },
  { id: 'iterations', label: 'Итерации' },
  { id: 'seo', label: 'SEO' },
];

export default function AnalyticsPage() {
  const { isReady, user, isAuthenticated } = useAuthReady();
  const [searchParams] = useSearchParams();
  const tabFromUrl = searchParams.get('tab');
  const [viewMode, setViewMode] = useState(() => {
    if (tabFromUrl === 'seo') return 'seo';
    if (tabFromUrl === 'iterations') return 'iterations';
    return 'conversions';
  });
  const [days, setDays] = useState(7);
  const [loading, setLoading] = useState(true);
  const [detailLoading, setDetailLoading] = useState(false);
  const [error, setError] = useState(null);
  const [summary, setSummary] = useState(null);
  const [funnel, setFunnel] = useState(null);
  const [sources, setSources] = useState(null);
  const [landings, setLandings] = useState(null);
  const [conversionTrend, setConversionTrend] = useState(null);
  const [productCards, setProductCards] = useState(null);
  const [pages, setPages] = useState([]);
  const [activity, setActivity] = useState([]);
  const [selectedPath, setSelectedPath] = useState(null);
  const [pageDetail, setPageDetail] = useState(null);

  useEffect(() => {
    if (tabFromUrl === 'seo') setViewMode('seo');
    else if (tabFromUrl === 'iterations') setViewMode('iterations');
    else if (tabFromUrl === 'conversions' || tabFromUrl === 'traffic') setViewMode('conversions');
  }, [tabFromUrl]);

  const loadConversionsData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [
        summaryRes,
        funnelRes,
        sourcesRes,
        landingsRes,
        trendRes,
        cardsRes,
        pagesRes,
        activityRes,
      ] = await Promise.all([
        apiRequest(`/admin/analytics/summary?days=${days}`),
        apiRequest(`/admin/analytics/funnel?days=${days}`),
        apiRequest(`/admin/analytics/sources?days=${days}`),
        apiRequest(`/admin/analytics/landings?days=${days}`),
        apiRequest(`/admin/analytics/conversions/trend?days=${days}`),
        apiRequest(`/admin/analytics/product-cards?days=${days}&limit=50`),
        apiRequest(`/admin/analytics/pages?days=${days}`),
        apiRequest(`/admin/analytics/activity?days=${days}`),
      ]);
      setSummary(summaryRes);
      setFunnel(funnelRes);
      setSources(sourcesRes);
      setLandings(landingsRes);
      setConversionTrend(trendRes);
      setProductCards(cardsRes);
      const items = pagesRes?.items || [];
      setPages(items);
      setActivity(activityRes?.items || []);
      setSelectedPath((prev) => {
        if (prev && items.some((row) => row.path_template === prev)) return prev;
        return items[0]?.path_template ?? null;
      });
    } catch (e) {
      setError(e?.message || 'Ошибка загрузки');
    } finally {
      setLoading(false);
    }
  }, [days]);

  const loadPageDetail = useCallback(
    async (pathTemplate) => {
      setDetailLoading(true);
      try {
        const detail = await apiRequest(
          `/admin/analytics/page-detail?days=${days}&path_template=${encodeURIComponent(pathTemplate)}`
        );
        setPageDetail(detail);
      } catch (e) {
        setError(e?.message || 'Ошибка загрузки');
      } finally {
        setDetailLoading(false);
      }
    },
    [days]
  );

  useEffect(() => {
    if (!isReady || !user?.is_admin || viewMode !== 'conversions') return;
    loadConversionsData();
  }, [isReady, user?.is_admin, viewMode, loadConversionsData]);

  useEffect(() => {
    if (!isReady || !user?.is_admin || viewMode !== 'conversions' || !selectedPath) return;
    loadPageDetail(selectedPath);
  }, [isReady, user?.is_admin, viewMode, selectedPath, days, loadPageDetail]);

  if (!isReady) return <AuthLoadingScreen />;
  if (!isAuthenticated) return <Navigate to="/auth" replace />;
  if (!user.is_admin) return <Navigate to="/dashboard" replace />;

  return (
    <div className="mx-auto max-w-7xl space-y-4">
      <header className="sticky top-0 z-10 -mx-1 border-b border-gray-100 bg-white/95 px-1 pb-4 pt-1 backdrop-blur supports-[backdrop-filter]:bg-white/80">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-xl font-bold text-gray-900">Аналитика</h1>
          <TabSwitcher tabs={TABS} value={viewMode} onChange={setViewMode} />
        </div>
      </header>

      <ErrorBanner message={error} onDismiss={() => setError(null)} />

      {viewMode === 'conversions' && (
        <ConversionsTab
          days={days}
          onDaysChange={setDays}
          loading={loading}
          summary={summary}
          funnel={funnel}
          sources={sources}
          landings={landings}
          conversionTrend={conversionTrend}
          productCards={productCards}
          pages={pages}
          activity={activity}
          selectedPath={selectedPath}
          onSelectPath={setSelectedPath}
          pageDetail={pageDetail}
          detailLoading={detailLoading}
        />
      )}

      {viewMode === 'iterations' && <QueryReviewTab />}

      {viewMode === 'seo' && <SeoTab />}
    </div>
  );
}
