import React, { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { apiRequest } from '../../../utils/apiClient';
import {
  formatDateTime,
  formatNumber,
  RECOMMENDATION_STYLES,
} from './analyticsFormatters';
import { DataTable, LoadingState, Section } from './AnalyticsUi';
import YandexConnectSection from './YandexConnectSection';

const CLUSTER_LABELS = {
  A: 'Карточка',
  B: 'Бренд',
  C: 'Категория',
  D: 'Гео',
  unknown: 'Прочее',
};

export default function QueryReviewTab() {
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState(null);
  const [snapshot, setSnapshot] = useState(null);

  const loadLatest = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await apiRequest('/admin/analytics/query-review/latest');
      setSnapshot(data);
    } catch (e) {
      if (e?.status === 404 || String(e?.message || '').includes('404')) {
        setSnapshot(null);
      } else {
        setError(e?.message || 'Ошибка загрузки');
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadLatest();
  }, [loadLatest]);

  const runReview = async () => {
    setRunning(true);
    setError(null);
    try {
      const data = await apiRequest('/admin/analytics/query-review/run?days=28&limit=50', {
        method: 'POST',
      });
      setSnapshot(data);
    } catch (e) {
      setError(e?.message || 'Не удалось собрать топ-50');
    } finally {
      setRunning(false);
    }
  };

  if (loading && !snapshot) {
    return <LoadingState label="Загрузка итераций…" />;
  }

  const items = snapshot?.items || [];

  return (
    <div className="space-y-4">
      <YandexConnectSection />
      <Section
        title="Ежемесячный разбор запросов"
        subtitle="Топ-50 из Яндекс Вебмастера → страница или действие"
        action={
          <button
            type="button"
            onClick={runReview}
            disabled={running}
            className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
          >
            {running ? 'Сбор…' : 'Обновить сейчас'}
          </button>
        }
      >
        <div className="border-b border-gray-100 px-4 py-3 text-sm text-gray-600">
          {snapshot ? (
            <p>
              Снимок от {formatDateTime(snapshot.created_at)} · период{' '}
              {snapshot.period_start} — {snapshot.period_end}
              {snapshot.status === 'error' ? (
                <span className="ml-2 text-red-600">{snapshot.error_message}</span>
              ) : null}
            </p>
          ) : (
            <p>
              Снимков пока нет. Автосбор — 1-го числа каждого месяца. Подключите OAuth Яндекса
              (см. docs/seo/webmaster-setup.md).
            </p>
          )}
          <p className="mt-1 text-xs text-gray-500">
            Автозапуск: Celery beat, задача analytics.run_monthly_query_review
          </p>
        </div>

        {error ? (
          <p className="px-4 py-3 text-sm text-red-600">{error}</p>
        ) : null}

        {items.length === 0 ? (
          <p className="px-4 py-10 text-center text-sm text-gray-400">
            {snapshot?.status === 'error'
              ? 'Исправьте подключение Вебмастера и нажмите «Обновить»'
              : 'Нажмите «Обновить сейчас» для первого снимка'}
          </p>
        ) : (
          <DataTable
            columns={[
              {
                key: 'query',
                label: 'Запрос',
                render: (row) => <span className="font-medium text-gray-900">{row.query}</span>,
              },
              {
                key: 'cluster',
                label: 'Кластер',
                render: (row) => CLUSTER_LABELS[row.cluster] || row.cluster,
              },
              {
                key: 'impressions',
                label: 'Показы',
                align: 'right',
                render: (row) => formatNumber(row.impressions),
              },
              {
                key: 'ctr',
                label: 'CTR',
                align: 'right',
                render: (row) => `${row.ctr}%`,
              },
              {
                key: 'page',
                label: 'Страница',
                render: (row) =>
                  row.matched_path ? (
                    <span className="font-mono text-xs text-gray-600">{row.matched_path}</span>
                  ) : (
                    '—'
                  ),
              },
              {
                key: 'rec',
                label: 'Действие',
                render: (row) => (
                  <span
                    className={`rounded px-2 py-0.5 text-xs font-medium ${
                      RECOMMENDATION_STYLES[row.recommendation] || RECOMMENDATION_STYLES.review
                    }`}
                  >
                    {row.recommendation_label}
                  </span>
                ),
              },
              {
                key: 'link',
                label: '',
                render: (row) =>
                  row.recommendation === 'create_landing' ? (
                    <Link
                      to="/admin/analytics?tab=seo"
                      className="text-xs text-indigo-600 hover:underline"
                    >
                      SEO →
                    </Link>
                  ) : null,
              },
            ]}
            rows={items}
            rowKey={(row) => row.query}
          />
        )}
      </Section>
    </div>
  );
}
