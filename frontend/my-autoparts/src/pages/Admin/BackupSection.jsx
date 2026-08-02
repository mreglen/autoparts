import React, { useCallback, useEffect, useState } from 'react';
import { API_BASE, getAuthHeaders } from '../../utils/apiClient';

function formatBytes(bytes) {
  const value = Number(bytes) || 0;
  if (value < 1024) return `${value} B`;
  if (value < 1024 * 1024) return `${(value / 1024).toFixed(1)} KB`;
  if (value < 1024 * 1024 * 1024) return `${(value / (1024 * 1024)).toFixed(1)} MB`;
  return `${(value / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

function formatDate(iso) {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleString('ru-RU');
  } catch {
    return iso;
  }
}

function backupTypeLabel(type) {
  if (type === 'db') return 'База данных';
  if (type === 'uploads') return 'Uploads';
  return type;
}

function triggerLabel(trigger) {
  if (trigger === 'scheduled') return 'Авто (еженедельно)';
  if (trigger === 'manual') return 'Вручную';
  return trigger;
}

function formatApiError(err, fallback) {
  if (!err) return fallback;
  if (typeof err === 'string') return err;
  if (Array.isArray(err)) {
    return err.map((item) => item?.msg || String(item)).join('; ') || fallback;
  }
  if (typeof err === 'object' && err.msg) return err.msg;
  return fallback;
}

async function downloadBackupResponse(response, fallbackName) {
  if (!response.ok) {
    if (response.status === 502 || response.status === 504) {
      throw new Error(
        'Сервер не успел отдать файл (таймаут прокси). Создайте копию отдельно и скачайте из списка.'
      );
    }
    const err = await response.json().catch(() => ({}));
    throw new Error(formatApiError(err.detail, 'Ошибка скачивания'));
  }
  const blob = await response.blob();
  const match = (response.headers.get('Content-Disposition') || '').match(/filename="([^"]+)"/);
  const filename = match?.[1] || fallbackName;
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  window.URL.revokeObjectURL(url);
  return filename;
}

async function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitForBackupJob(jobId, { onProgress } = {}) {
  const started = Date.now();
  const maxMs = 45 * 60 * 1000;
  while (Date.now() - started < maxMs) {
    const response = await fetch(`${API_BASE}/admin/backups/jobs/${encodeURIComponent(jobId)}`, {
      headers: getAuthHeaders(),
    });
    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      throw new Error(formatApiError(err.detail, 'Не удалось получить статус задачи'));
    }
    const job = await response.json();
    if (typeof onProgress === 'function') onProgress(job);
    if (job.status === 'done') return job;
    if (job.status === 'error') {
      throw new Error(job.error || 'Ошибка создания резервной копии');
    }
    await sleep(2000);
  }
  throw new Error('Создание резервной копии занимает слишком долго. Проверьте список позже.');
}

export default function BackupSection() {
  const [backups, setBackups] = useState([]);
  const [retentionCount, setRetentionCount] = useState(8);
  const [weeklyHourUtc, setWeeklyHourUtc] = useState(4);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [notice, setNotice] = useState(null);
  const [busyDb, setBusyDb] = useState(false);
  const [busyUploads, setBusyUploads] = useState(false);
  const [progressDb, setProgressDb] = useState(null);
  const [progressUploads, setProgressUploads] = useState(null);
  const [downloadingId, setDownloadingId] = useState(null);
  const [deletingId, setDeletingId] = useState(null);

  const loadBackups = useCallback(async () => {
    const rows = await fetch(`${API_BASE}/admin/backups`, {
      headers: getAuthHeaders(),
    });
    if (!rows.ok) {
      const err = await rows.json().catch(() => ({}));
      throw new Error(formatApiError(err.detail, 'Не удалось загрузить список резервных копий'));
    }
    const data = await rows.json();
    if (Array.isArray(data)) {
      setBackups(data);
      return;
    }
    setBackups(Array.isArray(data.items) ? data.items : []);
    if (data.retention_count != null) setRetentionCount(Number(data.retention_count) || 8);
    if (data.weekly_hour_utc != null) setWeeklyHourUtc(Number(data.weekly_hour_utc) || 4);
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        await loadBackups();
      } catch (e) {
        if (!cancelled) setError(e?.message || 'Не удалось загрузить резервные копии');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [loadBackups]);

  const createAndDownload = async (kind) => {
    const isDb = kind === 'db';
    const setBusy = isDb ? setBusyDb : setBusyUploads;
    const setProgress = isDb ? setProgressDb : setProgressUploads;
    setBusy(true);
    setError(null);
    setNotice(null);
    setProgress('Запуск…');
    try {
      const startResponse = await fetch(
        `${API_BASE}/admin/backups/jobs/${isDb ? 'database' : 'uploads'}`,
        {
          method: 'POST',
          headers: getAuthHeaders(),
        }
      );
      if (!startResponse.ok) {
        if (startResponse.status === 502 || startResponse.status === 504) {
          throw new Error('Прокси оборвал запрос (502/504). Обновите nginx-таймауты для /admin/backups/.');
        }
        const err = await startResponse.json().catch(() => ({}));
        throw new Error(formatApiError(err.detail, 'Не удалось запустить создание копии'));
      }
      const started = await startResponse.json();
      const jobId = started?.id;
      if (!jobId) throw new Error('Сервер не вернул id задачи');

      setProgress('Создание на сервере…');
      const job = await waitForBackupJob(jobId, {
        onProgress: () => setProgress('Создание на сервере…'),
      });
      const backupId = job?.result?.id;
      if (!backupId) throw new Error('Копия создана, но id файла не получен');

      setProgress('Скачивание…');
      const response = await fetch(
        `${API_BASE}/admin/backups/${encodeURIComponent(backupId)}/download`,
        { headers: getAuthHeaders() }
      );
      const filename = await downloadBackupResponse(
        response,
        isDb ? 'database-backup.sql.gz' : 'uploads-backup.tar.gz'
      );
      setNotice(`Готово: ${filename}`);
      await loadBackups();
    } catch (e) {
      setError(e?.message || 'Ошибка создания резервной копии');
      try {
        await loadBackups();
      } catch {
        /* ignore */
      }
    } finally {
      setBusy(false);
      setProgress(null);
    }
  };

  const downloadExisting = async (backupId) => {
    setDownloadingId(backupId);
    setError(null);
    setNotice(null);
    try {
      const response = await fetch(`${API_BASE}/admin/backups/${encodeURIComponent(backupId)}/download`, {
        headers: getAuthHeaders(),
      });
      const filename = await downloadBackupResponse(response, backupId);
      setNotice(`Скачан файл: ${filename}`);
    } catch (e) {
      setError(e?.message || 'Ошибка скачивания');
    } finally {
      setDownloadingId(null);
    }
  };

  const deleteBackup = async (backupId) => {
    if (!window.confirm(`Удалить резервную копию ${backupId}?`)) return;
    setDeletingId(backupId);
    setError(null);
    setNotice(null);
    try {
      const response = await fetch(`${API_BASE}/admin/backups/${encodeURIComponent(backupId)}`, {
        method: 'DELETE',
        headers: getAuthHeaders(),
      });
      if (!response.ok && response.status !== 204) {
        const err = await response.json().catch(() => ({}));
        throw new Error(formatApiError(err.detail, 'Не удалось удалить'));
      }
      setNotice('Резервная копия удалена');
      await loadBackups();
    } catch (e) {
      setError(e?.message || 'Ошибка удаления');
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <section className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm sm:p-6">
      <h2 className="mb-4 text-lg font-semibold text-gray-900">Резервные копии</h2>

      {error && (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}
      {notice && (
        <div className="mb-4 rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">
          {notice}
        </div>
      )}

      <div className="flex flex-col sm:flex-row gap-3 mb-2">
        <button
          type="button"
          disabled={busyDb || busyUploads}
          onClick={() => createAndDownload('db')}
          className="inline-flex items-center justify-center px-4 py-2.5 rounded-lg bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-700 disabled:opacity-50"
        >
          {busyDb ? progressDb || 'Создание копии БД…' : 'Создать и скачать БД'}
        </button>
        <button
          type="button"
          disabled={busyDb || busyUploads}
          onClick={() => createAndDownload('uploads')}
          className="inline-flex items-center justify-center px-4 py-2.5 rounded-lg bg-gray-800 text-white text-sm font-medium hover:bg-gray-900 disabled:opacity-50"
        >
          {busyUploads ? progressUploads || 'Архивирование uploads…' : 'Создать и скачать uploads'}
        </button>
      </div>
      {(progressDb || progressUploads) && (
        <p className="text-xs text-gray-500 mb-4">
          {progressDb || progressUploads} Архив больших uploads может занять несколько минут.
        </p>
      )}

      <div className="text-sm text-gray-500 mb-3">
        Хранится последних {retentionCount} копий каждого типа. Автобэкап — по воскресеньям в {weeklyHourUtc}:00 UTC.
      </div>

      {loading ? (
        <p className="text-sm text-gray-500">Загрузка списка…</p>
      ) : backups.length === 0 ? (
        <p className="text-sm text-gray-500">Сохранённых копий пока нет.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 text-left text-gray-500">
                <th className="py-2 pr-4 font-medium">Тип</th>
                <th className="py-2 pr-4 font-medium">Создано</th>
                <th className="py-2 pr-4 font-medium">Источник</th>
                <th className="py-2 pr-4 font-medium">Размер</th>
                <th className="py-2 pr-4 font-medium">Файл</th>
                <th className="py-2 font-medium">Действия</th>
              </tr>
            </thead>
            <tbody>
              {backups.map((row) => (
                <tr key={row.id} className="border-b border-gray-100">
                  <td className="py-2 pr-4">{backupTypeLabel(row.backup_type)}</td>
                  <td className="py-2 pr-4 whitespace-nowrap">{formatDate(row.created_at)}</td>
                  <td className="py-2 pr-4">{triggerLabel(row.trigger)}</td>
                  <td className="py-2 pr-4 whitespace-nowrap">{formatBytes(row.size_bytes)}</td>
                  <td className="py-2 pr-4 font-mono text-xs break-all">{row.filename}</td>
                  <td className="py-2 whitespace-nowrap">
                    <button
                      type="button"
                      disabled={downloadingId === row.id || deletingId === row.id}
                      onClick={() => downloadExisting(row.id)}
                      className="text-indigo-600 hover:text-indigo-800 mr-3 disabled:opacity-50"
                    >
                      {downloadingId === row.id ? '…' : 'Скачать'}
                    </button>
                    <button
                      type="button"
                      disabled={downloadingId === row.id || deletingId === row.id}
                      onClick={() => deleteBackup(row.id)}
                      className="text-red-600 hover:text-red-800 disabled:opacity-50"
                    >
                      {deletingId === row.id ? '…' : 'Удалить'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
