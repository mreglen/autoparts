import React, { useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { Navigate } from 'react-router-dom';
import { apiRequest } from '../../utils/apiClient';
import {
  fetchPublicSiteConfig,
  setShowNewAutoparts,
  setNewPartsMarkupPercent,
} from '../../redux/slices/PublicInfoSlice';

/**
 * Страница «Настройки» в разделе админа (только is_admin), маршрут /admin-settings.
 */
function AdminPanelPage() {
  const dispatch = useDispatch();
  const user = useSelector((state) => state.auth.user);
  const [showNewAutoparts, setShowNewLocal] = useState(true);
  const [markupPercent, setMarkupPercent] = useState('15');
  const [loadingSettings, setLoadingSettings] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savingMarkup, setSavingMarkup] = useState(false);
  const [error, setError] = useState(null);

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

  if (!user) {
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

  const handleSaveMarkup = async () => {
    const n = parseFloat(String(markupPercent).replace(',', '.'));
    if (!Number.isFinite(n) || n < 0 || n > 500) {
      setError('Наценка: введите число от 0 до 500 %');
      return;
    }
    setSavingMarkup(true);
    setError(null);
    try {
      await apiRequest('/admin/site-settings', {
        method: 'PATCH',
        body: JSON.stringify({ new_parts_markup_percent: n }),
      });
      dispatch(setNewPartsMarkupPercent(n));
      dispatch(fetchPublicSiteConfig());
    } catch (e) {
      setError(e?.message || 'Ошибка сохранения наценки');
    } finally {
      setSavingMarkup(false);
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
              Если включено, в каталоге есть вкладки «Новые» и «Б/У». Если выключено — только б/у, раздел новых недоступен,
              поиск ведёт сразу в б/у (аналоги по-прежнему подбираются через поставщика на сервере).
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
          Наценка на новые запчасти
        </h2>
        <p className="text-sm text-gray-500 mb-4">
          Процент к цене поставщика в каталоге «Новые запчасти» и при добавлении в корзину.
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
            onClick={handleSaveMarkup}
            disabled={loadingSettings || savingMarkup}
            className="inline-flex items-center rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-indigo-700 disabled:opacity-50"
          >
            {savingMarkup ? 'Сохранение…' : 'Сохранить'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default AdminPanelPage;
