import { useCallback, useEffect, useState } from 'react';
import { useAuthReady } from '../../hooks/useAuthReady';
import AuthLoadingScreen from '../../components/AuthLoadingScreen/AuthLoadingScreen';
import { apiRequest } from '../../utils/apiClient';

const inputClass =
  'mt-1 block w-full max-w-xl rounded-lg border border-gray-300 px-3 py-2.5 text-sm shadow-sm focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20';

const wideInputClass = inputClass;

const btnPrimary = 'rounded-xl bg-[#00a046] px-4 py-2 text-sm font-semibold text-white hover:bg-[#008f3e]';
const btnGhost = 'rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50';

const SALARY_LABELS = {
  fixed: 'Фикс',
  percent_work: '% от работ',
  daily_rate: 'Ставка/день',
};

function WorksModal({ works, loading, onClose, onAdd, onRefresh }) {
  const [name, setName] = useState('');
  const [price, setPrice] = useState('');
  const [saving, setSaving] = useState(false);

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

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <button type="button" className="absolute inset-0 bg-black/40" aria-label="Закрыть" onClick={onClose} />
      <div className="relative max-h-[90vh] w-full max-w-xl overflow-y-auto rounded-2xl bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-gray-100 px-5 py-4">
          <h3 className="text-lg font-semibold text-gray-900">Работы</h3>
          <button type="button" onClick={onClose} className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100">×</button>
        </div>
        <form onSubmit={handleAdd} className="border-b border-gray-100 p-4">
          <div className="flex items-end gap-2">
            <div className="min-w-0 flex-1">
              <label htmlFor="work-name" className="mb-1 block text-xs font-medium text-gray-500">
                Название
              </label>
              <input
                id="work-name"
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
                placeholder="Например, замена масла"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>
            <div className="w-36 shrink-0 sm:w-40">
              <label htmlFor="work-price" className="mb-1 block text-xs font-medium text-gray-500">
                Цена, ₽
              </label>
              <input
                id="work-price"
                type="text"
                inputMode="decimal"
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
                placeholder=""
                value={price}
                onChange={(e) => setPrice(e.target.value)}
              />
            </div>
            <button type="submit" disabled={saving} className={`${btnPrimary} mb-0.5 shrink-0 px-3`}>
              +
            </button>
          </div>
        </form>
        <div className="p-4">
          {loading ? (
            <p className="text-sm text-gray-500">Загрузка…</p>
          ) : works.length === 0 ? (
            <p className="text-sm text-gray-500">Пока пусто</p>
          ) : (
            <ul className="divide-y divide-gray-100">
              {works.filter((w) => w.is_active).map((w) => (
                <li key={w.id} className="flex items-center justify-between py-2.5 text-sm">
                  <span className="font-medium text-gray-900">{w.name}</span>
                  <span className="text-gray-600">{Number(w.default_unit_price).toLocaleString('ru-RU')} ₽</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}

function employeeFormFromRow(emp) {
  return {
    name: emp?.name || '',
    phone: emp?.phone || '',
    position: emp?.position || '',
    salary_type: emp?.salary_type || 'percent_work',
    salary_amount: emp?.salary_amount != null ? String(emp.salary_amount) : '0',
    work_percent: emp?.work_percent != null ? String(emp.work_percent) : '0',
  };
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
    setSaving(true);
    setError('');
    try {
      await apiRequest(`/autoservice/service-employees/${employee.id}`, {
        method: 'PATCH',
        body: JSON.stringify({
          name,
          phone: form.phone.trim() || null,
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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <button type="button" className="absolute inset-0 bg-black/40" aria-label="Закрыть" onClick={onClose} />
      <div className="relative w-full max-w-md rounded-2xl bg-white p-5 shadow-xl">
        <div className="flex items-start justify-between gap-2">
          <h3 className="text-lg font-semibold text-gray-900">Сотрудник</h3>
          <button type="button" onClick={onClose} className="text-gray-400 hover:text-gray-700">×</button>
        </div>
        <form onSubmit={handleSubmit} className="mt-4 space-y-3">
          <input
            className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
            placeholder="Имя"
            value={form.name}
            onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
          />
          <input
            className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
            placeholder="Телефон"
            value={form.phone}
            onChange={(e) => setForm((p) => ({ ...p, phone: e.target.value }))}
          />
          <input
            className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
            placeholder="Должность"
            value={form.position}
            onChange={(e) => setForm((p) => ({ ...p, position: e.target.value }))}
          />
          <select
            className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
            value={form.salary_type}
            onChange={(e) => setForm((p) => ({ ...p, salary_type: e.target.value }))}
          >
            <option value="percent_work">% от работ</option>
            <option value="fixed">Фикс</option>
            <option value="daily_rate">Ставка/день</option>
          </select>
          {form.salary_type === 'percent_work' ? (
            <input
              type="number"
              min={0}
              max={100}
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
              placeholder="% от работы"
              value={form.work_percent}
              onChange={(e) => setForm((p) => ({ ...p, work_percent: e.target.value }))}
            />
          ) : (
            <input
              type="number"
              min={0}
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
              placeholder="₽"
              value={form.salary_amount}
              onChange={(e) => setForm((p) => ({ ...p, salary_amount: e.target.value }))}
            />
          )}
          {form.salary_type !== 'percent_work' ? (
            <input
              type="number"
              min={0}
              max={100}
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
              placeholder="% от работы"
              value={form.work_percent}
              onChange={(e) => setForm((p) => ({ ...p, work_percent: e.target.value }))}
            />
          ) : null}
          {error ? <p className="text-sm text-red-600">{error}</p> : null}
          <button type="submit" disabled={saving} className={`w-full ${btnPrimary} py-2.5 disabled:opacity-60`}>
            {saving ? 'Сохранение…' : 'Сохранить'}
          </button>
        </form>
      </div>
    </div>
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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <button type="button" className="absolute inset-0 bg-black/40" aria-label="Закрыть" onClick={onClose} />
      <div className="relative w-full max-w-md rounded-2xl bg-white p-5 shadow-xl">
        <div className="flex items-start justify-between gap-2">
          <div>
            <h3 className="text-lg font-semibold text-gray-900">{employee?.name}</h3>
            <p className="text-sm text-gray-500">{employee?.position || SALARY_LABELS[employee?.salary_type]}</p>
          </div>
          <button type="button" onClick={onClose} className="text-gray-400 hover:text-gray-700">×</button>
        </div>
        <div className="mt-4 flex gap-1 rounded-xl bg-gray-100 p-1">
          {periods.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => onPeriod(p.id)}
              className={`flex-1 rounded-lg py-1.5 text-xs font-medium ${
                period === p.id ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-600'
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
            <div className="rounded-xl bg-[#f7f7f5] p-4">
              <p className="text-xs uppercase text-gray-500">ЗП</p>
              <p className="text-3xl font-bold text-gray-900">
                {Number(stats.total).toLocaleString('ru-RU', { minimumFractionDigits: 2 })} ₽
              </p>
            </div>
            <div className="grid grid-cols-3 gap-2 text-center text-xs">
              <div className="rounded-lg border border-gray-100 p-2">
                <p className="text-gray-500">Работы</p>
                <p className="font-semibold text-gray-900">{Number(stats.from_works).toLocaleString('ru-RU')}</p>
              </div>
              <div className="rounded-lg border border-gray-100 p-2">
                <p className="text-gray-500">День</p>
                <p className="font-semibold text-gray-900">{Number(stats.from_daily).toLocaleString('ru-RU')}</p>
              </div>
              <div className="rounded-lg border border-gray-100 p-2">
                <p className="text-gray-500">Фикс</p>
                <p className="font-semibold text-gray-900">{Number(stats.from_fixed).toLocaleString('ru-RU')}</p>
              </div>
            </div>
            <p className="text-xs text-gray-500">Заказов: {stats.completed_orders}</p>
          </div>
        ) : null}
      </div>
    </div>
  );
}


export default function AutoserviceSettingsPage() {
  const { isReady, isAuthenticated, user } = useAuthReady();
  const [publicName, setPublicName] = useState('');
  const [publicDescription, setPublicDescription] = useState('');
  const [workZones, setWorkZones] = useState([]);
  const [loading, setLoading] = useState(true);
  const [workZonesLoading, setWorkZonesLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [savedMessage, setSavedMessage] = useState('');
  const [editingZoneId, setEditingZoneId] = useState(null);
  const [editingName, setEditingName] = useState('');
  const [actionMenuId, setActionMenuId] = useState(null);
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
  const [employeeActionMenuId, setEmployeeActionMenuId] = useState(null);
  const [editingEmployee, setEditingEmployee] = useState(null);

  const loadSettings = useCallback(async () => {
    const data = await apiRequest('/autoservice/settings');
    setPublicName(data?.public_name || '');
    setPublicDescription(data?.public_description || '');
  }, []);

  const loadWorkZones = useCallback(async () => {
    setWorkZonesLoading(true);
    try {
      const data = await apiRequest('/autoservice/work-zones?include_archived=true');
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

  const handleAddWorkZone = async () => {
    setError('');
    try {
      await apiRequest('/autoservice/work-zones', { method: 'POST', body: JSON.stringify({}) });
      await loadWorkZones();
    } catch (err) {
      setError(err?.message || 'Не удалось добавить рабочую зону');
    }
  };

  const startRename = (zone) => {
    setEditingZoneId(zone.id);
    setEditingName(zone.name);
    setActionMenuId(null);
  };

  const saveRename = async (zoneId) => {
    const name = editingName.trim();
    if (!name) return;
    try {
      await apiRequest(`/autoservice/work-zones/${zoneId}`, {
        method: 'PATCH',
        body: JSON.stringify({ name }),
      });
      setEditingZoneId(null);
      await loadWorkZones();
    } catch (err) {
      setError(err?.message || 'Не удалось переименовать');
    }
  };

  const removeWorkZone = async (zoneId) => {
    setActionMenuId(null);
    if (!window.confirm('Удалить или архивировать рабочую зону?')) return;
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
    setEmployeeActionMenuId(null);
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

  const startEditEmployee = (employee) => {
    setEmployeeActionMenuId(null);
    setEditingEmployee(employee);
  };

  const archiveEmployee = async (employeeId) => {
    setEmployeeActionMenuId(null);
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
    <div className="mx-auto max-w-4xl px-4 py-8">
      <h1 className="text-2xl font-bold text-gray-900">Настройки автосервиса</h1>
      <p className="mt-1 text-sm text-gray-500">Параметры организации для записей и слотов</p>

      {error && (
        <p className="mt-4 text-sm text-red-600" role="alert">
          {error}
        </p>
      )}
      {savedMessage && !error && (
        <p className="mt-4 text-sm text-emerald-700" role="status">
          {savedMessage}
        </p>
      )}

      {loading ? (
        <p className="mt-8 text-sm text-gray-500">Загрузка…</p>
      ) : (
        <>
          <form onSubmit={handleSave} className="mt-8 space-y-6">
            <div>
              <label htmlFor="public_name" className="block text-sm font-medium text-gray-700">
                Название автосервиса
              </label>
              <input
                id="public_name"
                value={publicName}
                onChange={(ev) => setPublicName(ev.target.value)}
                maxLength={160}
                className={wideInputClass}
              />
            </div>
            <div>
              <label htmlFor="public_description" className="block text-sm font-medium text-gray-700">
                Описание
              </label>
              <textarea
                id="public_description"
                rows={3}
                value={publicDescription}
                onChange={(ev) => setPublicDescription(ev.target.value)}
                maxLength={2000}
                className={wideInputClass}
              />
            </div>
            <button
              type="submit"
              disabled={saving}
              className="inline-flex items-center justify-center rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-60"
            >
              {saving ? 'Сохранение…' : 'Сохранить'}
            </button>
          </form>

          <section className="mt-10 rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold text-gray-900">Рабочие зоны</h2>
                <p className="text-sm text-gray-500">Управление рабочими местами организации</p>
              </div>
              <button
                type="button"
                onClick={handleAddWorkZone}
                className="rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700"
              >
                Добавить рабочую зону
              </button>
            </div>

            <div className="mt-4 overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200 text-sm">
                <thead className="bg-gray-50 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
                  <tr>
                    <th className="px-4 py-3">Название</th>
                    <th className="px-4 py-3">Статус</th>
                    <th className="px-4 py-3 text-right">Действия</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {workZonesLoading ? (
                    <tr>
                      <td colSpan={3} className="px-4 py-8 text-center text-gray-500">Загрузка…</td>
                    </tr>
                  ) : workZones.length === 0 ? (
                    <tr>
                      <td colSpan={3} className="px-4 py-8 text-center text-gray-500">Рабочих зон пока нет</td>
                    </tr>
                  ) : (
                    workZones.map((zone) => (
                      <tr key={zone.id} className="hover:bg-gray-50/80">
                        <td className="px-4 py-3">
                          {editingZoneId === zone.id ? (
                            <input
                              className="w-full rounded-lg border border-gray-300 px-2 py-1"
                              value={editingName}
                              onChange={(e) => setEditingName(e.target.value)}
                              onBlur={() => saveRename(zone.id)}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') saveRename(zone.id);
                                if (e.key === 'Escape') setEditingZoneId(null);
                              }}
                              autoFocus
                            />
                          ) : (
                            <span className="font-medium text-gray-900">{zone.name}</span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          {zone.is_active ? (
                            <span className="inline-flex rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-medium text-emerald-800 ring-1 ring-inset ring-emerald-200">
                              Активна
                            </span>
                          ) : (
                            <span className="inline-flex rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-medium text-gray-600 ring-1 ring-inset ring-gray-200">
                              Архив
                            </span>
                          )}
                        </td>
                        <td className="relative px-4 py-3 text-right">
                          <button
                            type="button"
                            onClick={() => setActionMenuId(actionMenuId === zone.id ? null : zone.id)}
                            className="rounded-lg px-3 py-1.5 text-sm font-medium text-indigo-700 hover:bg-indigo-50"
                          >
                            Действия
                          </button>
                          {actionMenuId === zone.id ? (
                            <div className="absolute right-4 z-10 mt-1 w-44 rounded-xl border border-gray-200 bg-white py-1 text-left shadow-lg">
                              <button type="button" className="block w-full px-3 py-2 text-left text-sm hover:bg-gray-50" onClick={() => startRename(zone)}>Переименовать</button>
                              <button type="button" className="block w-full px-3 py-2 text-left text-sm text-red-700 hover:bg-red-50" onClick={() => removeWorkZone(zone.id)}>Удалить</button>
                            </div>
                          ) : null}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </section>

          <section className="mt-8 rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="text-lg font-semibold text-gray-900">Работы</h2>
              <button type="button" className={btnGhost} onClick={() => setWorksOpen(true)}>
                Посмотреть работы
              </button>
            </div>
          </section>

          <section className="mt-8 rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="text-lg font-semibold text-gray-900">Сотрудники</h2>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min={0}
                  max={100}
                  className="w-16 rounded-lg border border-gray-200 px-2 py-1.5 text-sm"
                  placeholder="%"
                  value={bulkPercent}
                  onChange={(e) => setBulkPercent(e.target.value)}
                />
                <button type="button" className={btnGhost} onClick={applyBulkPercent}>
                  % всем
                </button>
              </div>
            </div>
            <form onSubmit={addEmployee} className="mt-4 grid gap-2 sm:grid-cols-5">
              <input
                className="rounded-lg border border-gray-200 px-3 py-2 text-sm sm:col-span-2"
                placeholder="Имя"
                value={newEmployee.name}
                onChange={(e) => setNewEmployee((p) => ({ ...p, name: e.target.value }))}
              />
              <select
                className="rounded-lg border border-gray-200 px-3 py-2 text-sm"
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
                className="rounded-lg border border-gray-200 px-3 py-2 text-sm"
                placeholder={newEmployee.salary_type === 'percent_work' ? '%' : '₽'}
                value={newEmployee.salary_type === 'percent_work' ? newEmployee.work_percent : newEmployee.salary_amount}
                onChange={(e) => setNewEmployee((p) => ({
                  ...p,
                  ...(p.salary_type === 'percent_work'
                    ? { work_percent: e.target.value }
                    : { salary_amount: e.target.value }),
                }))}
              />
              <button type="submit" className={btnPrimary}>+</button>
            </form>
            <ul className="mt-4 divide-y divide-gray-100">
              {employeesLoading ? (
                <li className="py-4 text-sm text-gray-500">Загрузка…</li>
              ) : employees.filter((e) => e.is_active).length === 0 ? (
                <li className="py-4 text-sm text-gray-500">Пока нет</li>
              ) : (
                employees.filter((e) => e.is_active).map((emp) => (
                  <li key={emp.id} className="relative flex items-center justify-between gap-3 py-3">
                    <div className="min-w-0 flex-1">
                      <p className="font-medium text-gray-900">{emp.name}</p>
                      <p className="text-xs text-gray-500">
                        {SALARY_LABELS[emp.salary_type]}
                        {emp.salary_type === 'percent_work'
                          ? ` · ${emp.work_percent}%`
                          : ` · ${Number(emp.salary_amount).toLocaleString('ru-RU')} ₽`}
                        {emp.salary_type !== 'percent_work' && Number(emp.work_percent) > 0
                          ? ` · ${emp.work_percent}%`
                          : ''}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setEmployeeActionMenuId(employeeActionMenuId === emp.id ? null : emp.id)}
                      className="shrink-0 rounded-lg px-3 py-1.5 text-sm font-medium text-[#00a046] hover:bg-green-50"
                    >
                      Действия
                    </button>
                    {employeeActionMenuId === emp.id ? (
                      <div className="absolute right-0 top-full z-10 mt-1 w-40 rounded-xl border border-gray-200 bg-white py-1 shadow-lg">
                        <button
                          type="button"
                          className="block w-full px-3 py-2 text-left text-sm hover:bg-gray-50"
                          onClick={() => startEditEmployee(emp)}
                        >
                          Изменить
                        </button>
                        <button
                          type="button"
                          className="block w-full px-3 py-2 text-left text-sm hover:bg-gray-50"
                          onClick={() => openEmployeeStats(emp)}
                        >
                          ЗП
                        </button>
                        <button
                          type="button"
                          className="block w-full px-3 py-2 text-left text-sm text-red-700 hover:bg-red-50"
                          onClick={() => archiveEmployee(emp.id)}
                        >
                          Удалить
                        </button>
                      </div>
                    ) : null}
                  </li>
                ))
              )}
            </ul>
          </section>
        </>
      )}

      {worksOpen ? (
        <WorksModal
          works={works}
          loading={worksLoading}
          onClose={() => setWorksOpen(false)}
          onAdd={addWork}
          onRefresh={loadWorks}
        />
      ) : null}

      {editingEmployee ? (
        <EmployeeEditModal
          employee={editingEmployee}
          onClose={() => setEditingEmployee(null)}
          onSaved={loadEmployees}
        />
      ) : null}

      {statsEmployee ? (
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
      ) : null}

    </div>
  );
}
