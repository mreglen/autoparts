import { useCallback, useEffect, useMemo, useState } from 'react';
import { useAuthReady } from '../../hooks/useAuthReady';
import AuthLoadingScreen from '../../components/AuthLoadingScreen/AuthLoadingScreen';
import Modal from '../../components/UI/Modal';
import WorkZonesSortableList from '../../components/Autoservice/WorkZonesSortableList';
import { UnderlineTabs } from '../../components/UI';
import { apiRequest, API_BASE, getAuthToken } from '../../utils/apiClient';

const inputClass =
  'sg-pill-input mt-1 w-full';

const fieldClass =
  'sg-pill-input w-full';

const textareaClass =
  'sg-pill-textarea mt-1 w-full';

const btnPrimary =
  'inline-flex min-h-11 items-center justify-center rounded-sg-sm bg-brand-600 px-4 text-sm font-semibold text-white transition hover:bg-brand-700 disabled:opacity-60 sm:min-h-10';

const btnGhost =
  'inline-flex min-h-11 items-center justify-center rounded-sg-sm border border-line-strong bg-surface px-4 text-sm font-medium text-ink-soft transition hover:bg-surface-muted disabled:opacity-60 sm:min-h-10';

function WorksModal({ open, works, loading, onClose, onAdd, onRefresh }) {
  const [name, setName] = useState('');
  const [price, setPrice] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setName('');
    setPrice('');
    setSaving(false);
  }, [open]);

  const handleAdd = async (e) => {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) return;
    setSaving(true);
    try {
      const parsedPrice = Number(String(price).replace(',', '.').trim());
      await onAdd({ name: trimmed, default_unit_price: Number.isFinite(parsedPrice) ? parsedPrice : 0 });
      setName('');
      setPrice('');
      await onRefresh();
    } finally {
      setSaving(false);
    }
  };

  const activeWorks = useMemo(() => works.filter((w) => w.is_active), [works]);

  return (
    <Modal open={open} onClose={onClose} title="Работы" size="md">
      <form onSubmit={handleAdd} className="mb-4 border-b border-line-soft pb-4">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
          <div className="min-w-0 flex-1">
            <label htmlFor="work-name" className="mb-1 block text-xs font-medium text-ink-muted">
              Название
            </label>
            <input
              id="work-name"
              className={fieldClass}
              placeholder="Например, замена масла"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>
          <div className="w-full sm:w-36">
            <label htmlFor="work-price" className="mb-1 block text-xs font-medium text-ink-muted">
              Цена, ₽
            </label>
            <input
              id="work-price"
              type="text"
              inputMode="decimal"
              className={fieldClass}
              value={price}
              onChange={(e) => setPrice(e.target.value)}
            />
          </div>
          <button type="submit" disabled={saving} className={`${btnPrimary} shrink-0`}>
            {saving ? '…' : 'Добавить'}
          </button>
        </div>
      </form>
      {loading ? (
        <p className="py-6 text-center text-sm text-ink-muted">Загрузка…</p>
      ) : activeWorks.length === 0 ? (
        <p className="py-6 text-center text-sm text-ink-muted">Пока пусто</p>
      ) : (
        <ul className="divide-y divide-line-soft">
          {activeWorks.map((w) => (
            <li key={w.id} className="flex items-center justify-between gap-3 py-2.5 text-sm">
              <span className="min-w-0 truncate font-medium text-ink">{w.name}</span>
              <span className="shrink-0 tabular-nums text-ink-muted">
                {Number(w.default_unit_price).toLocaleString('ru-RU')} ₽
              </span>
            </li>
          ))}
        </ul>
      )}
    </Modal>
  );
}

function WorkZoneModal({ open, mode, zone, onClose, onSaved }) {
  const [name, setName] = useState(zone?.name || '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!open) return;
    setName(zone?.name || '');
    setError('');
    setSaving(false);
  }, [zone, mode, open]);

  const handleSubmit = async (event) => {
    event.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) {
      setError('Введите название');
      return;
    }
    setSaving(true);
    setError('');
    try {
      if (mode === 'create') {
        await apiRequest('/autoservice/work-zones', {
          method: 'POST',
          body: JSON.stringify({ name: trimmed }),
        });
      } else {
        await apiRequest(`/autoservice/work-zones/${zone.id}`, {
          method: 'PATCH',
          body: JSON.stringify({ name: trimmed }),
        });
      }
      await onSaved();
      onClose();
    } catch (err) {
      setError(err?.message || 'Не удалось сохранить');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={mode === 'create' ? 'Новая зона' : 'Переименовать'}
      size="sm"
      footer={
        <div className="flex justify-end gap-2">
          <button type="button" onClick={onClose} className={btnGhost} disabled={saving}>
            Отмена
          </button>
          <button type="submit" form="work-zone-form" disabled={saving} className={btnPrimary}>
            {saving ? '…' : 'Сохранить'}
          </button>
        </div>
      }
    >
      <form id="work-zone-form" onSubmit={handleSubmit}>
        <label className="block text-sm font-medium text-ink-soft">Название</label>
        <input
          autoFocus
          className={inputClass}
          placeholder="Название"
          value={name}
          onChange={(e) => setName(e.target.value)}
          maxLength={120}
        />
        {error ? <p className="mt-2 text-sm text-danger-600">{error}</p> : null}
      </form>
    </Modal>
  );
}


function IosShortcutsPanel() {
  const [copied, setCopied] = useState(false);
  const token = useMemo(() => getAuthToken() || '', []);
  const todayUrl = `${API_BASE}/autoservice/planner/shortcuts/today`;
  const createUrl = `${API_BASE}/autoservice/inspection-bookings/shortcut`;
  const createBody = JSON.stringify(
    {
      name: 'Иван Иванов',
      phone: '+79990001122',
      preferred_date: '2026-09-15',
      preferred_time: '10:00:00',
      vehicle_make: 'Toyota',
      vehicle_model: 'Camry',
      work_zone_id: 1,
      notes: '',
    },
    null,
    2,
  );

  const handleCopyToken = async () => {
    if (!token) return;
    try {
      await navigator.clipboard.writeText(token);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (e) {
      // clipboard unavailable
    }
  };

  return (
    <section className="max-w-2xl space-y-5">
      <h3 className="text-base font-semibold text-ink">iOS Shortcuts</h3>
      <p className="text-sm text-ink-muted">
        Используйте URL и токен в приложении «Команды» (Shortcuts), чтобы создавать записи на
        осмотр и смотреть планировщик прямо с рабочего стола.
      </p>

      <div>
        <label htmlFor="ios-shortcuts-token" className="block text-sm font-medium text-ink-soft">
          Токен авторизации
        </label>
        <div className="mt-1 flex gap-2">
          <input
            id="ios-shortcuts-token"
            type="text"
            readOnly
            value={token || 'Не авторизован'}
            className={fieldClass}
          />
          <button
            type="button"
            onClick={handleCopyToken}
            disabled={!token}
            className={`${btnPrimary} shrink-0`}
          >
            {copied ? 'Скопировано' : 'Копировать'}
          </button>
        </div>
        <p className="mt-1 text-xs text-ink-faint">
          Вставьте как заголовок Authorization: Bearer {'<токен>'}
        </p>
      </div>

      <div>
        <span className="block text-sm font-medium text-ink-soft">Показать планировщик на сегодня</span>
        <code className="mt-1 block break-all rounded-sg bg-surface-subtle px-3 py-2 text-xs text-ink">
          GET {todayUrl}
        </code>
      </div>

      <div>
        <span className="block text-sm font-medium text-ink-soft">Создать запись на осмотр</span>
        <code className="mt-1 block break-all rounded-sg bg-surface-subtle px-3 py-2 text-xs text-ink">
          POST {createUrl}
        </code>
        <pre className="mt-2 overflow-x-auto rounded-sg bg-surface-subtle p-3 text-xs text-ink">
          {createBody}
        </pre>
      </div>
    </section>
  );
}


export default function AutoserviceSettingsPage() {
  const { isReady, isAuthenticated, user } = useAuthReady();
  const [tab, setTab] = useState('general');
  const [publicName, setPublicName] = useState('');
  const [publicDescription, setPublicDescription] = useState('');
  const [workZones, setWorkZones] = useState([]);
  const [loading, setLoading] = useState(true);
  const [workZonesLoading, setWorkZonesLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [savedMessage, setSavedMessage] = useState('');
  const [zoneModal, setZoneModal] = useState(null);
  const [worksOpen, setWorksOpen] = useState(false);
  const [works, setWorks] = useState([]);
  const [worksLoading, setWorksLoading] = useState(false);
  const [zonesReordering, setZonesReordering] = useState(false);

  const loadSettings = useCallback(async () => {
    const data = await apiRequest('/autoservice/settings');
    setPublicName(data?.public_name || '');
    setPublicDescription(data?.public_description || '');
  }, []);

  const loadWorkZones = useCallback(async () => {
    setWorkZonesLoading(true);
    try {
      const data = await apiRequest('/autoservice/work-zones');
      setWorkZones(Array.isArray(data) ? data : []);
    } catch (e) {
      setError(e?.message || 'Не удалось загрузить рабочие зоны');
    } finally {
      setWorkZonesLoading(false);
    }
  }, []);

  const loadWorks = useCallback(async () => {
    setWorksLoading(true);
    try {
      const data = await apiRequest('/autoservice/works?include_inactive=true');
      setWorks(Array.isArray(data) ? data : []);
    } catch (e) {
      setError(e?.message || 'Не удалось загрузить работы');
    } finally {
      setWorksLoading(false);
    }
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      await Promise.all([loadSettings(), loadWorkZones(), loadWorks()]);
    } catch (e) {
      setError(e?.message || 'Не удалось загрузить настройки');
    } finally {
      setLoading(false);
    }
  }, [loadSettings, loadWorkZones, loadWorks]);

  useEffect(() => {
    if (isReady && isAuthenticated) load();
  }, [isReady, isAuthenticated, load]);

  const activeWorks = useMemo(() => works.filter((w) => w.is_active), [works]);

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    setSavedMessage('');
    try {
      const data = await apiRequest('/autoservice/settings', {
        method: 'PUT',
        body: JSON.stringify({
          public_name: publicName.trim() || null,
          public_description: publicDescription.trim() || null,
        }),
      });
      setPublicName(data?.public_name || '');
      setPublicDescription(data?.public_description || '');
      setSavedMessage('Сохранено');
    } catch (err) {
      setError(err?.message || 'Не удалось сохранить');
    } finally {
      setSaving(false);
    }
  };

  const removeWorkZone = async (zoneId) => {
    if (!window.confirm('Удалить зону?')) return;
    setError('');
    try {
      await apiRequest(`/autoservice/work-zones/${zoneId}`, { method: 'DELETE' });
      await loadWorkZones();
    } catch (err) {
      setError(err?.message || 'Не удалось удалить');
    }
  };

  const reorderWorkZones = async (nextZones) => {
    setWorkZones(nextZones);
    setZonesReordering(true);
    setError('');
    try {
      const data = await apiRequest('/autoservice/work-zones/reorder', {
        method: 'PUT',
        body: JSON.stringify({ zone_ids: nextZones.map((zone) => zone.id) }),
      });
      setWorkZones(Array.isArray(data) ? data : nextZones);
    } catch (err) {
      await loadWorkZones();
      setError(err?.message || 'Не удалось сохранить порядок зон');
    } finally {
      setZonesReordering(false);
    }
  };

  const addWork = async (payload) => {
    await apiRequest('/autoservice/works', { method: 'POST', body: JSON.stringify(payload) });
  };

  if (!isReady) return <AuthLoadingScreen />;
  if (!isAuthenticated || !user) return null;

  return (
    <div className="w-full min-w-0">
      <div className="mb-4 flex flex-col gap-3 sm:mb-5 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-bold text-ink sm:text-2xl">Настройки</h1>
        </div>
        <button
          type="button"
          onClick={load}
          className="inline-flex h-10 w-10 shrink-0 items-center justify-center self-start rounded-full bg-surface-subtle text-ink-muted transition hover:bg-surface-muted hover:text-ink sm:self-auto"
          title="Обновить"
          aria-label="Обновить"
        >
          <svg className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M4 4v5h.582m15.356 2A8.001 8.001 0 0 0 4.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 0 1-15.357-2m15.357 2H15"
            />
          </svg>
        </button>
      </div>

      <UnderlineTabs
        className="mb-4"
        ariaLabel="Разделы настроек"
        gapClassName="gap-4"
        tabs={[
          { id: 'general', label: 'Общее' },
          { id: 'zones', label: 'Зоны' },
          { id: 'works', label: 'Работы' },
          { id: 'ios-shortcuts', label: 'iOS Shortcuts' },
        ]}
        value={tab}
        onChange={setTab}
      />

      {error ? (
        <p className="mb-4 rounded-sg border border-danger-200 bg-danger-50 px-4 py-3 text-sm text-danger-700" role="alert">
          {error}
        </p>
      ) : null}
      {savedMessage && !error ? (
        <p className="mb-4 rounded-sg border border-success-100 bg-success-50 px-4 py-3 text-sm text-success-700" role="status">
          {savedMessage}
        </p>
      ) : null}

      {loading ? (
        <p className="py-12 text-center text-sm text-ink-muted">Загрузка…</p>
      ) : (
        <>
          {tab === 'general' ? (
            <form onSubmit={handleSave} className="max-w-2xl space-y-5">
              <div>
                <label htmlFor="public_name" className="block text-sm font-medium text-ink-soft">
                  Название автосервиса
                </label>
                <input
                  id="public_name"
                  value={publicName}
                  onChange={(ev) => setPublicName(ev.target.value)}
                  maxLength={160}
                  className={inputClass}
                />
              </div>
              <div>
                <label htmlFor="public_description" className="block text-sm font-medium text-ink-soft">
                  Описание
                </label>
                <textarea
                  id="public_description"
                  rows={4}
                  value={publicDescription}
                  onChange={(ev) => setPublicDescription(ev.target.value)}
                  maxLength={2000}
                  className={textareaClass}
                />
              </div>
              <button type="submit" disabled={saving} className={btnPrimary}>
                {saving ? 'Сохранение…' : 'Сохранить'}
              </button>
            </form>
          ) : null}

          {tab === 'zones' ? (
            <section>
              <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                <p className="text-sm text-ink-muted">
                  {workZonesLoading
                    ? 'Загрузка…'
                    : `${workZones.length} зон${zonesReordering ? ' · сохранение порядка…' : ''}`}
                </p>
                <button type="button" onClick={() => setZoneModal({ mode: 'create' })} className={btnPrimary}>
                  Добавить
                </button>
              </div>
              <WorkZonesSortableList
                zones={workZones}
                loading={workZonesLoading}
                disabled={zonesReordering}
                onReorder={reorderWorkZones}
                onEdit={(zone) => setZoneModal({ mode: 'edit', zone })}
                onRemove={removeWorkZone}
              />
            </section>
          ) : null}

          {tab === 'works' ? (
            <section>
              <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                <p className="text-sm text-ink-muted">
                  {worksLoading ? 'Загрузка…' : `${activeWorks.length} работ`}
                </p>
                <button type="button" onClick={() => setWorksOpen(true)} className={btnPrimary}>
                  Управление
                </button>
              </div>
              <div className="hidden md:block">
                <table className="min-w-full divide-y divide-line text-sm">
                  <thead>
                    <tr className="text-left text-xs font-semibold uppercase tracking-wide text-ink-muted">
                      <th className="py-3 pr-3">Название</th>
                      <th className="w-36 py-3 text-right">Цена</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-line-soft">
                    {worksLoading ? (
                      <tr>
                        <td colSpan={2} className="py-12 text-center text-ink-muted">
                          Загрузка…
                        </td>
                      </tr>
                    ) : activeWorks.length === 0 ? (
                      <tr>
                        <td colSpan={2} className="py-12 text-center text-ink-muted">
                          Работ пока нет
                        </td>
                      </tr>
                    ) : (
                      activeWorks.map((w) => (
                        <tr key={w.id} className="transition-colors hover:bg-surface-muted/70">
                          <td className="py-3 pr-3 align-middle font-medium text-ink">{w.name}</td>
                          <td className="py-3 text-right align-middle tabular-nums text-ink-soft">
                            {Number(w.default_unit_price).toLocaleString('ru-RU')} ₽
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
              <div className="md:hidden">
                {worksLoading ? (
                  <p className="py-10 text-center text-sm text-ink-muted">Загрузка…</p>
                ) : activeWorks.length === 0 ? (
                  <p className="py-10 text-center text-sm text-ink-muted">Работ пока нет</p>
                ) : (
                  activeWorks.map((w) => (
                    <div
                      key={w.id}
                      className="flex items-center justify-between gap-3 border-b border-line-soft py-3 last:border-b-0"
                    >
                      <p className="min-w-0 truncate text-sm font-semibold text-ink">{w.name}</p>
                      <p className="shrink-0 text-sm tabular-nums text-ink-muted">
                        {Number(w.default_unit_price).toLocaleString('ru-RU')} ₽
                      </p>
                    </div>
                  ))
                )}
              </div>
            </section>
          ) : null}

          {tab === 'ios-shortcuts' ? <IosShortcutsPanel /> : null}
        </>
      )}

      <WorksModal
        open={worksOpen}
        works={works}
        loading={worksLoading}
        onClose={() => setWorksOpen(false)}
        onAdd={addWork}
        onRefresh={loadWorks}
      />

      <WorkZoneModal
        open={Boolean(zoneModal)}
        mode={zoneModal?.mode || 'create'}
        zone={zoneModal?.zone}
        onClose={() => setZoneModal(null)}
        onSaved={loadWorkZones}
      />

    </div>
  );
}
