import React, { useEffect, useState } from 'react';
import { useDispatch } from 'react-redux';
import { Navigate } from 'react-router-dom';
import { useAuthReady } from '../../hooks/useAuthReady';
import AuthLoadingScreen from '../../components/AuthLoadingScreen/AuthLoadingScreen';
import { apiRequest } from '../../utils/apiClient';
import {
  fetchPublicSiteConfig,
  setShowNewAutoparts,
  setShowSiteReviews,
  setShowYandexBadge,
  setShowWarehouseInventory,
  setShowAutoservice,
  setNewPartsMarkupPercent,
  setRoundProductPrices,
  setUsedPartsPurchaseMode,
  patchPublicSiteConfigCache,
} from '../../redux/slices/PublicInfoSlice';
import { USED_PURCHASE_MODE_OPTIONS } from '../../utils/usedPurchaseMode';
import ServerStatsPanel from './ServerStatsPanel';
import OpenRouterSection from './OpenRouterSection';
import BackupSection from './BackupSection';
import AvitoPhotoLocalizationSection from './AvitoPhotoLocalizationSection';
import ProductPhotoThumbsSection from './ProductPhotoThumbsSection';
import ProductPhotoReprocessSection from './ProductPhotoReprocessSection';

function AdminPanelPage() {
  const dispatch = useDispatch();
  const { isReady, user, isAuthenticated } = useAuthReady();
  const [showNewAutoparts, setShowNewLocal] = useState(true);
  const [showSiteReviews, setShowSiteReviewsLocal] = useState(true);
  const [showYandexBadge, setShowYandexBadgeLocal] = useState(true);
  const [showWarehouseInventory, setShowWarehouseInventoryLocal] = useState(false);
  const [showAutoservice, setShowAutoserviceLocal] = useState(false);
  const [roundProductPrices, setRoundProductPricesLocal] = useState(false);
  const [usedPartsPurchaseMode, setUsedPartsPurchaseModeLocal] = useState('both');
  const [markupPercent, setMarkupPercent] = useState('15');
  const [loadingSettings, setLoadingSettings] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savingMarkup, setSavingMarkup] = useState(false);
  const [error, setError] = useState(null);
  const [notice, setNotice] = useState(null);
  const [markupDialogOpen, setMarkupDialogOpen] = useState(false);
  const [pendingMarkupValue, setPendingMarkupValue] = useState(null);
  const [internalCodeMigrationBusy, setInternalCodeMigrationBusy] = useState(false);
  const [internalCodeMigrationResult, setInternalCodeMigrationResult] = useState(null);
  const [internalCodeMigrationOrgId, setInternalCodeMigrationOrgId] = useState('');
  const [priceRoundingMigrationBusy, setPriceRoundingMigrationBusy] = useState(false);
  const [priceRoundingMigrationResult, setPriceRoundingMigrationResult] = useState(null);
  const [priceRoundingMigrationOrgId, setPriceRoundingMigrationOrgId] = useState('');

  const [siteQuickLinks, setSiteQuickLinks] = useState([]);
  const [siteQuickLinksLoading, setSiteQuickLinksLoading] = useState(true);
  const [siteQuickLinksSaving, setSiteQuickLinksSaving] = useState(false);
  const [newQuickLinkRow, setNewQuickLinkRow] = useState({
    title: '',
    url: '/catalog',
    sort_order: '100',
    enabled: true,
  });

  const loadSiteQuickLinks = async () => {
    const rows = await apiRequest('/admin/site-quick-links');
    setSiteQuickLinks(Array.isArray(rows) ? rows : []);
  };

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const data = await apiRequest('/admin/site-settings');
        if (!cancelled) {
          setShowNewLocal(data.show_new_autoparts !== false);
          setShowSiteReviewsLocal(data.show_site_reviews !== false);
          setShowYandexBadgeLocal(data.show_yandex_badge !== false);
          setShowWarehouseInventoryLocal(data.show_warehouse_inventory === true);
          setShowAutoserviceLocal(data.show_autoservice === true);
          setRoundProductPricesLocal(data.round_product_prices === true);
          const mode = data.used_parts_purchase_mode;
          setUsedPartsPurchaseModeLocal(
            mode === 'cart_only' || mode === 'cta_only' || mode === 'both' ? mode : 'both',
          );
          const m = Number(data.new_parts_markup_percent);
          setMarkupPercent(String(Number.isFinite(m) && m >= 0 ? m : 15));
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

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        await loadSiteQuickLinks();
      } catch (e) {
        if (!cancelled) {
          setError(e?.message || 'Не удалось загрузить быстрые ссылки');
        }
      } finally {
        if (!cancelled) setSiteQuickLinksLoading(false);
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
      patchPublicSiteConfigCache({ show_new_autoparts: checked });
      dispatch(fetchPublicSiteConfig(true));
    } catch (e) {
      setError(e?.message || 'Ошибка сохранения');
    } finally {
      setSaving(false);
    }
  };

  const handleToggleShowSiteReviews = async (checked) => {
    setSaving(true);
    setError(null);
    try {
      await apiRequest('/admin/site-settings', {
        method: 'PATCH',
        body: JSON.stringify({ show_site_reviews: checked }),
      });
      setShowSiteReviewsLocal(checked);
      dispatch(setShowSiteReviews(checked));
      patchPublicSiteConfigCache({ show_site_reviews: checked });
      dispatch(fetchPublicSiteConfig(true));
    } catch (e) {
      setError(e?.message || 'Ошибка сохранения');
    } finally {
      setSaving(false);
    }
  };

  const handleToggleShowYandexBadge = async (checked) => {
    setSaving(true);
    setError(null);
    try {
      await apiRequest('/admin/site-settings', {
        method: 'PATCH',
        body: JSON.stringify({ show_yandex_badge: checked }),
      });
      setShowYandexBadgeLocal(checked);
      dispatch(setShowYandexBadge(checked));
      patchPublicSiteConfigCache({ show_yandex_badge: checked });
      dispatch(fetchPublicSiteConfig(true));
    } catch (e) {
      setError(e?.message || 'Ошибка сохранения');
    } finally {
      setSaving(false);
    }
  };

  const handleToggleShowWarehouseInventory = async (checked) => {
    setSaving(true);
    setError(null);
    try {
      await apiRequest('/admin/site-settings', {
        method: 'PATCH',
        body: JSON.stringify({ show_warehouse_inventory: checked }),
      });
      setShowWarehouseInventoryLocal(checked);
      dispatch(setShowWarehouseInventory(checked));
      patchPublicSiteConfigCache({ show_warehouse_inventory: checked });
      dispatch(fetchPublicSiteConfig(true));
    } catch (e) {
      setError(e?.message || 'Ошибка сохранения');
    } finally {
      setSaving(false);
    }
  };

  const handleToggleShowAutoservice = async (checked) => {
    setSaving(true);
    setError(null);
    try {
      await apiRequest('/admin/site-settings', {
        method: 'PATCH',
        body: JSON.stringify({ show_autoservice: checked }),
      });
      setShowAutoserviceLocal(checked);
      dispatch(setShowAutoservice(checked));
      patchPublicSiteConfigCache({ show_autoservice: checked });
      dispatch(fetchPublicSiteConfig(true));
    } catch (e) {
      setError(e?.message || 'Ошибка сохранения');
    } finally {
      setSaving(false);
    }
  };

  const handleToggleRoundProductPrices = async (checked) => {
    setSaving(true);
    setError(null);
    try {
      await apiRequest('/admin/site-settings', {
        method: 'PATCH',
        body: JSON.stringify({ round_product_prices: checked }),
      });
      setRoundProductPricesLocal(checked);
      dispatch(setRoundProductPrices(checked));
      patchPublicSiteConfigCache({ round_product_prices: checked });
      dispatch(fetchPublicSiteConfig(true));
    } catch (e) {
      setError(e?.message || 'Ошибка сохранения');
    } finally {
      setSaving(false);
    }
  };

  const handleChangePurchaseMode = async (value) => {
    if (value === usedPartsPurchaseMode) return;
    setSaving(true);
    setError(null);
    try {
      await apiRequest('/admin/site-settings', {
        method: 'PATCH',
        body: JSON.stringify({ used_parts_purchase_mode: value }),
      });
      setUsedPartsPurchaseModeLocal(value);
      dispatch(setUsedPartsPurchaseMode(value));
      patchPublicSiteConfigCache({ used_parts_purchase_mode: value });
      dispatch(fetchPublicSiteConfig(true));
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
      dispatch(fetchPublicSiteConfig(true));
    } catch (e) {
      setError(e?.message || 'Ошибка сохранения наценки');
    } finally {
      setSavingMarkup(false);
      setPendingMarkupValue(null);
    }
  };

  const runPriceRoundingMigration = async ({ dryRun }) => {
    if (!dryRun) {
      const ok = window.confirm(
        'Округлить цены всех товаров до целых рублей (убрать копейки)? Изменения сохраняются в базе.'
      );
      if (!ok) return;
    }
    setPriceRoundingMigrationBusy(true);
    setError(null);
    try {
      const payload = { dry_run: dryRun };
      const trimmedOrgId = priceRoundingMigrationOrgId.trim();
      if (trimmedOrgId) payload.org_id = trimmedOrgId;

      const res = await apiRequest('/admin/products/round-prices', {
        method: 'POST',
        body: JSON.stringify(payload),
      });
      setPriceRoundingMigrationResult(res);
    } catch (e) {
      setError(e?.message || 'Не удалось запустить округление цен');
    } finally {
      setPriceRoundingMigrationBusy(false);
    }
  };

  const runInternalCodeMigration = async ({ dryRun }) => {
    if (!dryRun) {
      const ok = window.confirm(
        'Пересчитать внутренние коды товаров в формат XXXX-AAAAA? Для организаций с Avito после миграции нужно перезалить autoload xlsx.'
      );
      if (!ok) return;
    }
    setInternalCodeMigrationBusy(true);
    setError(null);
    try {
      const payload = { dry_run: dryRun };
      const trimmedOrgId = internalCodeMigrationOrgId.trim();
      if (trimmedOrgId) payload.org_id = trimmedOrgId;

      const res = await apiRequest('/admin/products/migrate-internal-codes', {
        method: 'POST',
        body: JSON.stringify(payload),
      });
      setInternalCodeMigrationResult(res);
    } catch (e) {
      setError(e?.message || 'Не удалось запустить миграцию внутренних кодов');
    } finally {
      setInternalCodeMigrationBusy(false);
    }
  };

  const toggleSiteQuickLink = async (row) => {
    setSiteQuickLinksSaving(true);
    setError(null);
    try {
      await apiRequest(`/admin/site-quick-links/${row.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ enabled: !row.enabled }),
      });
      await loadSiteQuickLinks();
    } catch (e) {
      setError(e?.message || 'Ошибка обновления быстрой ссылки');
    } finally {
      setSiteQuickLinksSaving(false);
    }
  };

  const createSiteQuickLink = async () => {
    setSiteQuickLinksSaving(true);
    setError(null);
    try {
      await apiRequest('/admin/site-quick-links', {
        method: 'POST',
        body: JSON.stringify({
          title: newQuickLinkRow.title.trim(),
          url: newQuickLinkRow.url.trim(),
          sort_order: Number(newQuickLinkRow.sort_order || 0),
          enabled: Boolean(newQuickLinkRow.enabled),
        }),
      });
      await loadSiteQuickLinks();
      setNewQuickLinkRow({ title: '', url: '/catalog', sort_order: '100', enabled: true });
      setNotice('Быстрая ссылка добавлена');
    } catch (e) {
      setError(e?.message || 'Ошибка добавления быстрой ссылки');
    } finally {
      setSiteQuickLinksSaving(false);
    }
  };

  const deleteSiteQuickLink = async (row) => {
    if (!window.confirm(`Удалить быструю ссылку «${row.title}»?`)) return;
    setSiteQuickLinksSaving(true);
    setError(null);
    try {
      await apiRequest(`/admin/site-quick-links/${row.id}`, { method: 'DELETE' });
      await loadSiteQuickLinks();
    } catch (e) {
      setError(e?.message || 'Ошибка удаления быстрой ссылки');
    } finally {
      setSiteQuickLinksSaving(false);
    }
  };

  return (
    <div className="max-w-4xl">
      <h1 className="text-2xl font-bold text-gray-900 mb-2">Настройки</h1>
      <p className="text-gray-600 mb-6">Параметры сайта для администраторов</p>

      {error && (
        <div className="mb-4 rounded-lg bg-red-50 text-red-800 text-sm px-4 py-3 border border-red-100">
          {error}
        </div>
      )}

      {notice && (
        <div className="mb-4 rounded-lg bg-green-50 text-green-800 text-sm px-4 py-3 border border-green-100">
          {notice}
        </div>
      )}

      <ServerStatsPanel />

      <BackupSection />

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
        <label className="mt-6 flex items-start gap-3 cursor-pointer select-none border-t border-gray-100 pt-6">
          <input
            type="checkbox"
            className="mt-1 h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
            checked={showSiteReviews}
            disabled={loadingSettings || saving}
            onChange={(e) => handleToggleShowSiteReviews(e.target.checked)}
          />
          <span>
            <span className="font-medium text-gray-900 block">Отображать отзывы на сайте</span>
            <span className="text-sm text-gray-500 block mt-1">
              Если выключено, скрываются страница «Отзывы», блок на главной, ссылки в меню и форма отправки отзывов.
            </span>
          </span>
        </label>
        <label className="mt-6 flex items-start gap-3 cursor-pointer select-none border-t border-gray-100 pt-6">
          <input
            type="checkbox"
            className="mt-1 h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
            checked={showWarehouseInventory}
            disabled={loadingSettings || saving}
            onChange={(e) => handleToggleShowWarehouseInventory(e.target.checked)}
          />
          <span>
            <span className="font-medium text-gray-900 block">Инвентаризация склада</span>
            <span className="text-sm text-gray-500 block mt-1">
              Если включено, в меню «Склад» появится раздел «Инвентаризация» (/warehouse/inventory).
              Страница и API остаются доступны только при включённом переключателе.
            </span>
          </span>
        </label>
        <label className="mt-6 flex items-start gap-3 cursor-pointer select-none border-t border-gray-100 pt-6">
          <input
            type="checkbox"
            className="mt-1 h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
            checked={showAutoservice}
            disabled={loadingSettings || saving}
            onChange={(e) => handleToggleShowAutoservice(e.target.checked)}
          />
          <span>
            <span className="font-medium text-gray-900 block">Отображать автосервис на сайте</span>
            <span className="text-sm text-gray-500 block mt-1">
              Если включено, на сайте появляется публичная страница /autoservice, а сотрудникам
              организации автосервиса — пункт меню «Автосервис».
            </span>
          </span>
        </label>
        <label className="mt-6 flex items-start gap-3 cursor-pointer select-none border-t border-gray-100 pt-6">
          <input
            type="checkbox"
            className="mt-1 h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
            checked={roundProductPrices}
            disabled={loadingSettings || saving}
            onChange={(e) => handleToggleRoundProductPrices(e.target.checked)}
          />
          <span>
            <span className="font-medium text-gray-900 block">Цены товаров без копеек</span>
            <span className="text-sm text-gray-500 block mt-1">
              Если включено, на сайте и при сохранении товаров цены округляются до целых рублей.
              Для уже существующих товаров запустите миграцию ниже.
            </span>
          </span>
        </label>
        <fieldset className="mt-6 border-t border-gray-100 pt-6">
          <legend className="font-medium text-gray-900">Покупка б/у запчастей на сайте</legend>
          <p className="text-sm text-gray-500 mt-1 mb-3">
            Что видит покупатель на карточке б/у товара. На новые запчасти не влияет.
          </p>
          <div className="space-y-3">
            {USED_PURCHASE_MODE_OPTIONS.map((option) => (
              <label
                key={option.value}
                className="flex items-start gap-3 cursor-pointer select-none rounded-lg border border-gray-200 px-3 py-2.5 hover:bg-gray-50"
              >
                <input
                  type="radio"
                  name="used-parts-purchase-mode"
                  className="mt-1 h-4 w-4 border-gray-300 text-indigo-600 focus:ring-indigo-500"
                  checked={usedPartsPurchaseMode === option.value}
                  disabled={loadingSettings || saving}
                  onChange={() => handleChangePurchaseMode(option.value)}
                />
                <span>
                  <span className="font-medium text-gray-900 block">{option.label}</span>
                  <span className="text-sm text-gray-500 block mt-0.5">{option.description}</span>
                </span>
              </label>
            ))}
          </div>
        </fieldset>
        {loadingSettings && <p className="text-sm text-gray-500 mt-4">Загрузка…</p>}
        {saving && <p className="text-sm text-indigo-600 mt-4">Сохранение…</p>}
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
            <label htmlFor="new-parts-markup" className="block text-sm font-medium text-gray-700 mb-1">
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

      <OpenRouterSection />

      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6 mt-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-1">
          Быстрые ссылки (для сниппета Яндекса)
        </h2>
        <p className="text-sm text-gray-500 mb-4">
          Яндекс формирует быстрые ссылки автоматически из популярных разделов сайта.
          Здесь вы управляете блоком «Популярные разделы» на главной и навигацией.
          Проверка и правка сниппета — в Вебмастере → Представление в поиске → Быстрые ссылки.
        </p>

        {siteQuickLinksLoading ? (
          <p className="text-sm text-gray-500">Загрузка быстрых ссылок…</p>
        ) : (
          <div className="space-y-4">
            <div className="overflow-x-auto rounded-lg border border-gray-200">
              <table className="min-w-full text-sm">
                <thead className="bg-gray-50 text-left text-gray-500">
                  <tr>
                    <th className="px-3 py-2">Название</th>
                    <th className="px-3 py-2">URL</th>
                    <th className="px-3 py-2">Порядок</th>
                    <th className="px-3 py-2">Вкл.</th>
                    <th className="px-3 py-2">Действия</th>
                  </tr>
                </thead>
                <tbody>
                  {siteQuickLinks.map((row) => (
                    <tr key={row.id} className="border-t border-gray-100">
                      <td className="px-3 py-2">{row.title}</td>
                      <td className="px-3 py-2 font-mono text-xs">{row.url}</td>
                      <td className="px-3 py-2">{row.sort_order}</td>
                      <td className="px-3 py-2">
                        <button
                          type="button"
                          onClick={() => toggleSiteQuickLink(row)}
                          disabled={siteQuickLinksSaving}
                          className={`rounded px-2 py-1 text-xs ${row.enabled ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-600'}`}
                        >
                          {row.enabled ? 'вкл' : 'выкл'}
                        </button>
                      </td>
                      <td className="px-3 py-2">
                        <button
                          type="button"
                          onClick={() => deleteSiteQuickLink(row)}
                          disabled={siteQuickLinksSaving}
                          className="text-xs text-red-600 hover:underline disabled:opacity-50"
                        >
                          Удалить
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
              <input
                className="rounded-md border border-gray-300 px-3 py-2 text-sm"
                placeholder="Название"
                value={newQuickLinkRow.title}
                onChange={(e) => setNewQuickLinkRow((prev) => ({ ...prev, title: e.target.value }))}
              />
              <input
                className="rounded-md border border-gray-300 px-3 py-2 text-sm font-mono"
                placeholder="/catalog"
                value={newQuickLinkRow.url}
                onChange={(e) => setNewQuickLinkRow((prev) => ({ ...prev, url: e.target.value }))}
              />
              <input
                className="rounded-md border border-gray-300 px-3 py-2 text-sm"
                placeholder="sort_order"
                value={newQuickLinkRow.sort_order}
                onChange={(e) => setNewQuickLinkRow((prev) => ({ ...prev, sort_order: e.target.value }))}
              />
              <button
                type="button"
                onClick={createSiteQuickLink}
                disabled={siteQuickLinksSaving || !newQuickLinkRow.title.trim() || !newQuickLinkRow.url.trim()}
                className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
              >
                Добавить ссылку
              </button>
            </div>
          </div>
        )}
      </div>

      <ProductPhotoThumbsSection />
      <ProductPhotoReprocessSection />
      <AvitoPhotoLocalizationSection />

      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6 mt-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-1">Миграция внутренних кодов</h2>
        <p className="text-sm text-gray-500 mb-4">
          Приводит коды товаров и заявок к формату <span className="font-mono">XXXX-AAAAA</span>{' '}
          (префикс организации + 5 латинских букв). Уже валидные коды не меняются.
          После миграции для Avito перегенерируйте и загрузите autoload xlsx.
        </p>
        <div className="flex flex-wrap items-end gap-3">
          <div>
            <label htmlFor="internal-code-migration-org-id" className="block text-sm font-medium text-gray-700 mb-1">
              Организация (опционально)
            </label>
            <input
              id="internal-code-migration-org-id"
              type="text"
              placeholder="например qMHbBIoD51"
              className="block w-52 rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
              value={internalCodeMigrationOrgId}
              disabled={internalCodeMigrationBusy}
              onChange={(e) => setInternalCodeMigrationOrgId(e.target.value)}
            />
          </div>
          <button
            type="button"
            onClick={() => runInternalCodeMigration({ dryRun: true })}
            disabled={internalCodeMigrationBusy}
            className="inline-flex items-center rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50 disabled:opacity-50"
          >
            {internalCodeMigrationBusy ? 'Выполняется…' : 'Проверить'}
          </button>
          <button
            type="button"
            onClick={() => runInternalCodeMigration({ dryRun: false })}
            disabled={internalCodeMigrationBusy}
            className="inline-flex items-center rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-indigo-700 disabled:opacity-50"
          >
            {internalCodeMigrationBusy ? 'Выполняется…' : 'Пересчитать коды'}
          </button>
        </div>
        {internalCodeMigrationResult && (
          <div className="mt-4 rounded-lg border border-gray-200 bg-gray-50 p-4 text-sm text-gray-700 space-y-3">
            <p className="font-medium text-gray-900">
              Результат: {internalCodeMigrationResult.dry_run ? 'dry-run' : 'выполнение'}
            </p>
            <p>
              Проверено: <span className="font-semibold">{internalCodeMigrationResult.scanned}</span>, изменено:{' '}
              <span className="font-semibold">{internalCodeMigrationResult.migrated}</span>, пропущено:{' '}
              <span className="font-semibold">{internalCodeMigrationResult.skipped}</span>, ошибок:{' '}
              <span className="font-semibold">{internalCodeMigrationResult.failed}</span>
            </p>
            {Array.isArray(internalCodeMigrationResult.changes) && internalCodeMigrationResult.changes.length > 0 && (
              <div>
                <p className="font-medium text-gray-900 mb-1">Примеры изменений:</p>
                <ul className="space-y-1 max-h-44 overflow-auto pr-1 font-mono text-xs">
                  {internalCodeMigrationResult.changes.map((row) => (
                    <li key={`${row.entity_type}-${row.entity_id}`}>
                      {row.entity_type} #{row.entity_id}: {row.old_code} → {row.new_code}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {Array.isArray(internalCodeMigrationResult.failures) && internalCodeMigrationResult.failures.length > 0 && (
              <div>
                <p className="font-medium text-gray-900 mb-1">Ошибки:</p>
                <ul className="space-y-1 max-h-44 overflow-auto pr-1 text-xs text-red-700">
                  {internalCodeMigrationResult.failures.map((row) => (
                    <li key={`${row.entity_type}-${row.entity_id}-${row.reason}`}>
                      {row.entity_type} #{row.entity_id}: {row.reason}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
      </div>

      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6 mt-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-1">Округление цен существующих товаров</h2>
        <p className="text-sm text-gray-500 mb-4">
          Убирает копейки у уже добавленных товаров: цена сохраняется в базе как целое число рублей.
          Сначала нажмите «Проверить», затем «Округлить цены».
        </p>
        <div className="flex flex-wrap items-end gap-3">
          <div>
            <label htmlFor="price-rounding-migration-org-id" className="block text-sm font-medium text-gray-700 mb-1">
              Организация (опционально)
            </label>
            <input
              id="price-rounding-migration-org-id"
              type="text"
              placeholder="например qMHbBIoD51"
              className="block w-52 rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
              value={priceRoundingMigrationOrgId}
              disabled={priceRoundingMigrationBusy}
              onChange={(e) => setPriceRoundingMigrationOrgId(e.target.value)}
            />
          </div>
          <button
            type="button"
            onClick={() => runPriceRoundingMigration({ dryRun: true })}
            disabled={priceRoundingMigrationBusy}
            className="inline-flex items-center rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50 disabled:opacity-50"
          >
            {priceRoundingMigrationBusy ? 'Выполняется…' : 'Проверить'}
          </button>
          <button
            type="button"
            onClick={() => runPriceRoundingMigration({ dryRun: false })}
            disabled={priceRoundingMigrationBusy}
            className="inline-flex items-center rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-indigo-700 disabled:opacity-50"
          >
            {priceRoundingMigrationBusy ? 'Выполняется…' : 'Округлить цены'}
          </button>
        </div>
        {priceRoundingMigrationResult && (
          <div className="mt-4 rounded-lg border border-gray-200 bg-gray-50 p-4 text-sm text-gray-700 space-y-3">
            <p className="font-medium text-gray-900">
              Результат: {priceRoundingMigrationResult.dry_run ? 'dry-run' : 'выполнение'}
            </p>
            <p>
              Проверено: <span className="font-semibold">{priceRoundingMigrationResult.scanned}</span>, изменено:{' '}
              <span className="font-semibold">{priceRoundingMigrationResult.migrated}</span>, пропущено:{' '}
              <span className="font-semibold">{priceRoundingMigrationResult.skipped}</span>, ошибок:{' '}
              <span className="font-semibold">{priceRoundingMigrationResult.failed}</span>
            </p>
            {Array.isArray(priceRoundingMigrationResult.changes) && priceRoundingMigrationResult.changes.length > 0 && (
              <div>
                <p className="font-medium text-gray-900 mb-1">Примеры изменений:</p>
                <ul className="space-y-1 max-h-44 overflow-auto pr-1 font-mono text-xs">
                  {priceRoundingMigrationResult.changes.map((row) => (
                    <li key={row.product_id}>
                      #{row.product_id}: {row.old_price} → {row.new_price}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {Array.isArray(priceRoundingMigrationResult.failures) && priceRoundingMigrationResult.failures.length > 0 && (
              <div>
                <p className="font-medium text-gray-900 mb-1">Ошибки:</p>
                <ul className="space-y-1 max-h-44 overflow-auto pr-1 text-xs text-red-700">
                  {priceRoundingMigrationResult.failures.map((row) => (
                    <li key={`${row.product_id}-${row.reason}`}>
                      #{row.product_id}: {row.reason}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
      </div>

      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6 mt-6">
        <label className="flex items-start gap-3 cursor-pointer select-none">
          <input
            type="checkbox"
            className="mt-1 h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
            checked={showYandexBadge}
            disabled={loadingSettings || saving}
            onChange={(e) => handleToggleShowYandexBadge(e.target.checked)}
          />
          <span>
            <span className="font-medium text-gray-900 block">Значок Яндекс.Вебмастер в шапке</span>
            <span className="text-sm text-gray-500 block mt-1">
              Показывать счётчик Яндекса в верхней части шапки сайта (десктоп и мобильная версия).
            </span>
          </span>
        </label>
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
            <p className="text-sm text-gray-600 mb-6">Выберите, как обновить наценку у продавцов.</p>
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
