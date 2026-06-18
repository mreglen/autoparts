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

async function downloadBackupResponse(response, fallbackName) {
  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.detail || 'Ошибка скачивания');
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

export default function BackupSection() {
  const [backups, setBackups] = useState([]);
  const [retentionCount, setRetentionCount] = useState(8);
  const [weeklyHourUtc, setWeeklyHourUtc] = useState(4);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [notice, setNotice] = useState(null);
  const [busyDb, setBusyDb] = useState(false);
  const [busyUploads, setBusyUploads] = useState(false);
  const [downloadingId, setDownloadingId] = useState(null);
  const [deletingId, setDeletingId] = useState(null);

  const loadBackups = useCallback(async () => {
    const rows = await fetch(`${API_BASE}/admin/backups`, {
      headers: getAuthHeaders(),
    });
    if (!rows.ok) {
      const err = await rows.json().catch(() => ({}));
      throw new Error(err.detail || 'Не удалось загрузить список резервных копий');
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
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const response = await fetch(`${API_BASE}/admin/backups/${kind}/download`, {
        method: 'POST',
        headers: getAuthHeaders(),
      });
      const filename = await downloadBackupResponse(
        response,
        isDb ? 'database-backup.sql.gz' : 'uploads-backup.tar.gz'
      );
      setNotice(`Скачан файл: ${filename}`);
      await loadBackups();
    } catch (e) {
      setError(e?.message || 'Ошибка создания резервной копии');
    } finally {
      setBusy(false);
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
        throw new Error(err.detail || 'Не удалось удалить');
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
    <section className="bg-white rounded-xl border border-gray-200 shadow-sm p-6 mt-6">
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 mb-4">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">Резервные копии</h2>
          <p className="text-sm text-gray-600 mt-1">
            Еженедельное автоматическое сохранение БД и папки uploads в каталог на сервере.
            По кнопке создаётся свежая копия и сразу скачивается.
          </p>
        </div>
      </div>

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

      <div className="flex flex-col sm:flex-row gap-3 mb-6">
        <button
          type="button"
          disabled={busyDb}
          onClick={() => createAndDownload('database')}
          className="inline-flex items-center justify-center px-4 py-2.5 rounded-lg bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-700 disabled:opacity-50"
        >
          {busyDb ? 'Создание копии БД…' : 'Скачать базу данных'}
        </button>
        <button
          type="button"
          disabled={busyUploads}
          onClick={() => createAndDownload('uploads')}
          className="inline-flex items-center justify-center px-4 py-2.5 rounded-lg bg-gray-800 text-white text-sm font-medium hover:bg-gray-900 disabled:opacity-50"
        >
          {busyUploads ? 'Архивирование uploads…' : 'Скачать uploads'}
        </button>
      </div>

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
