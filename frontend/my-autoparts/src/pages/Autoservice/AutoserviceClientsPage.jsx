import React, { useCallback, useEffect, useState } from 'react';
import { useAuthReady } from '../../hooks/useAuthReady';
import AuthLoadingScreen from '../../components/AuthLoadingScreen/AuthLoadingScreen';
import { apiRequest } from '../../utils/apiClient';
import { formatPhoneInput, validatePhone } from '../../utils/contactValidation';
import { formatServerDateTime } from '../../utils/serverDate';

const inputClass =
  'mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm shadow-sm focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20';

const SOURCE_LABELS = {
  self: 'Сам',
  staff: 'Сотрудник',
};

function Modal({ title, children, onClose }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <button type="button" className="absolute inset-0 bg-black/40" aria-label="Закрыть" onClick={onClose} />
      <div className="relative max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-white shadow-xl ring-1 ring-gray-200">
        <div className="flex items-center justify-between border-b border-gray-100 px-5 py-4">
          <h3 className="text-lg font-semibold text-gray-900">{title}</h3>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-700"
            aria-label="Закрыть"
          >
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <div className="p-5">{children}</div>
      </div>
    </div>
  );
}

function AddClientModal({ onClose, onCreated }) {
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [phoneError, setPhoneError] = useState('');
  const [error, setError] = useState(null);
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setPhoneError('');
    const trimmedName = name.trim();
    if (trimmedName.length < 2) {
      setError('Укажите имя');
      return;
    }
    const phoneErr = validatePhone(phone);
    if (phoneErr) {
      setPhoneError(phoneErr);
      return;
    }
    setSaving(true);
    try {
      const row = await apiRequest('/autoservice/clients', {
        method: 'POST',
        body: JSON.stringify({
          name: trimmedName,
          phone,
        }),
      });
      onCreated(row);
      onClose();
    } catch (err) {
      setError(err?.message || 'Не удалось добавить клиента');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal title="Добавить клиента" onClose={onClose}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700">Имя</label>
          <input
            className={inputClass}
            value={name}
            onChange={(e) => setName(e.target.value)}
            disabled={saving}
            required
            maxLength={120}
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700">Телефон</label>
          <input
            type="tel"
            className={`${inputClass} ${phoneError ? 'border-red-500' : ''}`}
            value={phone}
            onChange={(e) => {
              setPhone(formatPhoneInput(e.target.value));
              setPhoneError('');
            }}
            placeholder="+7 (___) ___-__-__"
            disabled={saving}
            required
          />
          {phoneError && <p className="mt-1 text-sm text-red-600">{phoneError}</p>}
        </div>
        {error && <p className="text-sm text-red-600">{error}</p>}
        <div className="flex justify-end gap-2 pt-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100"
            disabled={saving}
          >
            Отмена
          </button>
          <button
            type="submit"
            disabled={saving}
            className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-60"
          >
            {saving ? 'Сохранение…' : 'Добавить'}
          </button>
        </div>
      </form>
    </Modal>
  );
}

export default function AutoserviceClientsPage() {
  const { isReady, user, isAuthenticated } = useAuthReady();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [addOpen, setAddOpen] = useState(false);
  const [expandedClientId, setExpandedClientId] = useState(null);
  const [clientVehicles, setClientVehicles] = useState({});
  const [vehiclesLoadingId, setVehiclesLoadingId] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await apiRequest('/autoservice/clients');
      setRows(Array.isArray(data) ? data : []);
    } catch (err) {
      setError(err?.message || 'Не удалось загрузить клиентов');
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isReady && isAuthenticated) {
      load();
    }
  }, [isReady, isAuthenticated, load]);

  const toggleClientVehicles = async (clientId) => {
    if (expandedClientId === clientId) {
      setExpandedClientId(null);
      return;
    }
    setExpandedClientId(clientId);
    if (clientVehicles[clientId]) return;
    setVehiclesLoadingId(clientId);
    try {
      const data = await apiRequest(`/autoservice/garage/vehicles?client_id=${clientId}`);
      setClientVehicles((prev) => ({ ...prev, [clientId]: Array.isArray(data) ? data : [] }));
    } catch {
      setClientVehicles((prev) => ({ ...prev, [clientId]: [] }));
    } finally {
      setVehiclesLoadingId(null);
    }
  };

  if (!isReady) return <AuthLoadingScreen />;
  if (!isAuthenticated || !user) return null;

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Клиенты автосервиса</h1>
          <p className="mt-1 text-sm text-gray-500">Согласившиеся и добавленные вручную</p>
        </div>
        <button
          type="button"
          onClick={() => setAddOpen(true)}
          className="inline-flex items-center justify-center rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-indigo-700"
        >
          Добавить
        </button>
      </div>

      <div className="mt-6">
        <button
          type="button"
          onClick={load}
          className="rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50"
        >
          Обновить
        </button>
      </div>

      {error && (
        <p className="mt-4 text-sm text-red-600" role="alert">
          {error}
        </p>
      )}

      <div className="mt-6 overflow-x-auto rounded-xl border border-gray-200 bg-white shadow-sm">
        <table className="min-w-full divide-y divide-gray-200 text-sm">
          <thead className="bg-gray-50 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
            <tr>
              <th className="px-4 py-3">Имя</th>
              <th className="px-4 py-3">Телефон</th>
              <th className="px-4 py-3">Источник</th>
              <th className="px-4 py-3">Согласие</th>
              <th className="px-4 py-3">Аккаунт</th>
              <th className="px-4 py-3">Авто</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {loading ? (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-gray-500">
                  Загрузка…
                </td>
              </tr>
            ) : rows.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-gray-500">
                  Клиентов пока нет
                </td>
              </tr>
            ) : (
              rows.map((row) => (
                <React.Fragment key={row.id}>
                  <tr className="hover:bg-gray-50/80">
                    <td className="px-4 py-3 font-medium text-gray-900">{row.name}</td>
                    <td className="whitespace-nowrap px-4 py-3 text-gray-700">{row.phone}</td>
                    <td className="whitespace-nowrap px-4 py-3 text-gray-600">
                      {SOURCE_LABELS[row.source] || row.source}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-gray-600">
                      {formatServerDateTime(row.consented_at)}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3">
                      {row.user_id ? (
                        <span className="inline-flex rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-medium text-emerald-800 ring-1 ring-inset ring-emerald-200">
                          Есть
                        </span>
                      ) : (
                        <span className="inline-flex rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-medium text-gray-600 ring-1 ring-inset ring-gray-200">
                          Гость
                        </span>
                      )}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3">
                      <button
                        type="button"
                        onClick={() => toggleClientVehicles(row.id)}
                        className="text-sm font-medium text-indigo-700 hover:underline"
                      >
                        {expandedClientId === row.id ? 'Скрыть' : 'Показать'}
                      </button>
                    </td>
                  </tr>
                  {expandedClientId === row.id && (
                    <tr className="bg-gray-50/50">
                      <td colSpan={6} className="px-4 py-3">
                        {vehiclesLoadingId === row.id ? (
                          <p className="text-sm text-gray-500">Загрузка автомобилей…</p>
                        ) : (clientVehicles[row.id] || []).length === 0 ? (
                          <p className="text-sm text-gray-500">Автомобилей нет</p>
                        ) : (
                          <ul className="space-y-2">
                            {(clientVehicles[row.id] || []).map((v) => (
                              <li key={v.id} className="text-sm text-gray-700">
                                <span className="font-medium text-gray-900">
                                  {v.make} {v.model}
                                  {v.year ? `, ${v.year}` : ''}
                                </span>
                                {v.vin ? ` · VIN ${v.vin}` : ''}
                                {v.plate ? ` · ${v.plate}` : ''}
                              </li>
                            ))}
                          </ul>
                        )}
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              ))
            )}
          </tbody>
        </table>
      </div>

      {addOpen && (
        <AddClientModal
          onClose={() => setAddOpen(false)}
          onCreated={(row) => {
            setRows((prev) => [row, ...prev.filter((r) => r.id !== row.id)]);
          }}
        />
      )}
    </div>
  );
}
