import React, { useEffect, useState } from 'react';
import { useDispatch } from 'react-redux';
import { Navigate } from 'react-router-dom';
import { useAuthReady } from '../../hooks/useAuthReady';
import AuthLoadingScreen from '../../components/AuthLoadingScreen/AuthLoadingScreen';
import { apiRequest } from '../../utils/apiClient';
import {
  fetchPublicSiteConfig,
  setShowNewAutoparts,
  setNewPartsMarkupPercent,
} from '../../redux/slices/PublicInfoSlice';

function AdminPanelPage() {
  const dispatch = useDispatch();
  const { isReady, user, isAuthenticated } = useAuthReady();
  const [showNewAutoparts, setShowNewLocal] = useState(true);
  const [markupPercent, setMarkupPercent] = useState('15');
  const [loadingSettings, setLoadingSettings] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savingMarkup, setSavingMarkup] = useState(false);
  const [error, setError] = useState(null);
  const [markupDialogOpen, setMarkupDialogOpen] = useState(false);
  const [pendingMarkupValue, setPendingMarkupValue] = useState(null);
  const [photoMigrationBusy, setPhotoMigrationBusy] = useState(false);
  const [photoMigrationResult, setPhotoMigrationResult] = useState(null);
  const [photoMigrationOrgId, setPhotoMigrationOrgId] = useState('');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const data = await apiRequest('/admin/site-settings');
        if (!cancelled) {
          setShowNewLocal(data.show_new_autoparts !== false);
          const m = Number(data.new_parts_markup_percent);
          setMarkupPercent(
            String(Number.isFinite(m) && m >= 0 ? m : 15)
          );
        }
      } catch (e) {
        if (!cancelled) {
          setError(e?.message || 'Не удалось загрузить настройки');
        }
      } finally {
        if (!cancelled) {
          setLoadingSettings(false);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (!isReady) {
    return <AuthLoadingScreen />;
  }

  if (!isAuthenticated) {
    return <Navigate to="/auth" replace />;
  }
  if (!user.is_admin) {
    return <Navigate to="/dashboard" replace />;
  }

  const handleToggleShowNew = async (checked) => {
    setSaving(true);
    setError(null);
    try {
      await apiRequest('/admin/site-settings', {
        method: 'PATCH',
        body: JSON.stringify({ show_new_autoparts: checked }),
      });
      setShowNewLocal(checked);
      dispatch(setShowNewAutoparts(checked));
      dispatch(fetchPublicSiteConfig());
    } catch (e) {
      setError(e?.message || 'Ошибка сохранения');
    } finally {
      setSaving(false);
    }
  };

  const requestSaveMarkup = () => {
    const n = parseFloat(String(markupPercent).replace(',', '.'));
    if (!Number.isFinite(n) || n < 0 || n > 500) {
      setError('Наценка: введите число от 0 до 500 %');
      return;
    }
    setPendingMarkupValue(n);
    setMarkupDialogOpen(true);
  };

  const applyGlobalMarkup = async (applyMode) => {
    if (pendingMarkupValue == null) return;
    setSavingMarkup(true);
    setError(null);
    setMarkupDialogOpen(false);
    try {
      await apiRequest('/admin/site-settings', {
        method: 'PATCH',
        body: JSON.stringify({
          new_parts_markup_percent: pendingMarkupValue,
          global_markup_apply_mode: applyMode,
        }),
      });
      dispatch(setNewPartsMarkupPercent(pendingMarkupValue));
      dispatch(fetchPublicSiteConfig());
    } catch (e) {
      setError(e?.message || 'Ошибка сохранения наценки');
    } finally {
      setSavingMarkup(false);
      setPendingMarkupValue(null);
    }
  };

  const runPhotoLocalization = async ({ dryRun }) => {
    if (!dryRun) {
      const ok = window.confirm(
        'Запустить подмену внешних ссылок фото на локальные /pictures? Операция может занять время.'
      );
      if (!ok) return;
    }
    setPhotoMigrationBusy(true);
    setError(null);
    try {
      const payload = {
        dry_run: dryRun,
        all_external: false,
      };
      const trimmedOrgId = photoMigrationOrgId.trim();
      if (trimmedOrgId) payload.org_id = trimmedOrgId;

      const res = await apiRequest('/admin/photos/localize-external', {
        method: 'POST',
        body: JSON.stringify(payload),
      });
      setPhotoMigrationResult(res);
    } catch (e) {
      setError(e?.message || 'Не удалось запустить локализацию фото');
    } finally {
      setPhotoMigrationBusy(false);
    }
  };

  return (
    <div className="max-w-3xl">
      <h1 className="text-2xl font-bold text-gray-900 mb-2">Настройки</h1>
      <p className="text-gray-600 mb-6">
        Параметры сайта для администраторов
      </p>

      {error && (
        <div className="mb-4 rounded-lg bg-red-50 text-red-800 text-sm px-4 py-3 border border-red-100">
          {error}
        </div>
      )}

      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
        <label className="flex items-start gap-3 cursor-pointer select-none">
          <input
            type="checkbox"
            className="mt-1 h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
            checked={showNewAutoparts}
            disabled={loadingSettings || saving}
            onChange={(e) => handleToggleShowNew(e.target.checked)}
          />
          <span>
            <span className="font-medium text-gray-900 block">Отображать новые запчасти</span>
            <span className="text-sm text-gray-500 block mt-1">
              Если включено, в каталоге есть вкладки «Новые» и «Б/У». Если выключено — только б/у.
            </span>
          </span>
        </label>
        {loadingSettings && (
          <p className="text-sm text-gray-500 mt-4">Загрузка…</p>
        )}
        {saving && (
          <p className="text-sm text-indigo-600 mt-4">Сохранение…</p>
        )}
      </div>

      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6 mt-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-1">
          Наценка на новые запчасти (глобальная)
        </h2>
        <p className="text-sm text-gray-500 mb-4">
          Процент к цене поставщика в каталоге «Новые запчасти». При сохранении можно применить ко всем продавцам или пропустить тех, у кого наценка задана вручную.
        </p>
        <div className="flex flex-wrap items-end gap-3">
          <div>
            <label
              htmlFor="new-parts-markup"
              className="block text-sm font-medium text-gray-700 mb-1"
            >
              Наценка, %
            </label>
            <input
              id="new-parts-markup"
              type="number"
              min={0}
              max={500}
              step="0.01"
              className="block w-36 rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
              value={markupPercent}
              disabled={loadingSettings || savingMarkup}
              onChange={(e) => setMarkupPercent(e.target.value)}
            />
          </div>
          <button
            type="button"
            onClick={requestSaveMarkup}
            disabled={loadingSettings || savingMarkup}
            className="inline-flex items-center rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-indigo-700 disabled:opacity-50"
          >
            {savingMarkup ? 'Сохранение…' : 'Сохранить'}
          </button>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6 mt-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-1">
          Локализация фото с Avito
        </h2>
        <p className="text-sm text-gray-500 mb-4">
          Переносит внешние Avito-ссылки фото в локальные файлы на сервере и обновляет URL в товарах.
        </p>
        <div className="flex flex-wrap items-end gap-3">
          <div>
            <label
              htmlFor="photo-migration-org-id"
              className="block text-sm font-medium text-gray-700 mb-1"
            >
              Организация (опционально)
            </label>
            <input
              id="photo-migration-org-id"
              type="text"
              placeholder="например qMHbBIoD51"
              className="block w-52 rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
              value={photoMigrationOrgId}
              disabled={photoMigrationBusy}
              onChange={(e) => setPhotoMigrationOrgId(e.target.value)}
            />
          </div>
          <button
            type="button"
            onClick={() => runPhotoLocalization({ dryRun: true })}
            disabled={photoMigrationBusy}
            className="inline-flex items-center rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50 disabled:opacity-50"
          >
            {photoMigrationBusy ? 'Выполняется…' : 'Проверить'}
          </button>
          <button
            type="button"
            onClick={() => runPhotoLocalization({ dryRun: false })}
            disabled={photoMigrationBusy}
            className="inline-flex items-center rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-indigo-700 disabled:opacity-50"
          >
            {photoMigrationBusy ? 'Выполняется…' : 'Подменить ссылки фото'}
          </button>
        </div>
        {photoMigrationResult && (
          <div className="mt-4 rounded-lg border border-gray-200 bg-gray-50 p-4 text-sm text-gray-700 space-y-2">
            <p className="font-medium text-gray-900">
              Результат: {photoMigrationResult.dry_run ? 'dry-run' : 'выполнение'}
            </p>
            <p>
              Найдено: <span className="font-semibold">{photoMigrationResult.matched}</span>,
              заменено: <span className="font-semibold">{photoMigrationResult.migrated}</span>,
              ошибок: <span className="font-semibold">{photoMigrationResult.failed}</span>
            </p>
            {Array.isArray(photoMigrationResult.failures) && photoMigrationResult.failures.length > 0 && (
              <div>
                <p className="font-medium text-gray-900 mb-1">Ошибки (первые записи):</p>
                <ul className="space-y-1 max-h-44 overflow-auto pr-1">
                  {photoMigrationResult.failures.map((row) => (
                    <li key={`${row.photo_id}-${row.reason}`} className="text-xs text-gray-600">
                      photo_id={row.photo_id}: {row.reason}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
      </div>

      {markupDialogOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-black/50"
            onClick={() => !savingMarkup && setMarkupDialogOpen(false)}
            aria-hidden
          />
          <div className="relative bg-white rounded-xl shadow-xl max-w-md w-full p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-2">
              Применить глобальную наценку {pendingMarkupValue}%
            </h3>
            <p className="text-sm text-gray-600 mb-6">
              Выберите, как обновить наценку у продавцов.
            </p>
            <div className="flex flex-col gap-3">
              <button
                type="button"
                disabled={savingMarkup}
                onClick={() => applyGlobalMarkup('all')}
                className="w-full px-4 py-3 text-left rounded-lg border border-gray-200 hover:bg-gray-50 disabled:opacity-50"
              >
                <span className="block font-medium text-gray-900">Для всех продавцов</span>
                <span className="block text-sm text-gray-500 mt-1">
                  Перезаписать наценку у всех, включая ручные настройки
                </span>
              </button>
              <button
                type="button"
                disabled={savingMarkup}
                onClick={() => applyGlobalMarkup('skip_manual')}
                className="w-full px-4 py-3 text-left rounded-lg border border-indigo-200 bg-indigo-50 hover:bg-indigo-100 disabled:opacity-50"
              >
                <span className="block font-medium text-gray-900">Пропустить с ручной наценкой</span>
                <span className="block text-sm text-gray-600 mt-1">
                  Обновить только тех, у кого наценка не задана вручную в рабочем столе продавца
                </span>
              </button>
              <button
                type="button"
                disabled={savingMarkup}
                onClick={() => {
                  setMarkupDialogOpen(false);
                  setPendingMarkupValue(null);
                }}
                className="w-full px-4 py-2 text-sm text-gray-600 hover:text-gray-800"
              >
                Отмена
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default AdminPanelPage;
