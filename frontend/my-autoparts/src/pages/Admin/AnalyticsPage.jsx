import React, { useCallback, useEffect, useState } from 'react';
import { Navigate, useSearchParams } from 'react-router-dom';
import { useAuthReady } from '../../hooks/useAuthReady';
import AuthLoadingScreen from '../../components/AuthLoadingScreen/AuthLoadingScreen';
import { apiRequest } from '../../utils/apiClient';
import { ErrorBanner, TabSwitcher } from './analytics/AnalyticsUi';
import SeoTab from './analytics/SeoTab';
import TrafficTab from './analytics/TrafficTab';

const TABS = [
  { id: 'traffic', label: 'Посещаемость' },
  { id: 'seo', label: 'SEO' },
];

export default function AnalyticsPage() {
  const { isReady, user, isAuthenticated } = useAuthReady();
  const [searchParams] = useSearchParams();
  const [viewMode, setViewMode] = useState(() => (searchParams.get('tab') === 'seo' ? 'seo' : 'traffic'));
  const [days, setDays] = useState(7);
  const [loading, setLoading] = useState(true);
  const [detailLoading, setDetailLoading] = useState(false);
  const [error, setError] = useState(null);
  const [summary, setSummary] = useState(null);
  const [pages, setPages] = useState([]);
  const [activity, setActivity] = useState([]);
  const [selectedPath, setSelectedPath] = useState(null);
  const [pageDetail, setPageDetail] = useState(null);

  useEffect(() => {
    if (searchParams.get('tab') === 'seo') setViewMode('seo');
  }, [searchParams]);

  const loadPagesData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [summaryRes, pagesRes, activityRes] = await Promise.all([
        apiRequest(`/admin/analytics/summary?days=${days}`),
        apiRequest(`/admin/analytics/pages?days=${days}`),
        apiRequest(`/admin/analytics/activity?days=${days}`),
      ]);
      setSummary(summaryRes);
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
    if (!isReady || !user?.is_admin || viewMode !== 'traffic') return;
    loadPagesData();
  }, [isReady, user?.is_admin, viewMode, loadPagesData]);

  useEffect(() => {
    if (!isReady || !user?.is_admin || viewMode !== 'traffic' || !selectedPath) return;
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

      {viewMode === 'traffic' && (
        <TrafficTab
          days={days}
          onDaysChange={setDays}
          loading={loading}
          summary={summary}
          pages={pages}
          activity={activity}
          selectedPath={selectedPath}
          onSelectPath={setSelectedPath}
          pageDetail={pageDetail}
          detailLoading={detailLoading}
        />
      )}

      {viewMode === 'seo' && <SeoTab />}
    </div>
  );
}
