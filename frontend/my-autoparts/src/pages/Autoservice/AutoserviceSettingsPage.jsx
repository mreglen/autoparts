import { useCallback, useEffect, useMemo, useState } from 'react';
import { useAuthReady } from '../../hooks/useAuthReady';
import AuthLoadingScreen from '../../components/AuthLoadingScreen/AuthLoadingScreen';
import ActionsDropdown, { ActionsDropdownItem } from '../../components/ActionsDropdown/ActionsDropdown';
import Modal from '../../components/UI/Modal';
import { UnderlineTabs } from '../../components/UI';
import { apiRequest } from '../../utils/apiClient';
import { formatPhoneFromRaw, formatPhoneInput, validatePhone } from '../../utils/contactValidation';

const inputClass =
  'mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20';

const fieldClass =
  'w-full rounded-lg border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20';

const btnPrimary =
  'inline-flex h-10 items-center justify-center rounded-lg bg-indigo-600 px-4 text-sm font-semibold text-white transition hover:bg-indigo-700 disabled:opacity-60';

const btnGhost =
  'inline-flex h-10 items-center justify-center rounded-lg border border-gray-300 bg-white px-4 text-sm font-medium text-gray-700 transition hover:bg-gray-50';

const SALARY_LABELS = {
  fixed: 'Фикс',
  percent_work: '% от работ',
  daily_rate: 'Ставка/день',
};

function employeeFormFromRow(emp) {
  return {
    name: emp?.name || '',
    phone: formatPhoneFromRaw(emp?.phone || ''),
    position: emp?.position || '',
    salary_type: emp?.salary_type || 'percent_work',
    salary_amount: emp?.salary_amount != null ? String(emp.salary_amount) : '0',
    work_percent: emp?.work_percent != null ? String(emp.work_percent) : '0',
  };
}

function salarySummary(emp) {
  const base =
    emp.salary_type === 'percent_work'
      ? `${emp.work_percent}%`
      : `${Number(emp.salary_amount).toLocaleString('ru-RU')} ₽`;
  const extra =
    emp.salary_type !== 'percent_work' && Number(emp.work_percent) > 0 ? ` · ${emp.work_percent}%` : '';
  return `${SALARY_LABELS[emp.salary_type] || emp.salary_type} · ${base}${extra}`;
}

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

function EmployeeEditModal({ employee, onClose, onSaved }) {
  const [form, setForm] = useState(() => employeeFormFromRow(employee));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    setForm(employeeFormFromRow(employee));
    setError('');
  }, [employee]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    const name = form.name.trim();
    if (name.length < 2) {
      setError('Укажите имя');
      return;
    }
    const phone = form.phone.trim();
    if (phone) {
      const phoneErr = validatePhone(phone);
      if (phoneErr) {
        setError(phoneErr);
        return;
      }
    }
    setSaving(true);
    setError('');
    try {
      await apiRequest(`/autoservice/service-employees/${employee.id}`, {
        method: 'PATCH',
        body: JSON.stringify({
          name,
          phone: phone || null,
          position: form.position.trim() || null,
          salary_type: form.salary_type,
          salary_amount: Number(form.salary_amount) || 0,
          work_percent: Number(form.work_percent) || 0,
        }),
      });
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
      open={Boolean(employee)}
      onClose={onClose}
      title="Сотрудник"
      size="sm"
      footer={
        <div className="flex justify-end gap-2">
          <button type="button" onClick={onClose} className={btnGhost} disabled={saving}>
            Отмена
          </button>
          <button type="submit" form="edit-service-employee" disabled={saving} className={btnPrimary}>
            {saving ? 'Сохранение…' : 'Сохранить'}
          </button>
        </div>
      }
    >
      <form id="edit-service-employee" onSubmit={handleSubmit} className="space-y-3">
        <div>
          <label className="block text-sm font-medium text-gray-700">Имя</label>
          <input
            className={inputClass}
            value={form.name}
            onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700">Телефон</label>
          <input
            type="tel"
            inputMode="tel"
            autoComplete="tel"
            className={inputClass}
            value={form.phone}
            onChange={(e) => setForm((p) => ({ ...p, phone: formatPhoneInput(e.target.value) }))}
            onBlur={() => setForm((p) => ({ ...p, phone: formatPhoneInput(p.phone) }))}
            placeholder="+7 (___) ___-__-__"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700">Должность</label>
          <input
            className={inputClass}
            value={form.position}
            onChange={(e) => setForm((p) => ({ ...p, position: e.target.value }))}
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700">Тип оплаты</label>
          <select
            className={inputClass}
            value={form.salary_type}
            onChange={(e) => setForm((p) => ({ ...p, salary_type: e.target.value }))}
          >
            <option value="percent_work">% от работ</option>
            <option value="fixed">Фикс</option>
            <option value="daily_rate">Ставка/день</option>
          </select>
        </div>
        {form.salary_type === 'percent_work' ? (
          <div>
            <label className="block text-sm font-medium text-gray-700">% от работы</label>
            <input
              type="number"
              min={0}
              max={100}
              className={inputClass}
              value={form.work_percent}
              onChange={(e) => setForm((p) => ({ ...p, work_percent: e.target.value }))}
            />
          </div>
        ) : (
          <div>
            <label className="block text-sm font-medium text-gray-700">Сумма, ₽</label>
            <input
              type="number"
              min={0}
              className={inputClass}
              value={form.salary_amount}
              onChange={(e) => setForm((p) => ({ ...p, salary_amount: e.target.value }))}
            />
          </div>
        )}
        {form.salary_type !== 'percent_work' ? (
          <div>
            <label className="block text-sm font-medium text-gray-700">Доп. % от работы</label>
            <input
              type="number"
              min={0}
              max={100}
              className={inputClass}
              value={form.work_percent}
              onChange={(e) => setForm((p) => ({ ...p, work_percent: e.target.value }))}
            />
          </div>
        ) : null}
        {error ? <p className="text-sm text-red-600">{error}</p> : null}
      </form>
    </Modal>
  );
}

function EmployeeStatsModal({ employee, stats, loading, period, onPeriod, onClose }) {
  const periods = [
    { id: 'day', label: 'День' },
    { id: 'week', label: 'Неделя' },
    { id: 'month', label: 'Месяц' },
    { id: 'year', label: 'Год' },
  ];

  return (
    <Modal
      open={Boolean(employee)}
      onClose={onClose}
      title={employee?.name || 'ЗП'}
      size="sm"
      footer={
        <div className="flex justify-end">
          <button type="button" onClick={onClose} className={btnGhost}>
            Закрыть
          </button>
        </div>
      }
    >
      <p className="mb-4 text-sm text-gray-500">
        {employee?.position || SALARY_LABELS[employee?.salary_type] || 'Сотрудник'}
      </p>
      <div className="flex gap-1 rounded-full bg-gray-100 p-1">
        {periods.map((p) => (
          <button
            key={p.id}
            type="button"
            onClick={() => onPeriod(p.id)}
            className={`flex-1 rounded-full py-1.5 text-xs font-medium transition ${
              period === p.id ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            {p.label}
          </button>
        ))}
      </div>
      {loading ? (
        <p className="mt-6 text-sm text-gray-500">Считаем…</p>
      ) : stats ? (
        <div className="mt-5 space-y-3">
          <div className="rounded-xl bg-gray-50 px-4 py-4">
            <p className="text-xs uppercase tracking-wide text-gray-500">ЗП</p>
            <p className="mt-1 text-3xl font-bold tabular-nums text-gray-900">
              {Number(stats.total).toLocaleString('ru-RU', { minimumFractionDigits: 2 })} ₽
            </p>
          </div>
          <div className="grid grid-cols-3 gap-2 text-center text-xs">
            <div className="rounded-xl bg-gray-50 px-2 py-3">
              <p className="text-gray-500">Работы</p>
              <p className="mt-1 font-semibold tabular-nums text-gray-900">
                {Number(stats.from_works).toLocaleString('ru-RU')}
              </p>
            </div>
            <div className="rounded-xl bg-gray-50 px-2 py-3">
              <p className="text-gray-500">День</p>
              <p className="mt-1 font-semibold tabular-nums text-gray-900">
                {Number(stats.from_daily).toLocaleString('ru-RU')}
              </p>
            </div>
            <div className="rounded-xl bg-gray-50 px-2 py-3">
              <p className="text-gray-500">Фикс</p>
              <p className="mt-1 font-semibold tabular-nums text-gray-900">
                {Number(stats.from_fixed).toLocaleString('ru-RU')}
              </p>
            </div>
          </div>
          <p className="text-xs text-gray-500">Заказов: {stats.completed_orders}</p>
        </div>
      ) : null}
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
  const [loading, setLoading] = useState(true);
  const [workZonesLoading, setWorkZonesLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [savedMessage, setSavedMessage] = useState('');
  const [zoneModal, setZoneModal] = useState(null);
  const [worksOpen, setWorksOpen] = useState(false);
  const [works, setWorks] = useState([]);
  const [worksLoading, setWorksLoading] = useState(false);
  const [employees, setEmployees] = useState([]);
  const [employeesLoading, setEmployeesLoading] = useState(false);
  const [newEmployee, setNewEmployee] = useState({
    name: '',
    salary_type: 'percent_work',
    salary_amount: '0',
    work_percent: '30',
  });
  const [bulkPercent, setBulkPercent] = useState('');
  const [statsEmployee, setStatsEmployee] = useState(null);
  const [employeeStats, setEmployeeStats] = useState(null);
  const [employeeStatsLoading, setEmployeeStatsLoading] = useState(false);
  const [employeeStatsPeriod, setEmployeeStatsPeriod] = useState('month');
  const [editingEmployee, setEditingEmployee] = useState(null);

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

  const loadEmployees = useCallback(async () => {
    setEmployeesLoading(true);
    try {
      const data = await apiRequest('/autoservice/service-employees?include_inactive=true');
      setEmployees(Array.isArray(data) ? data : []);
    } catch (e) {
      setError(e?.message || 'Не удалось загрузить сотрудников');
    } finally {
      setEmployeesLoading(false);
    }
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      await Promise.all([loadSettings(), loadWorkZones(), loadWorks(), loadEmployees()]);
    } catch (e) {
      setError(e?.message || 'Не удалось загрузить настройки');
    } finally {
      setLoading(false);
    }
  }, [loadSettings, loadWorkZones, loadWorks, loadEmployees]);

  useEffect(() => {
    if (isReady && isAuthenticated) load();
  }, [isReady, isAuthenticated, load]);

  const activeEmployees = useMemo(() => employees.filter((e) => e.is_active), [employees]);
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

  const addWork = async (payload) => {
    await apiRequest('/autoservice/works', { method: 'POST', body: JSON.stringify(payload) });
  };

  const addEmployee = async (e) => {
    e.preventDefault();
    const name = newEmployee.name.trim();
    if (name.length < 2) return;
    setError('');
    try {
      await apiRequest('/autoservice/service-employees', {
        method: 'POST',
        body: JSON.stringify({
          name,
          salary_type: newEmployee.salary_type,
          salary_amount: Number(newEmployee.salary_amount) || 0,
          work_percent: Number(newEmployee.work_percent) || 0,
        }),
      });
      setNewEmployee({ name: '', salary_type: 'percent_work', salary_amount: '0', work_percent: '30' });
      await loadEmployees();
    } catch (err) {
      setError(err?.message || 'Не удалось добавить сотрудника');
    }
  };

  const applyBulkPercent = async () => {
    const pct = Number(bulkPercent);
    if (Number.isNaN(pct) || pct < 0 || pct > 100) return;
    try {
      await apiRequest('/autoservice/service-employees/bulk-percent', {
        method: 'POST',
        body: JSON.stringify({ work_percent: pct }),
      });
      setBulkPercent('');
      await loadEmployees();
    } catch (err) {
      setError(err?.message || 'Не удалось обновить процент');
    }
  };

  const openEmployeeStats = async (employee, period = 'month') => {
    setStatsEmployee(employee);
    setEmployeeStatsPeriod(period);
    setEmployeeStats(null);
    setEmployeeStatsLoading(true);
    try {
      const data = await apiRequest(
        `/autoservice/service-employees/${employee.id}/stats?period=${encodeURIComponent(period)}`,
      );
      setEmployeeStats(data);
    } catch (err) {
      setError(err?.message || 'Не удалось загрузить ЗП');
    } finally {
      setEmployeeStatsLoading(false);
    }
  };

  const archiveEmployee = async (employeeId) => {
    if (!window.confirm('Удалить сотрудника из списка?')) return;
    setError('');
    try {
      await apiRequest(`/autoservice/service-employees/${employeeId}`, {
        method: 'PATCH',
        body: JSON.stringify({ is_active: false }),
      });
      await loadEmployees();
    } catch (err) {
      setError(err?.message || 'Не удалось удалить');
    }
  };

  const reloadEmployeeStats = async (period) => {
    if (!statsEmployee) return;
    setEmployeeStatsPeriod(period);
    setEmployeeStatsLoading(true);
    try {
      const data = await apiRequest(
        `/autoservice/service-employees/${statsEmployee.id}/stats?period=${encodeURIComponent(period)}`,
      );
      setEmployeeStats(data);
    } catch (err) {
      setError(err?.message || 'Не удалось загрузить ЗП');
    } finally {
      setEmployeeStatsLoading(false);
    }
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
          { id: 'employees', label: 'Сотрудники' },
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
                  {workZonesLoading ? 'Загрузка…' : `${workZones.length} зон`}
                </p>
                <button type="button" onClick={() => setZoneModal({ mode: 'create' })} className={btnPrimary}>
                  Добавить
                </button>
              </div>
              <div className="hidden md:block">
                <table className="min-w-full divide-y divide-gray-200 text-sm">
                  <thead>
                    <tr className="text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
                      <th className="py-3 pr-3">Название</th>
                      <th className="w-40 py-3 text-right">Действия</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {workZonesLoading ? (
                      <tr>
                        <td colSpan={2} className="py-12 text-center text-gray-500">
                          Загрузка…
                        </td>
                      </tr>
                    ) : workZones.length === 0 ? (
                      <tr>
                        <td colSpan={2} className="py-12 text-center text-gray-500">
                          Зон пока нет
                        </td>
                      </tr>
                    ) : (
                      workZones.map((zone) => (
                        <tr key={zone.id} className="transition-colors hover:bg-gray-50/70">
                          <td className="py-3 pr-3 align-middle font-medium text-gray-900">{zone.name}</td>
                          <td className="py-3 text-right align-middle">
                            <ActionsDropdown
                              menuClassName="w-40 z-50"
                              estimatedMenuHeight={100}
                              showLabel
                              buttonClassName="inline-flex h-9 items-center gap-1.5 rounded-lg border border-gray-300 bg-white px-2.5 text-sm font-medium text-gray-700 transition hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-1"
                            >
                              <ActionsDropdownItem onClick={() => setZoneModal({ mode: 'edit', zone })}>
                                Изменить
                              </ActionsDropdownItem>
                              <ActionsDropdownItem danger onClick={() => removeWorkZone(zone.id)}>
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
                {workZonesLoading ? (
                  <p className="py-10 text-center text-sm text-gray-500">Загрузка…</p>
                ) : workZones.length === 0 ? (
                  <p className="py-10 text-center text-sm text-gray-500">Зон пока нет</p>
                ) : (
                  workZones.map((zone) => (
                    <div key={zone.id} className="flex items-center justify-between gap-3 border-b border-gray-100 py-3 last:border-b-0">
                      <p className="min-w-0 truncate text-sm font-semibold text-gray-900">{zone.name}</p>
                      <ActionsDropdown
                        menuClassName="w-40 z-50"
                        estimatedMenuHeight={100}
                        showLabel={false}
                        buttonClassName="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-gray-300 bg-white text-gray-700 transition hover:bg-gray-50"
                      >
                        <ActionsDropdownItem onClick={() => setZoneModal({ mode: 'edit', zone })}>
                          Изменить
                        </ActionsDropdownItem>
                        <ActionsDropdownItem danger onClick={() => removeWorkZone(zone.id)}>
                          Удалить
                        </ActionsDropdownItem>
                      </ActionsDropdown>
                    </div>
                  ))
                )}
              </div>
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

          {tab === 'employees' ? (
            <section>
              <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-sm text-gray-500">
                  {employeesLoading ? 'Загрузка…' : `${activeEmployees.length} сотрудников`}
                </p>
                <div className="flex flex-wrap items-center gap-2">
                  <input
                    type="number"
                    min={0}
                    max={100}
                    className="h-10 w-20 rounded-full border-0 bg-gray-100 px-3 text-sm text-gray-700 outline-none focus:bg-white focus:ring-2 focus:ring-indigo-400/70"
                    placeholder="%"
                    value={bulkPercent}
                    onChange={(e) => setBulkPercent(e.target.value)}
                    aria-label="Процент для всех"
                  />
                  <button type="button" className={btnGhost} onClick={applyBulkPercent}>
                    % всем
                  </button>
                </div>
              </div>

              <form
                onSubmit={addEmployee}
                className="mb-5 grid gap-2 rounded-xl bg-gray-50 p-3 sm:grid-cols-[1.4fr_1fr_0.8fr_auto]"
              >
                <input
                  className={fieldClass}
                  placeholder="Имя"
                  value={newEmployee.name}
                  onChange={(e) => setNewEmployee((p) => ({ ...p, name: e.target.value }))}
                />
                <select
                  className={fieldClass}
                  value={newEmployee.salary_type}
                  onChange={(e) => setNewEmployee((p) => ({ ...p, salary_type: e.target.value }))}
                >
                  <option value="percent_work">% от работ</option>
                  <option value="fixed">Фикс</option>
                  <option value="daily_rate">Ставка/день</option>
                </select>
                <input
                  type="number"
                  min={0}
                  className={fieldClass}
                  placeholder={newEmployee.salary_type === 'percent_work' ? '%' : '₽'}
                  value={
                    newEmployee.salary_type === 'percent_work'
                      ? newEmployee.work_percent
                      : newEmployee.salary_amount
                  }
                  onChange={(e) =>
                    setNewEmployee((p) => ({
                      ...p,
                      ...(p.salary_type === 'percent_work'
                        ? { work_percent: e.target.value }
                        : { salary_amount: e.target.value }),
                    }))
                  }
                />
                <button type="submit" className={btnPrimary}>
                  Добавить
                </button>
              </form>

              <div className="hidden md:block">
                <table className="min-w-full divide-y divide-gray-200 text-sm">
                  <thead>
                    <tr className="text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
                      <th className="py-3 pr-3">Сотрудник</th>
                      <th className="py-3 pr-3">Оплата</th>
                      <th className="w-28 py-3 text-right">Действия</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {employeesLoading ? (
                      <tr>
                        <td colSpan={3} className="py-12 text-center text-gray-500">
                          Загрузка…
                        </td>
                      </tr>
                    ) : activeEmployees.length === 0 ? (
                      <tr>
                        <td colSpan={3} className="py-12 text-center text-gray-500">
                          Сотрудников пока нет
                        </td>
                      </tr>
                    ) : (
                      activeEmployees.map((emp) => (
                        <tr
                          key={emp.id}
                          className="cursor-pointer transition-colors hover:bg-gray-50/70"
                          onDoubleClick={(e) => {
                            if (e.target.closest('.actions-dropdown')) return;
                            setEditingEmployee(emp);
                          }}
                        >
                          <td className="py-3 pr-3 align-middle">
                            <div className="font-medium text-gray-900">{emp.name}</div>
                            {emp.position ? (
                              <div className="mt-0.5 text-xs text-gray-500">{emp.position}</div>
                            ) : null}
                          </td>
                          <td className="py-3 pr-3 align-middle text-gray-600">{salarySummary(emp)}</td>
                          <td className="py-3 text-right align-middle">
                            <ActionsDropdown
                              menuClassName="w-40 z-50"
                              estimatedMenuHeight={100}
                              showLabel
                              buttonClassName="inline-flex h-9 items-center gap-1.5 rounded-lg border border-gray-300 bg-white px-2.5 text-sm font-medium text-gray-700 transition hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-1"
                            >
                              <ActionsDropdownItem onClick={() => setEditingEmployee(emp)}>
                                Изменить
                              </ActionsDropdownItem>
                              <ActionsDropdownItem danger onClick={() => archiveEmployee(emp.id)}>
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
                {employeesLoading ? (
                  <p className="py-10 text-center text-sm text-gray-500">Загрузка…</p>
                ) : activeEmployees.length === 0 ? (
                  <p className="py-10 text-center text-sm text-gray-500">Сотрудников пока нет</p>
                ) : (
                  activeEmployees.map((emp) => (
                    <div
                      key={emp.id}
                      className="flex cursor-pointer items-start justify-between gap-3 border-b border-gray-100 py-3 last:border-b-0"
                      onDoubleClick={(e) => {
                        if (e.target.closest('.actions-dropdown')) return;
                        setEditingEmployee(emp);
                      }}
                    >
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-semibold text-gray-900">{emp.name}</p>
                        <p className="mt-0.5 text-xs text-gray-500">{salarySummary(emp)}</p>
                      </div>
                      <ActionsDropdown
                        menuClassName="w-40 z-50"
                        estimatedMenuHeight={100}
                        showLabel={false}
                        buttonClassName="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-gray-300 bg-white text-gray-700 transition hover:bg-gray-50"
                      >
                        <ActionsDropdownItem onClick={() => setEditingEmployee(emp)}>Изменить</ActionsDropdownItem>
                        <ActionsDropdownItem danger onClick={() => archiveEmployee(emp.id)}>
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

      {editingEmployee ? (
        <EmployeeEditModal
          employee={editingEmployee}
          onClose={() => setEditingEmployee(null)}
          onSaved={loadEmployees}
        />
      ) : null}

      <EmployeeStatsModal
        employee={statsEmployee}
        stats={employeeStats}
        loading={employeeStatsLoading}
        period={employeeStatsPeriod}
        onPeriod={reloadEmployeeStats}
        onClose={() => {
          setStatsEmployee(null);
          setEmployeeStats(null);
        }}
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
