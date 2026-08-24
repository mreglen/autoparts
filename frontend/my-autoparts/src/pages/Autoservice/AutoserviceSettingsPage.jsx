import { useCallback, useEffect, useMemo, useState } from 'react';
import { useAuthReady } from '../../hooks/useAuthReady';
import AuthLoadingScreen from '../../components/AuthLoadingScreen/AuthLoadingScreen';
import ActionsDropdown, { ActionsDropdownItem } from '../../components/ActionsDropdown/ActionsDropdown';
import Modal from '../../components/UI/Modal';
import PayerFormModal from '../../components/Autoservice/PayerFormModal';
import WorkZonesSortableList from '../../components/Autoservice/WorkZonesSortableList';
import { UnderlineTabs } from '../../components/UI';
import { apiRequest } from '../../utils/apiClient';
import { payerDisplayName, personTypeLabel } from '../../utils/autoservicePayerRequisites';

const inputClass =
  'mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20';

const fieldClass =
  'w-full rounded-lg border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20';

const btnPrimary =
  'inline-flex h-10 items-center justify-center rounded-lg bg-indigo-600 px-4 text-sm font-semibold text-white transition hover:bg-indigo-700 disabled:opacity-60';

const btnGhost =
  'inline-flex h-10 items-center justify-center rounded-lg border border-gray-300 bg-white px-4 text-sm font-medium text-gray-700 transition hover:bg-gray-50';

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
      <form onSubmit={handleAdd} className="mb-4 border-b border-gray-100 pb-4">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
          <div className="min-w-0 flex-1">
            <label htmlFor="work-name" className="mb-1 block text-xs font-medium text-gray-500">
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
            <label htmlFor="work-price" className="mb-1 block text-xs font-medium text-gray-500">
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
        <p className="py-6 text-center text-sm text-gray-500">Загрузка…</p>
      ) : activeWorks.length === 0 ? (
        <p className="py-6 text-center text-sm text-gray-500">Пока пусто</p>
      ) : (
        <ul className="divide-y divide-gray-100">
          {activeWorks.map((w) => (
            <li key={w.id} className="flex items-center justify-between gap-3 py-2.5 text-sm">
              <span className="min-w-0 truncate font-medium text-gray-900">{w.name}</span>
              <span className="shrink-0 tabular-nums text-gray-600">
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
        <label className="block text-sm font-medium text-gray-700">Название</label>
        <input
          autoFocus
          className={inputClass}
          placeholder="Название"
          value={name}
          onChange={(e) => setName(e.target.value)}
          maxLength={120}
        />
        {error ? <p className="mt-2 text-sm text-red-600">{error}</p> : null}
      </form>
    </Modal>
  );
}


export default function AutoserviceSettingsPage() {
  const { isReady, isAuthenticated, user } = useAuthReady();
  const [tab, setTab] = useState('general');
  const [publicName, setPublicName] = useState('');
  const [publicDescription, setPublicDescription] = useState('');
  const [workZones, setWorkZones] = useState([]);
  const [payers, setPayers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [workZonesLoading, setWorkZonesLoading] = useState(false);
  const [payersLoading, setPayersLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [savedMessage, setSavedMessage] = useState('');
  const [zoneModal, setZoneModal] = useState(null);
  const [payerModal, setPayerModal] = useState(null);
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

  const loadPayers = useCallback(async () => {
    setPayersLoading(true);
    try {
      const data = await apiRequest('/autoservice/payers');
      setPayers(Array.isArray(data) ? data : []);
    } catch (e) {
      setError(e?.message || 'Не удалось загрузить плательщиков');
    } finally {
      setPayersLoading(false);
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
      await Promise.all([loadSettings(), loadWorkZones(), loadPayers(), loadWorks()]);
    } catch (e) {
      setError(e?.message || 'Не удалось загрузить настройки');
    } finally {
      setLoading(false);
    }
  }, [loadSettings, loadWorkZones, loadPayers, loadWorks]);

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

  const removePayer = async (payerId) => {
    if (!window.confirm('Удалить плательщика?')) return;
    setError('');
    try {
      await apiRequest(`/autoservice/payers/${payerId}`, { method: 'DELETE' });
      await loadPayers();
    } catch (err) {
      setError(err?.message || 'Не удалось удалить');
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
          <h1 className="text-xl font-bold text-gray-900 sm:text-2xl">Настройки</h1>
        </div>
        <button
          type="button"
          onClick={load}
          className="inline-flex h-10 w-10 shrink-0 items-center justify-center self-start rounded-full bg-gray-100 text-gray-600 transition hover:bg-gray-200 hover:text-gray-900 sm:self-auto"
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
          { id: 'payers', label: 'Плательщики' },
        ]}
        value={tab}
        onChange={setTab}
      />

      {error ? (
        <p className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700" role="alert">
          {error}
        </p>
      ) : null}
      {savedMessage && !error ? (
        <p className="mb-4 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800" role="status">
          {savedMessage}
        </p>
      ) : null}

      {loading ? (
        <p className="py-12 text-center text-sm text-gray-500">Загрузка…</p>
      ) : (
        <>
          {tab === 'general' ? (
            <form onSubmit={handleSave} className="max-w-2xl space-y-5">
              <div>
                <label htmlFor="public_name" className="block text-sm font-medium text-gray-700">
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
                <label htmlFor="public_description" className="block text-sm font-medium text-gray-700">
                  Описание
                </label>
                <textarea
                  id="public_description"
                  rows={4}
                  value={publicDescription}
                  onChange={(ev) => setPublicDescription(ev.target.value)}
                  maxLength={2000}
                  className={inputClass}
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
                <p className="text-sm text-gray-500">
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
                <p className="text-sm text-gray-500">
                  {worksLoading ? 'Загрузка…' : `${activeWorks.length} работ`}
                </p>
                <button type="button" onClick={() => setWorksOpen(true)} className={btnPrimary}>
                  Управление
                </button>
              </div>
              <div className="hidden md:block">
                <table className="min-w-full divide-y divide-gray-200 text-sm">
                  <thead>
                    <tr className="text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
                      <th className="py-3 pr-3">Название</th>
                      <th className="w-36 py-3 text-right">Цена</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {worksLoading ? (
                      <tr>
                        <td colSpan={2} className="py-12 text-center text-gray-500">
                          Загрузка…
                        </td>
                      </tr>
                    ) : activeWorks.length === 0 ? (
                      <tr>
                        <td colSpan={2} className="py-12 text-center text-gray-500">
                          Работ пока нет
                        </td>
                      </tr>
                    ) : (
                      activeWorks.map((w) => (
                        <tr key={w.id} className="transition-colors hover:bg-gray-50/70">
                          <td className="py-3 pr-3 align-middle font-medium text-gray-900">{w.name}</td>
                          <td className="py-3 text-right align-middle tabular-nums text-gray-700">
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
                  <p className="py-10 text-center text-sm text-gray-500">Загрузка…</p>
                ) : activeWorks.length === 0 ? (
                  <p className="py-10 text-center text-sm text-gray-500">Работ пока нет</p>
                ) : (
                  activeWorks.map((w) => (
                    <div
                      key={w.id}
                      className="flex items-center justify-between gap-3 border-b border-gray-100 py-3 last:border-b-0"
                    >
                      <p className="min-w-0 truncate text-sm font-semibold text-gray-900">{w.name}</p>
                      <p className="shrink-0 text-sm tabular-nums text-gray-600">
                        {Number(w.default_unit_price).toLocaleString('ru-RU')} ₽
                      </p>
                    </div>
                  ))
                )}
              </div>
            </section>
          ) : null}

          {tab === 'payers' ? (
            <section>
              <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                <p className="text-sm text-gray-500">
                  {payersLoading ? 'Загрузка…' : `${payers.length} плательщиков`}
                </p>
                <button type="button" onClick={() => setPayerModal({ mode: 'create' })} className={btnPrimary}>
                  Добавить
                </button>
              </div>
              <div className="hidden md:block">
                <table className="min-w-full divide-y divide-gray-200 text-sm">
                  <thead>
                    <tr className="text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
                      <th className="py-3 pr-3">Плательщик</th>
                      <th className="w-28 py-3 pr-3">Тип</th>
                      <th className="py-3 pr-3">Email</th>
                      <th className="w-40 py-3 text-right">Действия</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {payersLoading ? (
                      <tr>
                        <td colSpan={4} className="py-12 text-center text-gray-500">
                          Загрузка…
                        </td>
                      </tr>
                    ) : payers.length === 0 ? (
                      <tr>
                        <td colSpan={4} className="py-12 text-center text-gray-500">
                          Плательщиков пока нет
                        </td>
                      </tr>
                    ) : (
                      payers.map((payer) => (
                        <tr key={payer.id} className="transition-colors hover:bg-gray-50/70">
                          <td className="py-3 pr-3 align-middle font-medium text-gray-900">
                            {payer.display_name || payerDisplayName(payer)}
                          </td>
                          <td className="py-3 pr-3 align-middle text-gray-600">
                            {personTypeLabel(payer.person_type)}
                          </td>
                          <td className="py-3 pr-3 align-middle text-gray-600">{payer.email || '—'}</td>
                          <td className="py-3 text-right align-middle">
                            <ActionsDropdown
                              menuClassName="w-40 z-50"
                              estimatedMenuHeight={100}
                              showLabel
                              buttonClassName="inline-flex h-9 items-center gap-1.5 rounded-lg border border-gray-300 bg-white px-2.5 text-sm font-medium text-gray-700 transition hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-1"
                            >
                              <ActionsDropdownItem onClick={() => setPayerModal({ mode: 'edit', payer })}>
                                Изменить
                              </ActionsDropdownItem>
                              <ActionsDropdownItem danger onClick={() => removePayer(payer.id)}>
                                Удалить
                              </ActionsDropdownItem>
                            </ActionsDropdown>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
              <div className="md:hidden">
                {payersLoading ? (
                  <p className="py-10 text-center text-sm text-gray-500">Загрузка…</p>
                ) : payers.length === 0 ? (
                  <p className="py-10 text-center text-sm text-gray-500">Плательщиков пока нет</p>
                ) : (
                  payers.map((payer) => (
                    <div key={payer.id} className="flex items-center justify-between gap-3 border-b border-gray-100 py-3 last:border-b-0">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-gray-900">
                          {payer.display_name || payerDisplayName(payer)}
                        </p>
                        <p className="truncate text-xs text-gray-500">
                          {personTypeLabel(payer.person_type)}
                          {payer.email ? ` · ${payer.email}` : ''}
                        </p>
                      </div>
                      <ActionsDropdown
                        menuClassName="w-40 z-50"
                        estimatedMenuHeight={100}
                        showLabel={false}
                        buttonClassName="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-gray-300 bg-white text-gray-700 transition hover:bg-gray-50"
                      >
                        <ActionsDropdownItem onClick={() => setPayerModal({ mode: 'edit', payer })}>
                          Изменить
                        </ActionsDropdownItem>
                        <ActionsDropdownItem danger onClick={() => removePayer(payer.id)}>
                          Удалить
                        </ActionsDropdownItem>
                      </ActionsDropdown>
                    </div>
                  ))
                )}
              </div>
            </section>
          ) : null}
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

      <PayerFormModal
        open={Boolean(payerModal)}
        mode={payerModal?.mode || 'create'}
        payer={payerModal?.payer}
        onClose={() => setPayerModal(null)}
        onSaved={loadPayers}
      />
    </div>
  );
}
