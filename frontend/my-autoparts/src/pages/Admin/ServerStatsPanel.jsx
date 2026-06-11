import React, { useCallback, useEffect, useState } from 'react';
import { apiRequest } from '../../utils/apiClient';

const REFRESH_INTERVAL_MS = 30_000;

function formatBytes(bytes) {
  const value = Number(bytes);
  if (!Number.isFinite(value) || value < 0) return '—';
  const units = ['B', 'KiB', 'MiB', 'GiB', 'TiB'];
  let size = value;
  let unitIndex = 0;
  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex += 1;
  }
  return `${size.toFixed(unitIndex === 0 ? 0 : 1)} ${units[unitIndex]}`;
}

function formatDuration(seconds) {
  const total = Math.max(0, Math.floor(Number(seconds) || 0));
  const days = Math.floor(total / 86400);
  const hours = Math.floor((total % 86400) / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const parts = [];
  if (days > 0) parts.push(`${days} д`);
  if (hours > 0) parts.push(`${hours} ч`);
  if (minutes > 0 || parts.length === 0) parts.push(`${minutes} мин`);
  return parts.join(' ');
}

function formatDateTime(value) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleString('ru-RU');
}

function loadBarColor(percent) {
  if (percent >= 90) return 'bg-red-500';
  if (percent >= 75) return 'bg-amber-500';
  return 'bg-indigo-500';
}

function LoadBar({ label, percent, detail }) {
  const safePercent = Math.max(0, Math.min(100, Number(percent) || 0));
  return (
    <div>
      <div className="mb-1 flex items-center justify-between gap-2 text-sm">
        <span className="font-medium text-gray-700">{label}</span>
        <span className="tabular-nums text-gray-600">
          {safePercent.toFixed(1)}%{detail ? ` · ${detail}` : ''}
        </span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-gray-100">
        <div
          className={`h-full rounded-full transition-all ${loadBarColor(safePercent)}`}
          style={{ width: `${safePercent}%` }}
        />
      </div>
    </div>
  );
}

function InfoRow({ label, value }) {
  return (
    <div className="flex flex-wrap justify-between gap-x-4 gap-y-1 border-b border-gray-50 py-2 text-sm">
      <span className="text-gray-500">{label}</span>
      <span className="text-right font-medium text-gray-900">{value}</span>
    </div>
  );
}

function ServiceBadge({ service }) {
  const base =
    'inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium';
  if (service.ok) {
    return (
      <span className={`${base} bg-green-50 text-green-800`}>
        {service.name}: OK
        {service.latency_ms != null ? ` (${service.latency_ms} ms)` : ''}
        {service.detail ? ` · ${service.detail}` : ''}
      </span>
    );
  }
  return (
    <span className={`${base} bg-red-50 text-red-800`}>
      {service.name}: {service.detail || 'недоступен'}
    </span>
  );
}

function ServerStatsPanel() {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);

  const loadStats = useCallback(async ({ silent = false } = {}) => {
    if (!silent) {
      setLoading(true);
    } else {
      setRefreshing(true);
    }
    setError(null);
    try {
      const data = await apiRequest('/admin/server-stats');
      setStats(data);
    } catch (e) {
      setError(e?.message || 'Не удалось загрузить данные сервера');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadStats();
    const timer = window.setInterval(() => {
      loadStats({ silent: true });
    }, REFRESH_INTERVAL_MS);
    return () => window.clearInterval(timer);
  }, [loadStats]);

  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6 mb-6">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">Сервер</h2>
          <p className="text-sm text-gray-500 mt-1">
            Технические характеристики и текущая нагрузка Ubuntu-хоста, где работает API.
          </p>
        </div>
        <button
          type="button"
          onClick={() => loadStats({ silent: Boolean(stats) })}
          disabled={loading || refreshing}
          className="inline-flex items-center rounded-md border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50 disabled:opacity-50"
        >
          {loading || refreshing ? 'Обновление…' : 'Обновить'}
        </button>
      </div>

      {error && (
        <div className="mb-4 rounded-lg border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-800">
          {error}
        </div>
      )}

      {loading && !stats ? (
        <p className="text-sm text-gray-500">Загрузка данных сервера…</p>
      ) : null}

      {stats ? (
        <div className="space-y-6">
          {Array.isArray(stats.warnings) && stats.warnings.length > 0 ? (
            <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
              <p className="font-medium mb-1">Предупреждения</p>
              <ul className="list-disc pl-5 space-y-1">
                {stats.warnings.map((warning) => (
                  <li key={warning}>{warning}</li>
                ))}
              </ul>
            </div>
          ) : null}

          <div>
            <h3 className="text-sm font-semibold text-gray-900 mb-2">Характеристики</h3>
            <div className="rounded-lg border border-gray-100 bg-gray-50/60 px-4 py-1">
              <InfoRow label="Хост" value={stats.hostname} />
              <InfoRow label="ОС" value={`${stats.platform} · ${stats.os_version}`} />
              <InfoRow label="Архитектура" value={stats.architecture} />
              <InfoRow label="Python" value={stats.python_version} />
              <InfoRow label="Uptime сервера" value={formatDuration(stats.uptime_seconds)} />
              <InfoRow label="Время сбора" value={formatDateTime(stats.collected_at)} />
            </div>
          </div>

          <div>
            <h3 className="text-sm font-semibold text-gray-900 mb-3">Нагрузка сейчас</h3>
            <div className="space-y-4">
              <LoadBar
                label="CPU"
                percent={stats.cpu?.usage_percent}
                detail={
                  stats.cpu?.load_avg_1m != null
                    ? `load ${stats.cpu.load_avg_1m.toFixed(2)} / ${stats.cpu.load_avg_5m?.toFixed(2) ?? '—'} / ${stats.cpu.load_avg_15m?.toFixed(2) ?? '—'} · ${stats.cpu.cores_logical} ядер`
                    : `${stats.cpu?.cores_logical ?? '—'} ядер`
                }
              />
              <LoadBar
                label="RAM"
                percent={stats.memory?.percent}
                detail={`${formatBytes(stats.memory?.used_bytes)} / ${formatBytes(stats.memory?.total_bytes)}`}
              />
              {stats.memory?.swap_total_bytes ? (
                <LoadBar
                  label="Swap"
                  percent={stats.memory?.swap_percent}
                  detail={`${formatBytes(stats.memory?.swap_used_bytes)} / ${formatBytes(stats.memory?.swap_total_bytes)}`}
                />
              ) : null}
            </div>
          </div>

          {Array.isArray(stats.disks) && stats.disks.length > 0 ? (
            <div>
              <h3 className="text-sm font-semibold text-gray-900 mb-2">Диски</h3>
              <div className="overflow-x-auto rounded-lg border border-gray-200">
                <table className="min-w-full text-sm">
                  <thead className="bg-gray-50 text-left text-gray-500">
                    <tr>
                      <th className="px-3 py-2">Mount</th>
                      <th className="px-3 py-2">Использовано</th>
                      <th className="px-3 py-2">Всего</th>
                      <th className="px-3 py-2">%</th>
                    </tr>
                  </thead>
                  <tbody>
                    {stats.disks.map((disk) => (
                      <tr key={disk.mount} className="border-t border-gray-100">
                        <td className="px-3 py-2 font-mono text-xs">{disk.mount}</td>
                        <td className="px-3 py-2">{formatBytes(disk.used_bytes)}</td>
                        <td className="px-3 py-2">{formatBytes(disk.total_bytes)}</td>
                        <td className="px-3 py-2 tabular-nums">{disk.percent.toFixed(1)}%</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ) : null}

          {stats.process ? (
            <div>
              <h3 className="text-sm font-semibold text-gray-900 mb-2">Процесс API</h3>
              <div className="rounded-lg border border-gray-100 bg-gray-50/60 px-4 py-1">
                <InfoRow label="PID" value={stats.process.pid} />
                <InfoRow label="RAM (RSS)" value={formatBytes(stats.process.memory_rss_bytes)} />
                <InfoRow label="CPU" value={`${stats.process.cpu_percent.toFixed(1)}%`} />
                <InfoRow label="Потоки" value={stats.process.threads} />
                <InfoRow label="Uptime процесса" value={formatDuration(stats.process.uptime_seconds)} />
              </div>
            </div>
          ) : null}

          {Array.isArray(stats.services) && stats.services.length > 0 ? (
            <div>
              <h3 className="text-sm font-semibold text-gray-900 mb-2">Сервисы</h3>
              <div className="flex flex-wrap gap-2">
                {stats.services.map((service) => (
                  <ServiceBadge key={service.name} service={service} />
                ))}
              </div>
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

export default ServerStatsPanel;
