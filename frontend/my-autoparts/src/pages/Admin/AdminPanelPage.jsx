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
import DeployUpdateSection from './DeployUpdateSection';
import OpenRouterSection from './OpenRouterSection';
import LaximoCatSection from './LaximoCatSection';
import BackupSection from './BackupSection';
import AvitoPhotoLocalizationSection from './AvitoPhotoLocalizationSection';
import ProductPhotoThumbsSection from './ProductPhotoThumbsSection';
import ProductPhotoReprocessSection from './ProductPhotoReprocessSection';

const ADMIN_TOC = [
  { id: 'admin-server', label: 'Сервер' },
  { id: 'admin-deploy', label: 'Обновление' },
  { id: 'admin-backups', label: 'Копии' },
  { id: 'admin-features', label: 'Сайт' },
  { id: 'admin-markup', label: 'Наценка' },
  { id: 'admin-openrouter', label: 'OpenRouter' },
  { id: 'admin-laximo', label: 'Laximo' },
  { id: 'admin-quick-links', label: 'Ссылки' },
  { id: 'admin-photo-thumbs', label: 'Превью' },
  { id: 'admin-photo-reprocess', label: 'Фото' },
  { id: 'admin-avito-photos', label: 'Avito' },
  { id: 'admin-codes', label: 'Коды' },
  { id: 'admin-prices', label: 'Цены' },
];

function scrollToAdminSection(id) {
  const el = document.getElementById(id);
  if (!el) return;
  el.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

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

  const toggleRowClass =
    'flex items-center gap-3 cursor-pointer select-none rounded-lg px-1 py-2.5 hover:bg-gray-50';

  return (
    <div className="max-w-4xl pb-10">
      <h1 className="text-2xl font-bold text-gray-900 mb-4">Настройки</h1>

      <nav
        aria-label="Содержание"
        className="sticky top-0 z-20 mb-6 rounded-xl border border-gray-200 bg-white/95 p-3 shadow-sm backdrop-blur"
      >
        <div className="flex flex-wrap gap-1.5">
          {ADMIN_TOC.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => scrollToAdminSection(item.id)}
              className="rounded-lg border border-gray-200 bg-white px-2.5 py-1.5 text-xs font-medium text-gray-700 transition-colors hover:border-indigo-300 hover:bg-indigo-50 hover:text-indigo-800"
            >
              {item.label}
            </button>
          ))}
        </div>
      </nav>

      {error && (
        <div className="mb-4 rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-800">
          {error}
        </div>
      )}

      {notice && (
        <div className="mb-4 rounded-xl border border-green-100 bg-green-50 px-4 py-3 text-sm text-green-800">
          {notice}
        </div>
      )}

      <div className="space-y-6">
        <section id="admin-server" className="scroll-mt-24">
          <ServerStatsPanel />
        </section>

        <section id="admin-deploy" className="scroll-mt-24">
          <DeployUpdateSection />
        </section>

        <section id="admin-backups" className="scroll-mt-24">
          <BackupSection />
        </section>

        <section
          id="admin-features"
          className="scroll-mt-24 rounded-xl border border-gray-200 bg-white p-5 shadow-sm sm:p-6"
        >
          <h2 className="mb-4 text-lg font-semibold text-gray-900">Сайт</h2>
          <div className="divide-y divide-gray-100">
            <label className={toggleRowClass}>
              <input
                type="checkbox"
                className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                checked={showNewAutoparts}
                disabled={loadingSettings || saving}
                onChange={(e) => handleToggleShowNew(e.target.checked)}
              />
              <span className="font-medium text-gray-900">Новые запчасти</span>
            </label>
            <label className={toggleRowClass}>
              <input
                type="checkbox"
                className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                checked={showSiteReviews}
                disabled={loadingSettings || saving}
                onChange={(e) => handleToggleShowSiteReviews(e.target.checked)}
              />
              <span className="font-medium text-gray-900">Отзывы</span>
            </label>
            <label className={toggleRowClass}>
              <input
                type="checkbox"
                className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                checked={showWarehouseInventory}
                disabled={loadingSettings || saving}
                onChange={(e) => handleToggleShowWarehouseInventory(e.target.checked)}
              />
              <span className="font-medium text-gray-900">Инвентаризация</span>
            </label>
            <label className={toggleRowClass}>
              <input
                type="checkbox"
                className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                checked={showAutoservice}
                disabled={loadingSettings || saving}
                onChange={(e) => handleToggleShowAutoservice(e.target.checked)}
              />
              <span className="font-medium text-gray-900">Автосервис</span>
            </label>
            <label className={toggleRowClass}>
              <input
                type="checkbox"
                className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                checked={roundProductPrices}
                disabled={loadingSettings || saving}
                onChange={(e) => handleToggleRoundProductPrices(e.target.checked)}
              />
              <span className="font-medium text-gray-900">Цены без копеек</span>
            </label>
            <label className={toggleRowClass}>
              <input
                type="checkbox"
                className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                checked={showYandexBadge}
                disabled={loadingSettings || saving}
                onChange={(e) => handleToggleShowYandexBadge(e.target.checked)}
              />
              <span className="font-medium text-gray-900">Значок Яндекса в шапке</span>
            </label>
          </div>

          <fieldset className="mt-5 border-t border-gray-100 pt-5">
            <legend className="mb-3 text-sm font-medium text-gray-900">Покупка б/у</legend>
            <div className="space-y-2">
              {USED_PURCHASE_MODE_OPTIONS.map((option) => (
                <label
                  key={option.value}
                  className="flex cursor-pointer select-none items-center gap-3 rounded-lg border border-gray-200 px-3 py-2.5 hover:bg-gray-50"
                >
                  <input
                    type="radio"
                    name="used-parts-purchase-mode"
                    className="h-4 w-4 border-gray-300 text-indigo-600 focus:ring-indigo-500"
                    checked={usedPartsPurchaseMode === option.value}
                    disabled={loadingSettings || saving}
                    onChange={() => handleChangePurchaseMode(option.value)}
                  />
                  <span className="font-medium text-gray-900">{option.label}</span>
                </label>
              ))}
            </div>
          </fieldset>
          {(loadingSettings || saving) && (
            <p className="mt-3 text-sm text-gray-500">{saving ? 'Сохранение…' : 'Загрузка…'}</p>
          )}
        </section>

        <section
          id="admin-markup"
          className="scroll-mt-24 rounded-xl border border-gray-200 bg-white p-5 shadow-sm sm:p-6"
        >
          <h2 className="mb-4 text-lg font-semibold text-gray-900">Наценка на новые</h2>
          <div className="flex flex-wrap items-end gap-3">
            <div>
              <label htmlFor="new-parts-markup" className="mb-1 block text-sm font-medium text-gray-700">
                %
              </label>
              <input
                id="new-parts-markup"
                type="number"
                min={0}
                max={500}
                step="0.01"
                className="block w-28 rounded-lg border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
                value={markupPercent}
                disabled={loadingSettings || savingMarkup}
                onChange={(e) => setMarkupPercent(e.target.value)}
              />
            </div>
            <button
              type="button"
              onClick={requestSaveMarkup}
              disabled={loadingSettings || savingMarkup}
              className="inline-flex items-center rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-indigo-700 disabled:opacity-50"
            >
              {savingMarkup ? 'Сохранение…' : 'Сохранить'}
            </button>
          </div>
        </section>

        <section id="admin-openrouter" className="scroll-mt-24 space-y-6">
          <OpenRouterSection />
        </section>

        <section id="admin-laximo" className="scroll-mt-24 space-y-6">
          <LaximoCatSection />
        </section>

        <section
          id="admin-quick-links"
          className="scroll-mt-24 rounded-xl border border-gray-200 bg-white p-5 shadow-sm sm:p-6"
        >
          <h2 className="mb-4 text-lg font-semibold text-gray-900">Быстрые ссылки</h2>
          {siteQuickLinksLoading ? (
            <p className="text-sm text-gray-500">Загрузка…</p>
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
                      <th className="px-3 py-2" />
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
                            className={`rounded-md px-2 py-1 text-xs ${row.enabled ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-600'}`}
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

              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <input
                  className="rounded-lg border border-gray-300 px-3 py-2 text-sm"
                  placeholder="Название"
                  value={newQuickLinkRow.title}
                  onChange={(e) => setNewQuickLinkRow((prev) => ({ ...prev, title: e.target.value }))}
                />
                <input
                  className="rounded-lg border border-gray-300 px-3 py-2 font-mono text-sm"
                  placeholder="/catalog"
                  value={newQuickLinkRow.url}
                  onChange={(e) => setNewQuickLinkRow((prev) => ({ ...prev, url: e.target.value }))}
                />
                <input
                  className="rounded-lg border border-gray-300 px-3 py-2 text-sm"
                  placeholder="Порядок"
                  value={newQuickLinkRow.sort_order}
                  onChange={(e) => setNewQuickLinkRow((prev) => ({ ...prev, sort_order: e.target.value }))}
                />
                <button
                  type="button"
                  onClick={createSiteQuickLink}
                  disabled={siteQuickLinksSaving || !newQuickLinkRow.title.trim() || !newQuickLinkRow.url.trim()}
                  className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
                >
                  Добавить
                </button>
              </div>
            </div>
          )}
        </section>

        <section id="admin-photo-thumbs" className="scroll-mt-24">
          <ProductPhotoThumbsSection />
        </section>
        <section id="admin-photo-reprocess" className="scroll-mt-24">
          <ProductPhotoReprocessSection />
        </section>
        <section id="admin-avito-photos" className="scroll-mt-24">
          <AvitoPhotoLocalizationSection />
        </section>

        <section
          id="admin-codes"
          className="scroll-mt-24 rounded-xl border border-gray-200 bg-white p-5 shadow-sm sm:p-6"
        >
          <h2 className="mb-1 text-lg font-semibold text-gray-900">Внутренние коды</h2>
          <p className="mb-4 text-sm text-gray-500">Формат XXXX-AAAAA</p>
          <div className="flex flex-wrap items-end gap-3">
            <div>
              <label htmlFor="internal-code-migration-org-id" className="mb-1 block text-sm font-medium text-gray-700">
                Организация
              </label>
              <input
                id="internal-code-migration-org-id"
                type="text"
                placeholder="опционально"
                className="block w-52 rounded-lg border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
                value={internalCodeMigrationOrgId}
                disabled={internalCodeMigrationBusy}
                onChange={(e) => setInternalCodeMigrationOrgId(e.target.value)}
              />
            </div>
            <button
              type="button"
              onClick={() => runInternalCodeMigration({ dryRun: true })}
              disabled={internalCodeMigrationBusy}
              className="inline-flex items-center rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50 disabled:opacity-50"
            >
              {internalCodeMigrationBusy ? '…' : 'Проверить'}
            </button>
            <button
              type="button"
              onClick={() => runInternalCodeMigration({ dryRun: false })}
              disabled={internalCodeMigrationBusy}
              className="inline-flex items-center rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-indigo-700 disabled:opacity-50"
            >
              {internalCodeMigrationBusy ? '…' : 'Пересчитать'}
            </button>
          </div>
          {internalCodeMigrationResult && (
            <div className="mt-4 space-y-3 rounded-lg border border-gray-200 bg-gray-50 p-4 text-sm text-gray-700">
              <p className="font-medium text-gray-900">
                {internalCodeMigrationResult.dry_run ? 'Проверка' : 'Выполнено'}
              </p>
              <p>
                Проверено: <span className="font-semibold">{internalCodeMigrationResult.scanned}</span>
                , изменено: <span className="font-semibold">{internalCodeMigrationResult.migrated}</span>
                , пропущено: <span className="font-semibold">{internalCodeMigrationResult.skipped}</span>
                , ошибок: <span className="font-semibold">{internalCodeMigrationResult.failed}</span>
              </p>
              {Array.isArray(internalCodeMigrationResult.changes) && internalCodeMigrationResult.changes.length > 0 && (
                <ul className="max-h-44 space-y-1 overflow-auto pr-1 font-mono text-xs">
                  {internalCodeMigrationResult.changes.map((row) => (
                    <li key={`${row.entity_type}-${row.entity_id}`}>
                      {row.entity_type} #{row.entity_id}: {row.old_code} → {row.new_code}
                    </li>
                  ))}
                </ul>
              )}
              {Array.isArray(internalCodeMigrationResult.failures) && internalCodeMigrationResult.failures.length > 0 && (
                <ul className="max-h-44 space-y-1 overflow-auto pr-1 text-xs text-red-700">
                  {internalCodeMigrationResult.failures.map((row) => (
                    <li key={`${row.entity_type}-${row.entity_id}-${row.reason}`}>
                      {row.entity_type} #{row.entity_id}: {row.reason}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </section>

        <section
          id="admin-prices"
          className="scroll-mt-24 rounded-xl border border-gray-200 bg-white p-5 shadow-sm sm:p-6"
        >
          <h2 className="mb-1 text-lg font-semibold text-gray-900">Округление цен</h2>
          <p className="mb-4 text-sm text-gray-500">У существующих товаров в БД</p>
          <div className="flex flex-wrap items-end gap-3">
            <div>
              <label htmlFor="price-rounding-migration-org-id" className="mb-1 block text-sm font-medium text-gray-700">
                Организация
              </label>
              <input
                id="price-rounding-migration-org-id"
                type="text"
                placeholder="опционально"
                className="block w-52 rounded-lg border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
                value={priceRoundingMigrationOrgId}
                disabled={priceRoundingMigrationBusy}
                onChange={(e) => setPriceRoundingMigrationOrgId(e.target.value)}
              />
            </div>
            <button
              type="button"
              onClick={() => runPriceRoundingMigration({ dryRun: true })}
              disabled={priceRoundingMigrationBusy}
              className="inline-flex items-center rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50 disabled:opacity-50"
            >
              {priceRoundingMigrationBusy ? '…' : 'Проверить'}
            </button>
            <button
              type="button"
              onClick={() => runPriceRoundingMigration({ dryRun: false })}
              disabled={priceRoundingMigrationBusy}
              className="inline-flex items-center rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-indigo-700 disabled:opacity-50"
            >
              {priceRoundingMigrationBusy ? '…' : 'Округлить'}
            </button>
          </div>
          {priceRoundingMigrationResult && (
            <div className="mt-4 space-y-3 rounded-lg border border-gray-200 bg-gray-50 p-4 text-sm text-gray-700">
              <p className="font-medium text-gray-900">
                {priceRoundingMigrationResult.dry_run ? 'Проверка' : 'Выполнено'}
              </p>
              <p>
                Проверено: <span className="font-semibold">{priceRoundingMigrationResult.scanned}</span>
                , изменено: <span className="font-semibold">{priceRoundingMigrationResult.migrated}</span>
                , пропущено: <span className="font-semibold">{priceRoundingMigrationResult.skipped}</span>
                , ошибок: <span className="font-semibold">{priceRoundingMigrationResult.failed}</span>
              </p>
              {Array.isArray(priceRoundingMigrationResult.changes) && priceRoundingMigrationResult.changes.length > 0 && (
                <ul className="max-h-44 space-y-1 overflow-auto pr-1 font-mono text-xs">
                  {priceRoundingMigrationResult.changes.map((row) => (
                    <li key={row.product_id}>
                      #{row.product_id}: {row.old_price} → {row.new_price}
                    </li>
                  ))}
                </ul>
              )}
              {Array.isArray(priceRoundingMigrationResult.failures) && priceRoundingMigrationResult.failures.length > 0 && (
                <ul className="max-h-44 space-y-1 overflow-auto pr-1 text-xs text-red-700">
                  {priceRoundingMigrationResult.failures.map((row) => (
                    <li key={`${row.product_id}-${row.reason}`}>
                      #{row.product_id}: {row.reason}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </section>
      </div>

      {markupDialogOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-black/50"
            onClick={() => !savingMarkup && setMarkupDialogOpen(false)}
            aria-hidden
          />
          <div className="relative w-full max-w-md rounded-xl bg-white p-6 shadow-xl">
            <h3 className="mb-1 text-lg font-semibold text-gray-900">
              Наценка {pendingMarkupValue}%
            </h3>
            <p className="mb-5 text-sm text-gray-500">Как применить у продавцов?</p>
            <div className="flex flex-col gap-2">
              <button
                type="button"
                disabled={savingMarkup}
                onClick={() => applyGlobalMarkup('all')}
                className="w-full rounded-lg border border-gray-200 px-4 py-3 text-left hover:bg-gray-50 disabled:opacity-50"
              >
                <span className="block font-medium text-gray-900">Всем</span>
                <span className="mt-0.5 block text-sm text-gray-500">В том числе с ручной наценкой</span>
              </button>
              <button
                type="button"
                disabled={savingMarkup}
                onClick={() => applyGlobalMarkup('skip_manual')}
                className="w-full rounded-lg border border-indigo-200 bg-indigo-50 px-4 py-3 text-left hover:bg-indigo-100 disabled:opacity-50"
              >
                <span className="block font-medium text-gray-900">Без ручных</span>
                <span className="mt-0.5 block text-sm text-gray-600">Пропустить продавцов с ручной наценкой</span>
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
