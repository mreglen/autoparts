import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthReady } from '../../hooks/useAuthReady';
import { useDebouncedValue } from '../../hooks/useDebouncedCallback';
import AutoserviceLiveSearchField from '../../components/Autoservice/AutoserviceLiveSearchField';
import AuthLoadingScreen from '../../components/AuthLoadingScreen/AuthLoadingScreen';
import Modal from '../../components/UI/Modal';
import { apiRequest } from '../../utils/apiClient';
import { formatPhoneInput, validatePhone } from '../../utils/contactValidation';
import { formatServerDateTime } from '../../utils/serverDate';
import { normalizeVinOrNull, sanitizeVinInput, VIN_INPUT_MAX_LENGTH } from '../../utils/laximoVin';

const inputClass =
  'mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20';

function AccountBadge({ userId }) {
  if (userId) {
    return (
      <span className="inline-flex rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-medium text-emerald-800 ring-1 ring-inset ring-emerald-200">
        Есть
      </span>
    );
  }
  return (
    <span className="inline-flex rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-medium text-gray-600 ring-1 ring-inset ring-gray-200">
      Гость
    </span>
  );
}

function VehicleList({ vehicles, loading, canEdit = false, onEdit, onVinClick }) {
  if (loading) {
    return <p className="text-sm text-gray-500">Загрузка автомобилей…</p>;
  }
  if (!vehicles?.length) {
    return <p className="text-sm text-gray-500">Автомобилей нет</p>;
  }
  return (
    <ul className="space-y-2">
      {vehicles.map((v) => (
        <li key={v.id} className="flex items-start justify-between gap-3 text-sm text-gray-700">
          <div className="min-w-0">
            <span className="font-medium text-gray-900">
              {v.make} {v.model}
              {v.year ? `, ${v.year}` : ''}
            </span>
            {v.vin ? (
              <>
                {' · '}
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onVinClick?.(v.vin);
                  }}
                  className="font-mono text-indigo-600 underline decoration-indigo-300 underline-offset-2 transition hover:text-indigo-800 hover:decoration-indigo-600"
                  title="Открыть VIN-каталог"
                >
                  VIN {v.vin}
                </button>
              </>
            ) : null}
            {v.plate ? ` · ${v.plate}` : ''}
            {v.color ? ` · ${v.color}` : ''}
          </div>
          {canEdit ? (
            <button
              type="button"
              onClick={() => onEdit?.(v)}
              className="shrink-0 rounded-lg px-2 py-1 text-sm font-medium text-indigo-700 transition hover:bg-indigo-50"
            >
              Изменить
            </button>
          ) : null}
        </li>
      ))}
    </ul>
  );
}

function ClientVehiclesModal({
  open,
  client,
  vehicles,
  loading,
  onClose,
  onEditVehicle,
  onVinClick,
}) {
  const isGuest = client && !client.user_id;

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={client ? `Автомобили — ${client.name}` : 'Автомобили'}
      size="md"
      footer={
        <div className="flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-50"
          >
            Закрыть
          </button>
        </div>
      }
    >
      {client ? (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-2 text-sm text-gray-600">
            <span>{client.phone || '—'}</span>
            <AccountBadge userId={client.user_id} />
          </div>
          {isGuest ? (
            <p className="text-xs text-gray-500">
              Клиент без аккаунта — автомобили можно редактировать.
            </p>
          ) : null}
          <VehicleList
            vehicles={vehicles}
            loading={loading}
            canEdit={isGuest}
            onEdit={onEditVehicle}
            onVinClick={onVinClick}
          />
        </div>
      ) : null}
    </Modal>
  );
}

function ClientMobileCard({
  row,
  onShowVehicles,
}) {
  return (
    <div className="border-b border-gray-100 py-3 last:border-b-0">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-sm font-semibold text-gray-900">{row.name}</p>
            <AccountBadge userId={row.user_id} />
          </div>
          <p className="mt-1 text-sm text-gray-600">{row.phone || '—'}</p>
          <p className="mt-1 text-xs text-gray-500">
            Согласие: {formatServerDateTime(row.consented_at) || '—'}
          </p>
        </div>
        <button
          type="button"
          onClick={onShowVehicles}
          className="shrink-0 rounded-lg px-2.5 py-1.5 text-sm font-medium text-indigo-700 transition hover:bg-indigo-50"
        >
          Авто
        </button>
      </div>
    </div>
  );
}

function EditGuestVehicleModal({ open, vehicle, onClose, onSaved }) {
  const [form, setForm] = useState({
    vin: '',
    make: '',
    model: '',
    year: '',
    color: '',
    plate: '',
    notes: '',
  });
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open || !vehicle) return;
    setForm({
      vin: vehicle.vin || '',
      make: vehicle.make || '',
      model: vehicle.model || '',
      year: vehicle.year != null ? String(vehicle.year) : '',
      color: vehicle.color || '',
      plate: vehicle.plate || '',
      notes: vehicle.notes || '',
    });
    setError('');
    setSaving(false);
  }, [open, vehicle]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!vehicle) return;
    setError('');
    const make = form.make.trim();
    const model = form.model.trim();
    if (!make || !model) {
      setError('Укажите марку и модель');
      return;
    }
    const year = form.year ? Number(form.year) : null;
    if (form.year && (!Number.isFinite(year) || year < 1900 || year > 2100)) {
      setError('Некорректный год');
      return;
    }
    setSaving(true);
    try {
      const row = await apiRequest(`/autoservice/garage/vehicles/${vehicle.id}/staff`, {
        method: 'PATCH',
        body: JSON.stringify({
          vin: form.vin.trim() || null,
          make,
          model,
          year,
          color: form.color.trim() || null,
          plate: form.plate.trim() || null,
          notes: form.notes.trim() || null,
        }),
      });
      onSaved(row);
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
      title="Изменить автомобиль"
      size="md"
      footer={
        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-50"
            disabled={saving}
          >
            Отмена
          </button>
          <button
            type="submit"
            form="edit-guest-vehicle"
            disabled={saving}
            className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-indigo-700 disabled:opacity-60"
          >
            {saving ? 'Сохранение…' : 'Сохранить'}
          </button>
        </div>
      }
    >
      <form id="edit-guest-vehicle" onSubmit={handleSubmit} className="space-y-3">
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <label className="block text-sm font-medium text-gray-700">VIN</label>
            <input
              className={inputClass}
              value={form.vin}
              onChange={(e) => setForm((p) => ({ ...p, vin: sanitizeVinInput(e.target.value) }))}
              maxLength={VIN_INPUT_MAX_LENGTH}
              disabled={saving}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">Марка</label>
            <input
              className={inputClass}
              value={form.make}
              onChange={(e) => setForm((p) => ({ ...p, make: e.target.value }))}
              required
              disabled={saving}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">Модель</label>
            <input
              className={inputClass}
              value={form.model}
              onChange={(e) => setForm((p) => ({ ...p, model: e.target.value }))}
              required
              disabled={saving}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">Год</label>
            <input
              type="number"
              className={inputClass}
              value={form.year}
              onChange={(e) => setForm((p) => ({ ...p, year: e.target.value }))}
              min={1900}
              max={2100}
              disabled={saving}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">Цвет</label>
            <input
              className={inputClass}
              value={form.color}
              onChange={(e) => setForm((p) => ({ ...p, color: e.target.value }))}
              disabled={saving}
            />
          </div>
          <div className="sm:col-span-2">
            <label className="block text-sm font-medium text-gray-700">Госномер</label>
            <input
              className={inputClass}
              value={form.plate}
              onChange={(e) => setForm((p) => ({ ...p, plate: e.target.value }))}
              disabled={saving}
            />
          </div>
          <div className="sm:col-span-2">
            <label className="block text-sm font-medium text-gray-700">Заметка</label>
            <textarea
              className={inputClass}
              rows={2}
              value={form.notes}
              onChange={(e) => setForm((p) => ({ ...p, notes: e.target.value }))}
              disabled={saving}
            />
          </div>
        </div>
        {error ? <p className="text-sm text-red-600">{error}</p> : null}
      </form>
    </Modal>
  );
}

function AddClientModal({ open, onClose, onCreated }) {
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [phoneError, setPhoneError] = useState('');
  const [error, setError] = useState(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setName('');
    setPhone('');
    setPhoneError('');
    setError(null);
    setSaving(false);
  }, [open]);

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
    <Modal
      open={open}
      onClose={onClose}
      title="Добавить клиента"
      size="sm"
      footer={
        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-50"
            disabled={saving}
          >
            Отмена
          </button>
          <button
            type="submit"
            form="add-autoservice-client"
            disabled={saving}
            className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-indigo-700 disabled:opacity-60"
          >
            {saving ? 'Сохранение…' : 'Добавить'}
          </button>
        </div>
      }
    >
      <form id="add-autoservice-client" onSubmit={handleSubmit} className="space-y-4">
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
          {phoneError ? <p className="mt-1 text-sm text-red-600">{phoneError}</p> : null}
        </div>
        {error ? <p className="text-sm text-red-600">{error}</p> : null}
      </form>
    </Modal>
  );
}

export default function AutoserviceClientsPage() {
  const navigate = useNavigate();
  const { isReady, user, isAuthenticated } = useAuthReady();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [addOpen, setAddOpen] = useState(false);
  const [q, setQ] = useState('');
  const qApplied = useDebouncedValue(q);
  const [vehiclesModalClient, setVehiclesModalClient] = useState(null);
  const [clientVehicles, setClientVehicles] = useState({});
  const [vehiclesLoadingId, setVehiclesLoadingId] = useState(null);
  const [editVehicle, setEditVehicle] = useState(null);

  const handleVinClick = useCallback((rawVin) => {
    const vin = normalizeVinOrNull(rawVin);
    if (!vin) return;
    setVehiclesModalClient(null);
    navigate(`/autoparts/vin?vin=${encodeURIComponent(vin)}`);
  }, [navigate]);

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

  const filteredRows = useMemo(() => {
    const query = qApplied.trim().toLowerCase();
    if (!query) return rows;
    const digits = query.replace(/\D/g, '');
    return rows.filter((row) => {
      const name = String(row.name || '').toLowerCase();
      const phone = String(row.phone || '').toLowerCase();
      const phoneDigits = phone.replace(/\D/g, '');
      return name.includes(query) || phone.includes(query) || (digits && phoneDigits.includes(digits));
    });
  }, [rows, qApplied]);

  const openClientVehicles = async (client) => {
    if (!client?.id) return;
    setVehiclesModalClient(client);
    if (clientVehicles[client.id]) return;
    setVehiclesLoadingId(client.id);
    try {
      const data = await apiRequest(`/autoservice/garage/vehicles?client_id=${client.id}`);
      setClientVehicles((prev) => ({ ...prev, [client.id]: Array.isArray(data) ? data : [] }));
    } catch {
      setClientVehicles((prev) => ({ ...prev, [client.id]: [] }));
    } finally {
      setVehiclesLoadingId(null);
    }
  };

  const closeClientVehicles = () => {
    setVehiclesModalClient(null);
  };

  if (!isReady) return <AuthLoadingScreen />;
  if (!isAuthenticated || !user) return null;

  return (
    <div className="w-full min-w-0">
      <div className="mb-4 flex flex-col gap-3 sm:mb-5 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900 sm:text-2xl">Клиенты</h1>
          <p className="mt-0.5 text-sm text-gray-500">
            {loading
              ? 'Загрузка…'
              : qApplied.trim()
                ? `${filteredRows.length} из ${rows.length}`
                : `${rows.length} клиентов`}
          </p>
        </div>
        <button
          type="button"
          onClick={() => setAddOpen(true)}
          className="inline-flex h-10 items-center justify-center rounded-lg bg-indigo-600 px-4 text-sm font-semibold text-white transition hover:bg-indigo-700"
        >
          Добавить
        </button>
      </div>

      <div className="mb-4 flex items-center gap-2">
        <AutoserviceLiveSearchField
          value={q}
          onChange={setQ}
          placeholder="Имя или телефон"
          ariaLabel="Поиск клиентов"
        />
        <button
          type="button"
          onClick={load}
          className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gray-100 text-gray-600 transition hover:bg-gray-200 hover:text-gray-900"
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

      {error ? (
        <p className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700" role="alert">
          {error}
        </p>
      ) : null}

      <div className="hidden overflow-x-auto md:block">
        <table className="min-w-full table-fixed divide-y divide-gray-200 text-sm">
          <thead>
            <tr className="text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
              <th className="py-3 pr-3">Имя</th>
              <th className="w-44 py-3 pr-3">Телефон</th>
              <th className="hidden w-44 py-3 pr-3 lg:table-cell">Согласие</th>
              <th className="w-28 py-3 pr-3">Аккаунт</th>
              <th className="w-28 py-3 text-right">Авто</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {loading ? (
              <tr>
                <td colSpan={5} className="py-12 text-center text-gray-500">
                  Загрузка…
                </td>
              </tr>
            ) : filteredRows.length === 0 ? (
              <tr>
                <td colSpan={5} className="py-12 text-center text-gray-500">
                  {rows.length === 0 ? 'Клиентов пока нет' : 'Ничего не найдено'}
                </td>
              </tr>
            ) : (
              filteredRows.map((row) => (
                <tr
                  key={row.id}
                  className="cursor-pointer transition-colors hover:bg-gray-50/70"
                  onDoubleClick={() => openClientVehicles(row)}
                >
                  <td className="py-3 pr-3 align-middle font-medium text-gray-900">{row.name}</td>
                  <td className="whitespace-nowrap py-3 pr-3 align-middle text-gray-700">{row.phone || '—'}</td>
                  <td className="hidden whitespace-nowrap py-3 pr-3 align-middle text-gray-600 lg:table-cell">
                    {formatServerDateTime(row.consented_at) || '—'}
                  </td>
                  <td className="py-3 pr-3 align-middle">
                    <AccountBadge userId={row.user_id} />
                  </td>
                  <td className="py-3 text-right align-middle">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        openClientVehicles(row);
                      }}
                      className="rounded-lg px-2.5 py-1.5 text-sm font-medium text-indigo-700 transition hover:bg-indigo-50"
                    >
                      Показать
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <div className="md:hidden">
        {loading ? (
          <p className="py-10 text-center text-sm text-gray-500">Загрузка…</p>
        ) : filteredRows.length === 0 ? (
          <p className="py-10 text-center text-sm text-gray-500">
            {rows.length === 0 ? 'Клиентов пока нет' : 'Ничего не найдено'}
          </p>
        ) : (
          filteredRows.map((row) => (
            <div
              key={row.id}
              onDoubleClick={() => openClientVehicles(row)}
            >
              <ClientMobileCard
                row={row}
                onShowVehicles={() => openClientVehicles(row)}
              />
            </div>
          ))
        )}
      </div>

      <AddClientModal
        open={addOpen}
        onClose={() => setAddOpen(false)}
        onCreated={(row) => {
          setRows((prev) => [row, ...prev.filter((r) => r.id !== row.id)]);
        }}
      />

      <ClientVehiclesModal
        open={Boolean(vehiclesModalClient)}
        client={vehiclesModalClient}
        vehicles={vehiclesModalClient ? clientVehicles[vehiclesModalClient.id] : []}
        loading={vehiclesModalClient ? vehiclesLoadingId === vehiclesModalClient.id : false}
        onClose={closeClientVehicles}
        onEditVehicle={setEditVehicle}
        onVinClick={handleVinClick}
      />

      <EditGuestVehicleModal
        open={Boolean(editVehicle)}
        vehicle={editVehicle}
        onClose={() => setEditVehicle(null)}
        onSaved={(updated) => {
          setClientVehicles((prev) => {
            const clientId = updated.client_id;
            const list = prev[clientId] || [];
            return {
              ...prev,
              [clientId]: list.map((v) => (v.id === updated.id ? updated : v)),
            };
          });
        }}
      />
    </div>
  );
}
