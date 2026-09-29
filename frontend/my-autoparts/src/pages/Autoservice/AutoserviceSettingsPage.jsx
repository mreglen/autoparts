import { useCallback, useEffect, useMemo, useState } from 'react';
import { useAuthReady } from '../../hooks/useAuthReady';
import AuthLoadingScreen from '../../components/AuthLoadingScreen/AuthLoadingScreen';
import Modal, { ConfirmDialog } from '../../components/UI/Modal';
import NumericInput from '../../components/UI/NumericInput';
import WorkZonesSortableList from '../../components/Autoservice/WorkZonesSortableList';
import { Skeleton, UnderlineTabs } from '../../components/UI';
import Toast from '../../components/UI/Toast';
import { apiRequest } from '../../utils/apiClient';
import {
  autoserviceListMobileWrapClass,
  autoserviceListTableClass,
  autoserviceListTableWrapClass,
  autoserviceListTbodyClass,
  autoserviceListTdClass,
  autoserviceListTdRightClass,
  autoserviceListThClass,
  autoserviceListThRightClass,
  autoserviceListTheadRowClass,
  autoserviceListTrClickableClass,
} from '../../utils/warehouseListUi';

const inputClass =
  'sg-pill-input mt-1 w-full';

const textareaClass =
  'sg-pill-textarea mt-1 w-full';

const btnPrimary =
  'inline-flex min-h-11 items-center justify-center rounded-sg-sm bg-brand-600 px-4 text-sm font-semibold text-white transition hover:bg-brand-700 disabled:opacity-60 sm:min-h-10';

const btnGhost =
  'inline-flex min-h-11 items-center justify-center rounded-sg-sm border border-line-strong bg-surface px-4 text-sm font-medium text-ink-soft transition hover:bg-surface-muted disabled:opacity-60 sm:min-h-10';

function WorksModal({ open, work, onClose, onSaved }) {
  const [name, setName] = useState('');
  const [price, setPrice] = useState('');
  const [saving, setSaving] = useState(false);
  const [toggling, setToggling] = useState(false);
  const [error, setError] = useState('');
  const isEdit = Boolean(work?.id);

  useEffect(() => {
    if (!open) return;
    setName(work?.name || '');
    setPrice(work?.default_unit_price != null ? String(work.default_unit_price) : '');
    setSaving(false);
    setToggling(false);
    setError('');
  }, [open, work]);

  const parsedPrice = () => {
    const parsed = Number(String(price).replace(',', '.').trim());
    return Number.isFinite(parsed) ? parsed : 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) {
      setError('Укажите название');
      return;
    }
    setSaving(true);
    setError('');
    try {
      if (isEdit) {
        await apiRequest(`/autoservice/works/${work.id}`, {
          method: 'PATCH',
          body: JSON.stringify({ name: trimmed, default_unit_price: parsedPrice() }),
        });
      } else {
        await apiRequest('/autoservice/works', {
          method: 'POST',
          body: JSON.stringify({ name: trimmed, default_unit_price: parsedPrice() }),
        });
      }
      await onSaved();
      onClose();
    } catch (err) {
      setError(err?.message || 'Не удалось сохранить работу');
    } finally {
      setSaving(false);
    }
  };

  const handleToggleActive = async () => {
    if (!isEdit || toggling) return;
    setToggling(true);
    setError('');
    try {
      await apiRequest(`/autoservice/works/${work.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ is_active: !work.is_active }),
      });
      await onSaved();
      onClose();
    } catch (err) {
      setError(err?.message || 'Не удалось изменить видимость');
    } finally {
      setToggling(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={isEdit ? 'Редактировать работу' : 'Новая работа'}
      size="sm"
      footer={
        <div className="flex flex-wrap justify-end gap-2">
          {isEdit ? (
            <button
              type="button"
              onClick={handleToggleActive}
              disabled={saving || toggling}
              className={`${btnGhost} mr-auto`}
            >
              {toggling ? '…' : work.is_active ? 'Скрыть' : 'Показать'}
            </button>
          ) : null}
          <button type="button" onClick={onClose} className={btnGhost} disabled={saving}>
            Отмена
          </button>
          <button type="submit" form="work-form" disabled={saving} className={btnPrimary}>
            {saving ? '…' : 'Сохранить'}
          </button>
        </div>
      }
    >
      <form id="work-form" onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label htmlFor="work-name" className="mb-1 block text-xs font-medium text-ink-muted">
            Название
          </label>
          <input
            id="work-name"
            autoFocus
            className={inputClass}
            placeholder="Например, замена масла"
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={160}
          />
        </div>
        <div>
          <label htmlFor="work-price" className="mb-1 block text-xs font-medium text-ink-muted">
            Цена по умолчанию, ₽
          </label>
          <input
            id="work-price"
            type="text"
            inputMode="decimal"
            className={inputClass}
            value={price}
            onChange={(e) => setPrice(e.target.value)}
          />
        </div>
        {error ? <p className="text-sm text-danger-600">{error}</p> : null}
      </form>
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


export default function AutoserviceSettingsPage() {
  const { isReady, isAuthenticated, user } = useAuthReady();
  const [tab, setTab] = useState('general');
  const [publicName, setPublicName] = useState('');
  const [publicDescription, setPublicDescription] = useState('');
  const [vatRate, setVatRate] = useState('22');
  const [workZones, setWorkZones] = useState([]);
  const [loading, setLoading] = useState(true);
  const [workZonesLoading, setWorkZonesLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [savedMessage, setSavedMessage] = useState('');
  const [zoneModal, setZoneModal] = useState(null);
  const [zoneDeleteConfirm, setZoneDeleteConfirm] = useState(null);
  const [zoneDeleting, setZoneDeleting] = useState(false);
  const [workModal, setWorkModal] = useState(null);
  const [showInactiveWorks, setShowInactiveWorks] = useState(false);
  const [works, setWorks] = useState([]);
  const [worksLoading, setWorksLoading] = useState(false);
  const [zonesReordering, setZonesReordering] = useState(false);

  const loadSettings = useCallback(async () => {
    const data = await apiRequest('/autoservice/settings');
    setPublicName(data?.public_name || '');
    setPublicDescription(data?.public_description || '');
    setVatRate(data?.vat_rate != null ? String(data.vat_rate) : '22');
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

  const displayedWorks = useMemo(
    () => (showInactiveWorks ? works : works.filter((w) => w.is_active)),
    [works, showInactiveWorks],
  );
  const hiddenWorksCount = useMemo(() => works.filter((w) => !w.is_active).length, [works]);

  const handleSave = async (e) => {
    e.preventDefault();
    const parsedVat = Number(String(vatRate).replace(',', '.').trim());
    if (!Number.isFinite(parsedVat) || parsedVat < 0 || parsedVat > 100) {
      setError('Ставка НДС должна быть от 0 до 100');
      return;
    }
    setSaving(true);
    setError('');
    setSavedMessage('');
    try {
      const data = await apiRequest('/autoservice/settings', {
        method: 'PUT',
        body: JSON.stringify({
          public_name: publicName.trim() || null,
          public_description: publicDescription.trim() || null,
          vat_rate: parsedVat,
        }),
      });
      setPublicName(data?.public_name || '');
      setPublicDescription(data?.public_description || '');
      setVatRate(data?.vat_rate != null ? String(data.vat_rate) : '22');
      setSavedMessage('Сохранено');
    } catch (err) {
      setError(err?.message || 'Не удалось сохранить');
    } finally {
      setSaving(false);
    }
  };

  const removeWorkZone = async (zoneId) => {
    setZoneDeleteConfirm(zoneId);
  };

  const confirmRemoveWorkZone = async () => {
    const zoneId = zoneDeleteConfirm;
    if (!zoneId || zoneDeleting) return;
    setZoneDeleting(true);
    setError('');
    try {
      await apiRequest(`/autoservice/work-zones/${zoneId}`, { method: 'DELETE' });
      setZoneDeleteConfirm(null);
      await loadWorkZones();
    } catch (err) {
      setError(err?.message || 'Не удалось удалить');
      setZoneDeleteConfirm(null);
    } finally {
      setZoneDeleting(false);
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

  if (!isReady) return <AuthLoadingScreen />;
  if (!isAuthenticated || !user) return null;

  return (
    <div className="w-full min-w-0">
      <div className="mb-4 flex flex-col gap-3 sm:mb-5 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-bold text-ink sm:text-2xl">Настройки</h1>
        </div>
      </div>

      <UnderlineTabs
        className="mb-4"
        ariaLabel="Разделы настроек"
        gapClassName="gap-4"
        tabs={[
          { id: 'general', label: 'Общее' },
          { id: 'zones', label: 'Зоны' },
          { id: 'works', label: 'Работы' },
        ]}
        value={tab}
        onChange={setTab}
      />

      <Toast message={error} variant="error" onClose={() => setError('')} />
      <Toast message={!error ? savedMessage : null} variant="success" onClose={() => setSavedMessage('')} />

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
                <label htmlFor="vat_rate" className="block text-sm font-medium text-ink-soft">
                  Ставка НДС, %
                </label>
                <NumericInput
                  id="vat_rate"
                  mode="decimal"
                  maxLength={6}
                  value={vatRate}
                  onChange={(ev) => setVatRate(ev.target.value)}
                  className={inputClass}
                />
                <p className="mt-1 text-xs text-ink-muted">
                  Цены в заказ-нарядах считаются с НДС «в том числе». При смене ставки пересчитываются только незакрытые заказ-наряды.
                </p>
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
                  {worksLoading ? 'Загрузка…' : `${displayedWorks.length} работ`}
                </p>
                <div className="flex items-center gap-3">
                  {hiddenWorksCount > 0 ? (
                    <label className="inline-flex cursor-pointer items-center gap-2 text-sm text-ink-soft">
                      <input
                        type="checkbox"
                        checked={showInactiveWorks}
                        onChange={(e) => setShowInactiveWorks(e.target.checked)}
                        className="h-4 w-4 rounded border-line accent-brand-600"
                      />
                      Скрытые ({hiddenWorksCount})
                    </label>
                  ) : null}
                  <button type="button" onClick={() => setWorkModal({ work: null })} className={btnPrimary}>
                    Добавить
                  </button>
                </div>
              </div>
              <div className={autoserviceListTableWrapClass}>
                <table className={autoserviceListTableClass}>
                  <thead>
                    <tr className={autoserviceListTheadRowClass}>
                      <th className={autoserviceListThClass}>Название</th>
                      <th className={`w-28 ${autoserviceListThRightClass}`}>Цена</th>
                      <th className={`w-24 ${autoserviceListThClass}`}>Статус</th>
                    </tr>
                  </thead>
                  <tbody className={autoserviceListTbodyClass}>
                    {worksLoading ? (
                      Array.from({ length: 4 }).map((_, index) => (
                        <tr key={`work-sk-${index}`}>
                          <td className={`min-w-0 ${autoserviceListTdClass}`}><Skeleton className="h-4 w-48" /></td>
                          <td className={`w-28 ${autoserviceListTdRightClass}`}><Skeleton className="ml-auto h-4 w-14" /></td>
                          <td className={`w-24 ${autoserviceListTdClass}`}><Skeleton className="h-4 w-14" /></td>
                        </tr>
                      ))
                    ) : displayedWorks.length === 0 ? (
                      <tr>
                        <td colSpan={3} className="py-12 text-center text-ink-muted">
                          Работ пока нет
                        </td>
                      </tr>
                    ) : (
                      displayedWorks.map((w) => (
                        <tr
                          key={w.id}
                          className={autoserviceListTrClickableClass}
                          onClick={() => setWorkModal({ work: w })}
                        >
                          <td className={`min-w-0 ${autoserviceListTdClass}`}>
                            <div className="w-0 min-w-full truncate font-semibold text-ink">{w.name}</div>
                          </td>
                          <td className={`w-28 whitespace-nowrap ${autoserviceListTdRightClass} tabular-nums text-ink-soft`}>
                            {Number(w.default_unit_price).toLocaleString('ru-RU')} ₽
                          </td>
                          <td className={`w-24 ${autoserviceListTdClass}`}>
                            {w.is_active ? (
                              <span className="text-xs text-ink-muted">Активна</span>
                            ) : (
                              <span className="inline-flex rounded-full bg-surface-subtle px-2 py-0.5 text-xs font-medium text-ink-muted ring-1 ring-inset ring-line">
                                Скрыта
                              </span>
                            )}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
              <div className={autoserviceListMobileWrapClass}>
                {worksLoading ? (
                  <div className="divide-y divide-line-soft">
                    {Array.from({ length: 4 }).map((_, index) => (
                      <div key={`mwork-sk-${index}`} className="py-2">
                        <Skeleton className="h-4 w-40" />
                      </div>
                    ))}
                  </div>
                ) : displayedWorks.length === 0 ? (
                  <p className="py-10 text-center text-sm text-ink-muted">Работ пока нет</p>
                ) : (
                  displayedWorks.map((w) => (
                    <button
                      key={w.id}
                      type="button"
                      onClick={() => setWorkModal({ work: w })}
                      className="flex w-full items-center justify-between gap-3 border-b border-line-soft py-2.5 text-left last:border-b-0"
                    >
                      <p className="min-w-0 truncate text-sm font-semibold text-ink">
                        {w.name}
                        {!w.is_active ? <span className="ml-1 text-xs text-ink-faint">(скрыта)</span> : null}
                      </p>
                      <p className="shrink-0 text-sm tabular-nums text-ink-muted">
                        {Number(w.default_unit_price).toLocaleString('ru-RU')} ₽
                      </p>
                    </button>
                  ))
                )}
              </div>
            </section>
          ) : null}
        </>
      )}

      <WorksModal
        open={Boolean(workModal)}
        work={workModal?.work}
        onClose={() => setWorkModal(null)}
        onSaved={loadWorks}
      />

      <ConfirmDialog
        open={Boolean(zoneDeleteConfirm)}
        onClose={() => setZoneDeleteConfirm(null)}
        onConfirm={confirmRemoveWorkZone}
        title="Удалить зону?"
        message="Зона будет удалена из планировщика."
        confirmLabel="Удалить"
        cancelLabel="Отмена"
        danger
        loading={zoneDeleting}
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
