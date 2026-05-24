import React, { useEffect, useMemo, useState } from 'react';
import { useDispatch } from 'react-redux';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuthReady } from '../../hooks/useAuthReady';
import AuthLoadingScreen from '../../components/AuthLoadingScreen/AuthLoadingScreen';
import { API_BASE, apiRequest } from '../../utils/apiClient';
import {
  fetchPublicSiteConfig,
  setShowNewAutoparts,
  setShowSiteReviews,
  setNewPartsMarkupPercent,
} from '../../redux/slices/PublicInfoSlice';

function AdminPanelPage() {
  const dispatch = useDispatch();
  const { isReady, user, isAuthenticated } = useAuthReady();
  const [showNewAutoparts, setShowNewLocal] = useState(true);
  const [showSiteReviews, setShowSiteReviewsLocal] = useState(true);
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
  const location = useLocation();

  const [yandexLoading, setYandexLoading] = useState(true);
  const [yandexSaving, setYandexSaving] = useState(false);
  const [yandexSyncBusy, setYandexSyncBusy] = useState(false);
  const [yandexHeadCheckBusy, setYandexHeadCheckBusy] = useState(false);
  const [yandexEnsureHostBusy, setYandexEnsureHostBusy] = useState(false);
  const [yandexNotice, setYandexNotice] = useState(null);
  const [yandexHostResult, setYandexHostResult] = useState(null);
  const [yandexHeadCheckResult, setYandexHeadCheckResult] = useState(null);
  const [yandexPreview, setYandexPreview] = useState(null);
  const [yandexFeedsList, setYandexFeedsList] = useState(null);
  const [yandexIntegration, setYandexIntegration] = useState(null);
  const [yandexSyncStatus, setYandexSyncStatus] = useState(null);
  const [yandexClientId, setYandexClientId] = useState('');
  const [yandexClientSecret, setYandexClientSecret] = useState('');
  const [hostUrl, setHostUrl] = useState('https://svoygarage.ru');
  const [feedType, setFeedType] = useState('GOODS');
  const [regionIdsCsv, setRegionIdsCsv] = useState('225');
  const [usedConditionType, setUsedConditionType] = useState('preowned');
  const [usedConditionReason, setUsedConditionReason] = useState('Товар бывший в употреблении, проверен продавцом');
  const [eventDrivenEnabled, setEventDrivenEnabled] = useState(true);
  const [debounceSeconds, setDebounceSeconds] = useState('300');
  const [controlSyncIntervalMinutes, setControlSyncIntervalMinutes] = useState('720');
  const [yandexEnabled, setYandexEnabled] = useState(true);
  const [yandexAccessToken, setYandexAccessToken] = useState('');
  const [yandexStatusBusy, setYandexStatusBusy] = useState(false);
  const [yandexEnableBusy, setYandexEnableBusy] = useState(false);
  const [yandexWebmasterStatus, setYandexWebmasterStatus] = useState(null);
  const [yandexEnableResult, setYandexEnableResult] = useState(null);

  const [siteDeliveryOptions, setSiteDeliveryOptions] = useState([]);
  const [siteDeliveryLoading, setSiteDeliveryLoading] = useState(true);
  const [siteDeliverySaving, setSiteDeliverySaving] = useState(false);
  const [siteQuickLinks, setSiteQuickLinks] = useState([]);
  const [siteQuickLinksLoading, setSiteQuickLinksLoading] = useState(true);
  const [siteQuickLinksSaving, setSiteQuickLinksSaving] = useState(false);
  const [newQuickLinkRow, setNewQuickLinkRow] = useState({
    title: '',
    url: '/catalog',
    sort_order: '100',
    enabled: true,
  });
  const [newDeliveryRow, setNewDeliveryRow] = useState({
    region_id: '11162',
    region_name: 'Урал',
    delivery_type: 'courier',
    carrier: 'СДЭК',
    pickup_point: '',
    min_order_amount: '1000',
    sort_order: '100',
    enabled: true,
  });

  const yandexConnected = Boolean(yandexIntegration?.connected);
  const callbackParams = useMemo(() => new URLSearchParams(location.search), [location.search]);

  const hydrateYandexForm = (row) => {
    if (!row) return;
    setYandexClientId(row.client_id || '');
    setFeedType(row.feed_type || 'GOODS');
    setRegionIdsCsv(row.region_ids_csv || '225');
    setUsedConditionType(row.used_condition_type || 'preowned');
    setUsedConditionReason(
      row.used_condition_reason || 'Товар бывший в употреблении, проверен продавцом'
    );
    setEventDrivenEnabled(row.event_driven_enabled !== false);
    setDebounceSeconds(String(row.debounce_seconds ?? 300));
    setControlSyncIntervalMinutes(String(row.control_sync_interval_minutes ?? 720));
    setYandexEnabled(row.enabled !== false);
    setHostUrl(row.host_url || 'https://svoygarage.ru');
  };

  const loadSiteDelivery = async () => {
    const rows = await apiRequest('/admin/site-delivery');
    setSiteDeliveryOptions(Array.isArray(rows) ? rows : []);
  };

  const loadSiteQuickLinks = async () => {
    const rows = await apiRequest('/admin/site-quick-links');
    setSiteQuickLinks(Array.isArray(rows) ? rows : []);
  };

  const loadYandex = async () => {
    const [integration, status] = await Promise.all([
      apiRequest('/admin/yandex/integration'),
      apiRequest('/admin/yandex/feeds/sync-status'),
    ]);
    setYandexIntegration(integration);
    setYandexSyncStatus(status);
    hydrateYandexForm(integration);
  };

  const loadYandexDiagnostics = async () => {
    try {
      const [preview, headCheck] = await Promise.all([
        apiRequest('/admin/yandex/feeds/public-preview'),
        apiRequest('/admin/yandex/feeds/public-head-check'),
      ]);
      setYandexPreview(preview);
      setYandexHeadCheckResult(headCheck);
    } catch {
      // optional diagnostics, errors shown via explicit actions
    }
  };

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [data] = await Promise.all([
          apiRequest('/admin/site-settings'),
        ]);
        if (!cancelled) {
          setShowNewLocal(data.show_new_autoparts !== false);
          setShowSiteReviewsLocal(data.show_site_reviews !== false);
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

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        await loadYandex();
        await loadYandexDiagnostics();
        await loadSiteDelivery();
        await loadSiteQuickLinks();
      } catch (e) {
        if (!cancelled) {
          setError(e?.message || 'Не удалось загрузить настройки Яндекс');
        }
      } finally {
        if (!cancelled) setYandexLoading(false);
        if (!cancelled) setSiteDeliveryLoading(false);
        if (!cancelled) setSiteQuickLinksLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const connected = callbackParams.get('yandex_connected');
    const err = callbackParams.get('yandex_error');
    if (connected) {
      setYandexNotice('OAuth Яндекса подключен');
      loadYandex().catch(() => {});
    } else if (err) {
      setError(`Ошибка OAuth Яндекс: ${err}`);
    }
  }, [callbackParams]);

  useEffect(() => {
    if (yandexLoading) return undefined;
    const timer = setInterval(() => {
      loadYandex().catch(() => {});
    }, 8000);
    return () => clearInterval(timer);
  }, [yandexLoading]);

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

  const saveYandexCredentials = async () => {
    setYandexSaving(true);
    setError(null);
    setYandexNotice(null);
    try {
      const payload = { client_id: yandexClientId.trim() };
      if (yandexClientSecret.trim()) {
        payload.client_secret = yandexClientSecret.trim();
      }
      const res = await apiRequest('/admin/yandex/credentials', {
        method: 'PATCH',
        body: JSON.stringify(payload),
      });
      setYandexIntegration(res);
      hydrateYandexForm(res);
      setYandexClientSecret('');
      setYandexNotice('Client ID/Secret сохранены');
    } catch (e) {
      setError(e?.message || 'Ошибка сохранения OAuth настроек Яндекс');
    } finally {
      setYandexSaving(false);
    }
  };

  const startYandexOAuth = () => {
    const redirectTo = '/admin-settings';
    const href = `${API_BASE}/admin/yandex/oauth/start?redirect_to=${encodeURIComponent(redirectTo)}`;
    window.location.href = href;
  };

  const disconnectYandexOAuth = async () => {
    setYandexSaving(true);
    setError(null);
    try {
      const res = await apiRequest('/admin/yandex/oauth/disconnect', { method: 'POST' });
      setYandexIntegration(res);
      hydrateYandexForm(res);
      setYandexNotice('OAuth Яндекса отключен');
    } catch (e) {
      setError(e?.message || 'Ошибка отключения OAuth Яндекс');
    } finally {
      setYandexSaving(false);
    }
  };

  const saveYandexFeedSettings = async () => {
    const debounce = Number(debounceSeconds);
    const control = Number(controlSyncIntervalMinutes);
    if (!Number.isFinite(debounce) || debounce < 30 || debounce > 3600) {
      setError('Debounce: введите число от 30 до 3600 секунд');
      return;
    }
    if (!Number.isFinite(control) || control < 30 || control > 10080) {
      setError('Контрольный интервал: введите число от 30 до 10080 минут');
      return;
    }
    setYandexSaving(true);
    setError(null);
    setYandexNotice(null);
    try {
      const res = await apiRequest('/admin/yandex/feed-settings', {
        method: 'PATCH',
        body: JSON.stringify({
          feed_type: feedType,
          region_ids_csv: regionIdsCsv,
          used_condition_type: usedConditionType,
          used_condition_reason: usedConditionReason,
          event_driven_enabled: eventDrivenEnabled,
          debounce_seconds: debounce,
          control_sync_interval_minutes: control,
          enabled: yandexEnabled,
        }),
      });
      setYandexIntegration(res);
      hydrateYandexForm(res);
      setYandexNotice('Настройки фида сохранены');
      await loadYandexDiagnostics();
    } catch (e) {
      setError(e?.message || 'Ошибка сохранения настроек фида Яндекс');
    } finally {
      setYandexSaving(false);
    }
  };

  const ensureYandexHost = async () => {
    setYandexEnsureHostBusy(true);
    setError(null);
    setYandexNotice(null);
    setYandexHostResult(null);
    try {
      const res = await apiRequest('/admin/yandex/host/ensure', {
        method: 'POST',
        body: JSON.stringify({ host_url: hostUrl.trim() || 'https://svoygarage.ru' }),
      });
      setYandexHostResult(res);
      if (res.ok) {
        setYandexNotice(res.note || 'Сайт синхронизирован с Яндекс Вебмастером');
      } else {
        setError(res.message || 'Не удалось подтвердить сайт');
      }
      await loadYandex();
      await loadYandexDiagnostics();
    } catch (e) {
      setError(e?.message || 'Ошибка проверки сайта в Яндекс Вебмастере');
    } finally {
      setYandexEnsureHostBusy(false);
    }
  };

  const runYandexSync = async (force = false) => {
    setYandexSyncBusy(true);
    setError(null);
    setYandexNotice(null);
    try {
      await apiRequest(`/admin/yandex/feeds/sync?force=${force ? 'true' : 'false'}`, {
        method: 'POST',
      });
      setYandexNotice('Асинхронная загрузка фида запущена');
      await loadYandex();
    } catch (e) {
      setError(e?.message || 'Ошибка запуска асинхронной загрузки фида');
    } finally {
      setYandexSyncBusy(false);
    }
  };

  const checkYandexFeedHead = async () => {
    setYandexHeadCheckBusy(true);
    setError(null);
    try {
      const res = await apiRequest('/admin/yandex/feeds/public-head-check');
      setYandexHeadCheckResult(res);
      const preview = await apiRequest('/admin/yandex/feeds/public-preview');
      setYandexPreview(preview);
    } catch (e) {
      setError(e?.message || 'Ошибка проверки публичного feed URL');
    } finally {
      setYandexHeadCheckBusy(false);
    }
  };

  const loadUploadedYandexFeeds = async () => {
    setError(null);
    try {
      const res = await apiRequest('/admin/yandex/feeds/list');
      setYandexFeedsList(res);
    } catch (e) {
      setError(e?.message || 'Ошибка получения списка фидов из Яндекс Вебмастера');
    }
  };

  const saveYandexManualToken = async () => {
    const token = yandexAccessToken.trim();
    if (!token) {
      setError('Введите OAuth access token');
      return;
    }
    setYandexSaving(true);
    setError(null);
    setYandexNotice(null);
    try {
      const res = await apiRequest('/admin/yandex/oauth/token', {
        method: 'POST',
        body: JSON.stringify({ access_token: token }),
      });
      setYandexIntegration(res);
      hydrateYandexForm(res);
      setYandexAccessToken('');
      setYandexNotice('OAuth токен сохранен, user_id получен из API');
      await loadYandex();
    } catch (e) {
      setError(e?.message || 'Не удалось сохранить OAuth токен');
    } finally {
      setYandexSaving(false);
    }
  };

  const checkYandexWebmasterStatus = async () => {
    setYandexStatusBusy(true);
    setError(null);
    try {
      const res = await apiRequest('/admin/yandex/webmaster/status');
      setYandexWebmasterStatus(res);
      await loadYandex();
      if (res.feeds) {
        setYandexFeedsList(res);
      }
    } catch (e) {
      setError(e?.message || 'Ошибка проверки состояния API Яндекс Вебмастера');
    } finally {
      setYandexStatusBusy(false);
    }
  };

  const enableYandexIntegration = async () => {
    setYandexEnableBusy(true);
    setError(null);
    setYandexNotice(null);
    setYandexEnableResult(null);
    try {
      const res = await apiRequest('/admin/yandex/setup/enable', {
        method: 'POST',
        body: JSON.stringify({
          host_url: hostUrl.trim() || 'https://svoygarage.ru',
          trigger_sync: true,
        }),
      });
      setYandexEnableResult(res);
      setYandexIntegration(res.integration);
      hydrateYandexForm(res.integration);
      setYandexEnabled(true);
      if (res.ok) {
        setYandexNotice('Интеграция включена: сайт проверен, загрузка фида запущена');
      } else {
        setError(
          res.host?.note ||
            'Интеграция включена, но права на сайт не подтверждены. Подтвердите сайт в Вебмастере.'
        );
      }
      await loadYandex();
      await checkYandexWebmasterStatus();
    } catch (e) {
      setError(e?.message || 'Ошибка включения интеграции Яндекс');
    } finally {
      setYandexEnableBusy(false);
    }
  };

  const syncYandexRegionsFromDelivery = async () => {
    setSiteDeliverySaving(true);
    setError(null);
    setYandexNotice(null);
    try {
      const res = await apiRequest('/admin/site-delivery/sync-yandex-regions', { method: 'POST' });
      setYandexNotice(`regionIds синхронизированы: ${res.region_ids_csv}`);
      await loadYandex();
    } catch (e) {
      setError(e?.message || 'Ошибка синхронизации regionIds');
    } finally {
      setSiteDeliverySaving(false);
    }
  };

  const toggleSiteDeliveryOption = async (row) => {
    setSiteDeliverySaving(true);
    setError(null);
    try {
      await apiRequest(`/admin/site-delivery/${row.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ enabled: !row.enabled }),
      });
      await loadSiteDelivery();
    } catch (e) {
      setError(e?.message || 'Ошибка обновления способа доставки');
    } finally {
      setSiteDeliverySaving(false);
    }
  };

  const createSiteDeliveryOption = async () => {
    setSiteDeliverySaving(true);
    setError(null);
    try {
      await apiRequest('/admin/site-delivery', {
        method: 'POST',
        body: JSON.stringify({
          region_id: Number(newDeliveryRow.region_id),
          region_name: newDeliveryRow.region_name.trim(),
          delivery_type: newDeliveryRow.delivery_type,
          carrier: newDeliveryRow.carrier.trim() || null,
          pickup_point: newDeliveryRow.pickup_point.trim() || null,
          min_order_amount: Number(newDeliveryRow.min_order_amount || 0),
          sort_order: Number(newDeliveryRow.sort_order || 0),
          enabled: Boolean(newDeliveryRow.enabled),
        }),
      });
      await loadSiteDelivery();
      setYandexNotice('Способ доставки добавлен');
    } catch (e) {
      setError(e?.message || 'Ошибка добавления способа доставки');
    } finally {
      setSiteDeliverySaving(false);
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
      setYandexNotice('Быстрая ссылка добавлена');
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

  const yandexSetupSteps = [
    {
      id: 'oauth',
      label: 'OAuth подключен',
      done: yandexConnected,
    },
    {
      id: 'user',
      label: 'user_id получен',
      done: Boolean(yandexIntegration?.yandex_user_id || yandexWebmasterStatus?.user_id),
    },
    {
      id: 'host',
      label: 'Сайт добавлен в Вебмастер',
      done: Boolean(yandexIntegration?.host_id),
    },
    {
      id: 'verified',
      label: 'Права на сайт подтверждены',
      done: Boolean(
        yandexWebmasterStatus?.verified ||
          yandexHostResult?.verified ||
          yandexEnableResult?.host?.verified
      ),
    },
    {
      id: 'feed',
      label: 'Фид загружен в Яндекс',
      done: Boolean(
        yandexSyncStatus?.last_process_status === 'OK' ||
          (Array.isArray(yandexFeedsList?.feeds) &&
            yandexFeedsList.feeds.some((f) =>
              String(f.url || '').includes('/api/feeds/yandex/used.yml')
            ))
      ),
    },
  ];

  return (
    <div className="max-w-4xl">
      <h1 className="text-2xl font-bold text-gray-900 mb-2">Настройки</h1>
      <p className="text-gray-600 mb-6">
        Параметры сайта для администраторов
      </p>

      {error && (
        <div className="mb-4 rounded-lg bg-red-50 text-red-800 text-sm px-4 py-3 border border-red-100">
          {error}
        </div>
      )}

      {yandexNotice && (
        <div className="mb-4 rounded-lg bg-green-50 text-green-800 text-sm px-4 py-3 border border-green-100">
          {yandexNotice}
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
          Яндекс Товары / Вебмастер
        </h2>
        <p className="text-sm text-gray-500 mb-4">
          OAuth, проверка сайта и асинхронная загрузка товарного YML-фида. Все шаги выполняются здесь, в `/admin-settings`.
        </p>

        {yandexLoading ? (
          <p className="text-sm text-gray-500">Загрузка настроек Яндекс…</p>
        ) : (
          <div className="space-y-6">
            <div className="rounded-lg border border-indigo-100 bg-indigo-50/40 p-4">
              <h3 className="font-medium text-gray-900 mb-3">Быстрое включение</h3>
              <ol className="space-y-2 mb-4">
                {yandexSetupSteps.map((step) => (
                  <li key={step.id} className="flex items-center gap-2 text-sm">
                    <span
                      className={`inline-flex h-5 w-5 items-center justify-center rounded-full text-xs font-semibold ${
                        step.done
                          ? 'bg-green-100 text-green-700'
                          : 'bg-gray-200 text-gray-600'
                      }`}
                    >
                      {step.done ? '✓' : '•'}
                    </span>
                    <span className={step.done ? 'text-gray-900' : 'text-gray-600'}>
                      {step.label}
                    </span>
                  </li>
                ))}
              </ol>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={enableYandexIntegration}
                  disabled={yandexEnableBusy || !yandexConnected}
                  className="inline-flex items-center rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
                >
                  {yandexEnableBusy ? 'Включение…' : 'Включить интеграцию'}
                </button>
                <button
                  type="button"
                  onClick={checkYandexWebmasterStatus}
                  disabled={yandexStatusBusy || !yandexConnected}
                  className="inline-flex items-center rounded-md border border-indigo-200 bg-white px-4 py-2 text-sm font-medium text-indigo-700 hover:bg-indigo-50 disabled:opacity-50"
                >
                  {yandexStatusBusy ? 'Проверка…' : 'Проверить состояние API'}
                </button>
              </div>
              {yandexWebmasterStatus && (
                <div className="mt-3 text-xs text-gray-600 space-y-1">
                  <p>user_id: {yandexWebmasterStatus.user_id || '—'}</p>
                  <p>verified: {String(Boolean(yandexWebmasterStatus.verified))}</p>
                  <p>ready_for_sync: {String(Boolean(yandexWebmasterStatus.ready_for_sync))}</p>
                  {yandexWebmasterStatus.verification?.verification_uin && (
                    <p>
                      meta verification code: {yandexWebmasterStatus.verification.verification_uin}
                    </p>
                  )}
                </div>
              )}
              {yandexEnableResult && (
                <pre className="mt-3 rounded-md bg-white p-3 text-xs text-gray-700 overflow-auto border border-indigo-100">
                  {JSON.stringify(yandexEnableResult, null, 2)}
                </pre>
              )}
            </div>

            <div className="rounded-lg border border-gray-200 p-4">
              <h3 className="font-medium text-gray-900 mb-3">OAuth приложение</h3>
              <div className="grid sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Client ID
                  </label>
                  <input
                    type="text"
                    value={yandexClientId}
                    onChange={(e) => setYandexClientId(e.target.value)}
                    className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                    placeholder="Введите Client ID"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Client secret
                  </label>
                  <input
                    type="password"
                    value={yandexClientSecret}
                    onChange={(e) => setYandexClientSecret(e.target.value)}
                    className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                    placeholder={
                      yandexIntegration?.client_secret_configured
                        ? 'Оставьте пустым, если не меняете'
                        : 'Введите Client secret'
                    }
                  />
                </div>
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={saveYandexCredentials}
                  disabled={yandexSaving}
                  className="inline-flex items-center rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
                >
                  {yandexSaving ? 'Сохранение…' : 'Сохранить OAuth данные'}
                </button>
                <button
                  type="button"
                  onClick={startYandexOAuth}
                  disabled={yandexSaving || !yandexClientId.trim()}
                  className="inline-flex items-center rounded-md border border-indigo-200 bg-indigo-50 px-4 py-2 text-sm font-medium text-indigo-700 hover:bg-indigo-100 disabled:opacity-50"
                >
                  Подключить Яндекс (OAuth code)
                </button>
                <button
                  type="button"
                  onClick={disconnectYandexOAuth}
                  disabled={yandexSaving || !yandexConnected}
                  className="inline-flex items-center rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                >
                  Отключить OAuth
                </button>
              </div>
              <div className="mt-3 text-xs text-gray-600 space-y-1">
                <p>Статус OAuth: {yandexConnected ? 'подключен' : 'не подключен'}</p>
                {yandexIntegration?.token_expires_at && (
                  <p>Токен истекает: {new Date(yandexIntegration.token_expires_at).toLocaleString()}</p>
                )}
                {yandexIntegration?.yandex_user_id && (
                  <p>Yandex user_id: {yandexIntegration.yandex_user_id}</p>
                )}
              </div>
              <div className="mt-4 border-t border-gray-100 pt-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  OAuth access token (ручной ввод)
                </label>
                <div className="grid sm:grid-cols-[1fr_auto] gap-3">
                  <input
                    type="password"
                    value={yandexAccessToken}
                    onChange={(e) => setYandexAccessToken(e.target.value)}
                    className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                    placeholder="y0__..."
                  />
                  <button
                    type="button"
                    onClick={saveYandexManualToken}
                    disabled={yandexSaving || !yandexAccessToken.trim()}
                    className="inline-flex items-center justify-center rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                  >
                    Сохранить токен
                  </button>
                </div>
                <p className="mt-2 text-xs text-gray-500">
                  Альтернатива OAuth code flow: токен проверяется через `GET /v4/user`, затем сохраняется в БД.
                </p>
              </div>
            </div>

            <div className="rounded-lg border border-gray-200 p-4">
              <h3 className="font-medium text-gray-900 mb-3">Сайт в Вебмастере</h3>
              <div className="grid sm:grid-cols-[1fr_auto] gap-3">
                <input
                  type="text"
                  value={hostUrl}
                  onChange={(e) => setHostUrl(e.target.value)}
                  className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                  placeholder="https://svoygarage.ru"
                />
                <button
                  type="button"
                  onClick={ensureYandexHost}
                  disabled={yandexEnsureHostBusy || !yandexConnected}
                  className="inline-flex items-center justify-center rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
                >
                  {yandexEnsureHostBusy ? 'Проверка…' : 'Auto-try добавить/проверить host'}
                </button>
              </div>
              <div className="mt-3 text-xs text-gray-600 space-y-1">
                <p>host_id: {yandexIntegration?.host_id || '—'}</p>
                <p>host_url: {yandexIntegration?.host_url || '—'}</p>
              </div>
              {yandexHostResult && (
                <pre className="mt-3 rounded-md bg-gray-50 p-3 text-xs text-gray-700 overflow-auto">
                  {JSON.stringify(yandexHostResult, null, 2)}
                </pre>
              )}
            </div>

            <div className="rounded-lg border border-gray-200 p-4">
              <h3 className="font-medium text-gray-900 mb-3">Настройки товарного фида (used-only)</h3>
              <div className="grid sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">feed_type</label>
                  <select
                    value={feedType}
                    onChange={(e) => setFeedType(e.target.value)}
                    className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                  >
                    {['GOODS', 'REALTY', 'VACANCY', 'DOCTORS', 'CARS', 'SERVICES', 'EDUCATION', 'ACTIVITY'].map((opt) => (
                      <option key={opt} value={opt}>
                        {opt}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    regionIds (csv)
                  </label>
                  <input
                    type="text"
                    value={regionIdsCsv}
                    onChange={(e) => setRegionIdsCsv(e.target.value)}
                    className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                    placeholder="225"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    condition.type
                  </label>
                  <input
                    type="text"
                    value={usedConditionType}
                    onChange={(e) => setUsedConditionType(e.target.value)}
                    className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                    placeholder="preowned"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    debounce (сек)
                  </label>
                  <input
                    type="number"
                    min={30}
                    max={3600}
                    value={debounceSeconds}
                    onChange={(e) => setDebounceSeconds(e.target.value)}
                    className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    condition.reason
                  </label>
                  <textarea
                    rows={2}
                    value={usedConditionReason}
                    onChange={(e) => setUsedConditionReason(e.target.value)}
                    className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Контрольный sync (мин)
                  </label>
                  <input
                    type="number"
                    min={30}
                    max={10080}
                    value={controlSyncIntervalMinutes}
                    onChange={(e) => setControlSyncIntervalMinutes(e.target.value)}
                    className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                  />
                </div>
                <div className="flex flex-col gap-2 justify-end pb-1">
                  <label className="inline-flex items-center gap-2 text-sm text-gray-700">
                    <input
                      type="checkbox"
                      checked={eventDrivenEnabled}
                      onChange={(e) => setEventDrivenEnabled(e.target.checked)}
                      className="h-4 w-4 rounded border-gray-300 text-indigo-600"
                    />
                    Event-driven sync
                  </label>
                  <label className="inline-flex items-center gap-2 text-sm text-gray-700">
                    <input
                      type="checkbox"
                      checked={yandexEnabled}
                      onChange={(e) => setYandexEnabled(e.target.checked)}
                      className="h-4 w-4 rounded border-gray-300 text-indigo-600"
                    />
                    Интеграция включена
                  </label>
                </div>
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={saveYandexFeedSettings}
                  disabled={yandexSaving}
                  className="inline-flex items-center rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
                >
                  {yandexSaving ? 'Сохранение…' : 'Сохранить настройки фида'}
                </button>
                <button
                  type="button"
                  onClick={checkYandexFeedHead}
                  disabled={yandexHeadCheckBusy}
                  className="inline-flex items-center rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                >
                  {yandexHeadCheckBusy ? 'Проверка…' : 'Проверить feed URL'}
                </button>
              </div>
              <div className="mt-3 text-xs text-gray-600 space-y-1">
                <p>Feed URL: {yandexIntegration?.feed_url || '—'}</p>
                {yandexPreview && (
                  <p>
                    preview: offers={yandexPreview.offers_count} (new={yandexPreview.new_offers_count || 0}, used={yandexPreview.used_offers_count || 0}), categories={yandexPreview.categories_count}, checksum={yandexPreview.checksum}
                  </p>
                )}
              </div>
              {yandexHeadCheckResult && (
                <pre className="mt-3 rounded-md bg-gray-50 p-3 text-xs text-gray-700 overflow-auto">
                  {JSON.stringify(yandexHeadCheckResult, null, 2)}
                </pre>
              )}
            </div>

            <div className="rounded-lg border border-gray-200 p-4">
              <h3 className="font-medium text-gray-900 mb-3">Асинхронная загрузка в Яндекс</h3>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => runYandexSync(false)}
                  disabled={yandexSyncBusy || !yandexConnected}
                  className="inline-flex items-center rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
                >
                  {yandexSyncBusy ? 'Запуск…' : 'Загрузить фид сейчас (async)'}
                </button>
                <button
                  type="button"
                  onClick={() => runYandexSync(true)}
                  disabled={yandexSyncBusy || !yandexConnected}
                  className="inline-flex items-center rounded-md border border-indigo-200 bg-indigo-50 px-4 py-2 text-sm font-medium text-indigo-700 hover:bg-indigo-100 disabled:opacity-50"
                >
                  Force sync
                </button>
                <button
                  type="button"
                  onClick={loadUploadedYandexFeeds}
                  disabled={!yandexConnected}
                  className="inline-flex items-center rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                >
                  Список фидов в Вебмастере
                </button>
              </div>
              <div className="mt-3 text-xs text-gray-600 space-y-1">
                <p>pending_sync: {String(Boolean(yandexSyncStatus?.pending_sync))}</p>
                <p>sync_in_progress: {String(Boolean(yandexSyncStatus?.sync_in_progress))}</p>
                <p>last_request_id: {yandexSyncStatus?.last_request_id || '—'}</p>
                <p>last_process_status: {yandexSyncStatus?.last_process_status || '—'}</p>
                <p>last_error: {yandexSyncStatus?.last_error || '—'}</p>
              </div>
              {yandexFeedsList && (
                <pre className="mt-3 rounded-md bg-gray-50 p-3 text-xs text-gray-700 overflow-auto">
                  {JSON.stringify(yandexFeedsList, null, 2)}
                </pre>
              )}
            </div>
          </div>
        )}
      </div>

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

      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6 mt-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-1">
          Доставка для Яндекс Товаров
        </h2>
        <p className="text-sm text-gray-500 mb-4">
          Матрица должна совпадать с разделом «Магазин → Доставка» в merchants.yandex.ru и
          отображаться на странице <a href="/delivery" className="text-indigo-600 underline">/delivery</a>.
        </p>

        {siteDeliveryLoading ? (
          <p className="text-sm text-gray-500">Загрузка матрицы доставки…</p>
        ) : (
          <div className="space-y-4">
            <div className="overflow-x-auto rounded-lg border border-gray-200">
              <table className="min-w-full text-sm">
                <thead className="bg-gray-50 text-left text-gray-500">
                  <tr>
                    <th className="px-3 py-2">Регион</th>
                    <th className="px-3 py-2">Тип</th>
                    <th className="px-3 py-2">Служба</th>
                    <th className="px-3 py-2">Мин. сумма</th>
                    <th className="px-3 py-2">Вкл.</th>
                  </tr>
                </thead>
                <tbody>
                  {siteDeliveryOptions.map((row) => (
                    <tr key={row.id} className="border-t border-gray-100">
                      <td className="px-3 py-2">{row.region_name}</td>
                      <td className="px-3 py-2">{row.delivery_type}</td>
                      <td className="px-3 py-2">{row.carrier || '—'}</td>
                      <td className="px-3 py-2">{row.min_order_amount}</td>
                      <td className="px-3 py-2">
                        <button
                          type="button"
                          onClick={() => toggleSiteDeliveryOption(row)}
                          disabled={siteDeliverySaving}
                          className={`rounded px-2 py-1 text-xs ${row.enabled ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-600'}`}
                        >
                          {row.enabled ? 'вкл' : 'выкл'}
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
                placeholder="region_id"
                value={newDeliveryRow.region_id}
                onChange={(e) => setNewDeliveryRow((prev) => ({ ...prev, region_id: e.target.value }))}
              />
              <input
                className="rounded-md border border-gray-300 px-3 py-2 text-sm"
                placeholder="region_name"
                value={newDeliveryRow.region_name}
                onChange={(e) => setNewDeliveryRow((prev) => ({ ...prev, region_name: e.target.value }))}
              />
              <select
                className="rounded-md border border-gray-300 px-3 py-2 text-sm"
                value={newDeliveryRow.delivery_type}
                onChange={(e) => setNewDeliveryRow((prev) => ({ ...prev, delivery_type: e.target.value }))}
              >
                <option value="pickup">pickup</option>
                <option value="pvz">pvz</option>
                <option value="courier">courier</option>
              </select>
              <input
                className="rounded-md border border-gray-300 px-3 py-2 text-sm"
                placeholder="carrier"
                value={newDeliveryRow.carrier}
                onChange={(e) => setNewDeliveryRow((prev) => ({ ...prev, carrier: e.target.value }))}
              />
            </div>

            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={createSiteDeliveryOption}
                disabled={siteDeliverySaving}
                className="inline-flex items-center rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
              >
                Добавить способ доставки
              </button>
              <button
                type="button"
                onClick={syncYandexRegionsFromDelivery}
                disabled={siteDeliverySaving}
                className="inline-flex items-center rounded-md border border-indigo-200 bg-indigo-50 px-4 py-2 text-sm font-medium text-indigo-700 hover:bg-indigo-100 disabled:opacity-50"
              >
                Синхронизировать regionIds фида
              </button>
            </div>
          </div>
        )}
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
